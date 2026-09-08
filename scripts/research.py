"""Public literature retrieval. Clinical interpretation is always separate."""
import hashlib
import json
import argparse
from datetime import datetime, timezone
import fcntl
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
import xml.etree.ElementTree as ET

SCHEMA = "radulator-research/v1"
BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
MAX_BYTES = 16 * 1024 * 1024


class FullTextUnavailable(ValueError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    """Serial bounded requests. CLI additionally locks the shared project cache."""
    def __init__(self, api_key=None, email=None, opener=None, sleep=time.sleep):
        self.api_key = api_key
        self.email = email
        self.open = opener or build_opener(NoRedirect()).open
        self.sleep = sleep

    def request(self, utility, params):
        if utility not in {"esearch", "efetch"} or params.get("db") not in {"pubmed", "pmc"}:
            raise ValueError("Unsupported literature endpoint")
        public = {**params, "tool": "radulator_source_review"}
        private = dict(public)
        if self.api_key:
            private["api_key"] = self.api_key
        if self.email:
            private["email"] = self.email
        url = BASE + utility + ".fcgi"
        request = Request(url, data=urlencode(private).encode(), headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "RadulatorSourceReview/1.0",
        })
        for attempt in range(3):
            # Conservatively stay below NCBI's unkeyed limit even when a key exists.
            self.sleep(0.4)
            try:
                with self.open(request, timeout=20) as response:
                    raw = response.read(MAX_BYTES + 1)
                    if len(raw) > MAX_BYTES:
                        raise ValueError("Source exceeds bounded response size")
                    return raw, {"url": url + "?" + urlencode(public), "status": response.status,
                                 "retrieved_at": now(), "method": "POST"}
            except HTTPError as error:
                error.close()
                if error.code in {429, 502, 503, 504} and attempt < 2:
                    retry = error.headers.get("Retry-After", "1") if error.headers else "1"
                    if retry.isdigit() and int(retry) <= 5:
                        self.sleep(max(1, int(retry)))
                        continue
                raise ValueError(f"Source HTTP {error.code}; response body omitted") from None
            except (URLError, TimeoutError, OSError):
                raise ValueError("Source network request failed; private request details omitted") from None


def text(element):
    return "" if element is None else " ".join("".join(element.itertext()).split())


def xml(raw):
    if b"<!ENTITY" in raw.upper():
        raise ValueError("Entity declarations are not permitted in source responses")
    try:
        return ET.fromstring(raw)
    except ET.ParseError as error:
        raise ValueError("Malformed source XML") from error


def normalize_doi(value):
    return re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", value.strip(), flags=re.I).lower()


def parse_article(raw, pmid, expected_doi=None):
    root = xml(raw)
    articles = root.findall("./PubmedArticle")
    if root.tag != "PubmedArticleSet" or len(articles) != 1:
        raise ValueError("Expected exactly one PubMed article")
    article = articles[0]
    if text(article.find("./MedlineCitation/PMID")) != pmid:
        raise ValueError("PubMed PMID mismatch")
    data = article.find("./MedlineCitation/Article")
    if data is None or not text(data.find("ArticleTitle")):
        raise ValueError("Missing article title")
    identifiers = {item.get("IdType"): text(item) for item in article.findall("./PubmedData/ArticleIdList/ArticleId")}
    doi = normalize_doi(identifiers.get("doi", "")) or None
    if expected_doi and doi != normalize_doi(expected_doi):
        raise ValueError("PubMed DOI mismatch or missing DOI")
    notices = [{"type": item.get("RefType"), "pmid": text(item.find("PMID")),
                "source": text(item.find("RefSource")), "note": text(item.find("Note"))}
               for item in article.findall("./MedlineCitation/CommentsCorrectionsList/CommentsCorrections")]
    return {
        "pmid": pmid, "pmcid": identifiers.get("pmc"), "doi": doi,
        "title": text(data.find("ArticleTitle")), "journal": text(data.find("Journal/Title")),
        "publication_date": text(data.find("Journal/JournalIssue/PubDate")),
        "authors": [text(item.find("CollectiveName")) or " ".join(filter(None, [text(item.find("LastName")), text(item.find("ForeName"))]))
                    for item in data.findall("AuthorList/Author")],
        "abstract": [{"label": item.get("Label", ""), "text": text(item)} for item in data.findall("Abstract/AbstractText")],
        "publication_types": [text(item) for item in data.findall("PublicationTypeList/PublicationType")],
        "notices": notices, "notice_scope": "relationships returned by PubMed at retrieval time; absence is not clearance",
        "clinical_review": "not_performed",
    }


def parse_full_text(raw, pmid, pmcid):
    root = xml(raw)
    articles = [root] if root.tag == "article" else root.findall("./article")
    if len(articles) != 1:
        raise ValueError("Expected exactly one full-text article")
    article = articles[0]
    identifiers = {item.get("pub-id-type"): text(item) for item in article.findall("./front/article-meta/article-id")}
    returned_pmc = identifiers.get("pmc", identifiers.get("pmcid", ""))
    if identifiers.get("pmid") != pmid or returned_pmc.removeprefix("PMC") != pmcid.removeprefix("PMC"):
        raise ValueError("Full-text PMID/PMCID mismatch")
    if article.find("body") is None:
        raise FullTextUnavailable("Matching PMC metadata returned without a full-text body")
    sections = []

    def locate(parent, prefix):
        positions = {}
        for child in parent:
            positions[child.tag] = positions.get(child.tag, 0) + 1
            locator = f"{prefix}/{child.tag}[{positions[child.tag]}]"
            if child.tag == "sec":
                sections.append({"id": child.get("id"), "title": text(child.find("title")), "locator": locator})
            locate(child, locator)

    locate(article.find("body"), "./body")
    return {
        "pmid": pmid, "pmcid": pmcid,
        "license": text(article.find("./front/article-meta/permissions/license")) or "not supplied; no redistribution permission inferred",
        "sections": sections,
        "clinical_review": "not_performed",
    }


def verify_record(record_path):
    record_path = Path(record_path).resolve()
    record = json.loads(record_path.read_text())
    if record.get("schema") != SCHEMA:
        raise ValueError("Unknown research record schema")

    def read_blob(entry):
        target = (record_path.parent / entry["path"]).resolve()
        if target.parent != record_path.parent or not re.fullmatch(r"[0-9a-f]{64}\.xml", target.name):
            raise ValueError("Invalid local research blob path")
        raw = target.read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("Cached research hash mismatch")
        return raw

    article = parse_article(read_blob(record["metadata"]), record["pmid"])
    if article != record["article"]:
        raise ValueError("Cached article metadata differs from source XML")
    full_text = record.get("full_text")
    if full_text:
        if full_text.get("status") not in {"retrieved", "unavailable"}:
            raise ValueError("Invalid full-text availability status")
        if full_text.get("path") or full_text["status"] == "retrieved":
            raw = read_blob(full_text)
            try:
                parsed = parse_full_text(raw, record["pmid"], article["pmcid"])
            except FullTextUnavailable:
                if full_text["status"] != "unavailable":
                    raise ValueError("Cached full-text status disagrees with source XML") from None
            else:
                if full_text["status"] != "retrieved" or parsed != full_text.get("article"):
                    raise ValueError("Cached full-text metadata differs from source XML")
    return {"record": str(record_path), "integrity": "pass", "pmid": record["pmid"],
            "clinical_review": "not_performed", "freshness": "not checked; offline integrity only"}


def store_blob(cache, raw, receipt):
    digest = hashlib.sha256(raw).hexdigest()
    target = cache / f"{digest}.xml"
    if target.exists():
        if target.read_bytes() != raw:
            raise ValueError("Existing content-addressed source blob is corrupt")
    else:
        target.write_bytes(raw)
    return {**receipt, "path": target.name, "sha256": digest, "bytes": len(raw)}


def fetch_publication(pmid, cache, client, expected_doi=None, full_text=False, refresh=False):
    if not re.fullmatch(r"[1-9]\d{0,11}", pmid):
        raise ValueError("PMID must be a positive decimal identifier")
    cache = Path(cache).resolve()
    cache.mkdir(parents=True, exist_ok=True)
    pointer = cache / f"pubmed-{pmid}-latest.json"
    if pointer.exists() and not refresh:
        record_path = (cache / json.loads(pointer.read_text())["record"]).resolve()
        if record_path.parent != cache:
            raise ValueError("Cached record path escapes source cache")
        verified = verify_record(record_path)
        if verified["pmid"] != pmid:
            raise ValueError("Cached record does not match the requested PMID")
        old = json.loads(record_path.read_text())
        if expected_doi and old["article"]["doi"] != normalize_doi(expected_doi):
            raise ValueError("Cached PMID/DOI mismatch")
        if not full_text or old.get("full_text") is not None:
            return {**verified, "cached": True}

    raw, receipt = client.request("efetch", {"db": "pubmed", "id": pmid, "retmode": "xml"})
    article = parse_article(raw, pmid, expected_doi)
    record = {"schema": SCHEMA, "pmid": pmid, "created_at": now(), "article": article,
              "metadata": store_blob(cache, raw, receipt), "full_text": None}
    if full_text:
        pmcid = article["pmcid"]
        if not pmcid or not re.fullmatch(r"PMC[1-9]\d*", pmcid):
            record["full_text"] = {"status": "unavailable", "reason": "No valid PMCID returned by PubMed"}
        else:
            try:
                full_raw, full_receipt = client.request("efetch", {"db": "pmc", "id": pmcid[3:], "retmode": "xml"})
            except ValueError as error:
                record["full_text"] = {"status": "unavailable", "reason": str(error), "attempted_at": now()}
            else:
                # Wrong/malformed content is an integrity failure, not an access gap.
                try:
                    full_article = parse_full_text(full_raw, pmid, pmcid)
                except FullTextUnavailable as error:
                    record["full_text"] = {**store_blob(cache, full_raw, full_receipt), "status": "unavailable", "reason": str(error)}
                else:
                    record["full_text"] = {**store_blob(cache, full_raw, full_receipt), "status": "retrieved", "article": full_article}
    record_path = cache / f"pubmed-{pmid}-{time.time_ns()}.json"
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    verified = verify_record(record_path)
    temporary = pointer.with_suffix(".tmp")
    temporary.write_text(json.dumps({"record": record_path.name}) + "\n")
    temporary.replace(pointer)
    return {**verified, "cached": False, "full_text": (record["full_text"] or {}).get("status", "not_requested"),
            "notices": len(article["notices"]), "title": article["title"]}


def default_cache():
    root = Path(__file__).resolve().parent.parent
    common = subprocess.check_output(["git", "rev-parse", "--git-common-dir"], cwd=root, text=True).strip()
    return (root / common).resolve() / "radulator-research-cache"


def main():
    parser = argparse.ArgumentParser(description="Public literature only. No patient data. Integrity is not clinical verification.")
    parser.add_argument("--cache-dir", type=Path, help="Default: shared local Git cache; never automatically committed")
    commands = parser.add_subparsers(dest="command", required=True)
    search = commands.add_parser("search")
    search.add_argument("query", help="Public literature query, never patient text")
    search.add_argument("--limit", type=int, default=10, choices=range(1, 51))
    fetch = commands.add_parser("fetch")
    fetch.add_argument("pmid")
    fetch.add_argument("--expect-doi")
    fetch.add_argument("--full-text", action="store_true")
    fetch.add_argument("--refresh", action="store_true", help="New retrieval; preserve previous records")
    verify = commands.add_parser("verify")
    verify.add_argument("record", type=Path)
    args = parser.parse_args()
    if args.command == "verify":
        print(json.dumps(verify_record(args.record), indent=2))
        return
    cache = (args.cache_dir or default_cache()).resolve()
    cache.mkdir(parents=True, exist_ok=True)
    # Shared across worktrees and processes. Fail promptly; do not queue agents.
    with (cache / "client.lock").open("a") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Another project research request is active; retry after it completes") from None
        client = Client(api_key=os.environ.get("NCBI_API_KEY"), email=os.environ.get("NCBI_EMAIL"))
        if args.command == "fetch":
            result = fetch_publication(args.pmid, cache, client, args.expect_doi, args.full_text, args.refresh)
        else:
            raw, receipt = client.request("esearch", {"db": "pubmed", "term": args.query,
                "retmax": str(args.limit), "retmode": "xml", "sort": "relevance"})
            parsed = xml(raw)
            if parsed.tag != "eSearchResult" or parsed.find("ERROR") is not None or parsed.find("ErrorList") is not None:
                raise ValueError("PubMed search was rejected; inspect query syntax")
            result = {"query": args.query, "count": parsed.findtext("Count"),
                      "pmids": [text(item) for item in parsed.findall("IdList/Id")],
                      "query_translation": parsed.findtext("QueryTranslation"),
                      "source": store_blob(cache, raw, receipt), "clinical_review": "not_performed"}
            search_path = cache / f"search-{time.time_ns()}.json"
            search_path.write_text(json.dumps(result, indent=2) + "\n")
            result = {"query": args.query, "count": result["count"], "pmids": result["pmids"],
                      "record": str(search_path), "clinical_review": "not_performed"}
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(f"Research command failed: {error}", file=sys.stderr)
        sys.exit(1)
    except (KeyError, OSError, subprocess.SubprocessError):
        # Avoid printing provider exception bodies, paths or environment secrets.
        print("Research command failed validation or retrieval. Run deterministic tests; check identifiers, access, and local cache integrity.", file=sys.stderr)
        sys.exit(1)
