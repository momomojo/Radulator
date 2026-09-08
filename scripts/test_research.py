"""Deterministic synthetic API fixtures: no live network in unit tests."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs

import research

ARTICLE = b'''<PubmedArticleSet><PubmedArticle>
<MedlineCitation><PMID>12345</PMID><Article>
<Journal><Title>Synthetic Clinical Journal</Title><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal>
<ArticleTitle>A <i>synthetic</i> validation study</ArticleTitle>
<Abstract><AbstractText Label="METHODS">Synthetic methods.</AbstractText><AbstractText Label="RESULTS">Synthetic results.</AbstractText></Abstract>
<PublicationTypeList><PublicationType>Retracted Publication</PublicationType></PublicationTypeList>
</Article><CommentsCorrectionsList><CommentsCorrections RefType="RetractionIn"><RefSource>Retraction notice</RefSource><PMID>54321</PMID></CommentsCorrections></CommentsCorrectionsList></MedlineCitation>
<PubmedData><ArticleIdList><ArticleId IdType="doi">10.1234/example</ArticleId><ArticleId IdType="pmc">PMC67890</ArticleId></ArticleIdList></PubmedData>
</PubmedArticle></PubmedArticleSet>'''
FULL_TEXT = b'''<pmc-articleset><article><front><article-meta>
<article-id pub-id-type="pmid">12345</article-id><article-id pub-id-type="pmc">67890</article-id>
<permissions><license license-type="open-access"><license-p>CC BY synthetic</license-p></license></permissions>
</article-meta></front><body><sec id="s1"><title>Methods</title><p>Synthetic body.</p></sec></body></article></pmc-articleset>'''


class ResearchTests(unittest.TestCase):
    def test_article_retains_identity_structured_abstract_and_notice_direction(self):
        result = research.parse_article(ARTICLE, "12345", "https://doi.org/10.1234/EXAMPLE")
        self.assertIsNotNone(result, "parser must return verified bibliographic metadata")
        self.assertEqual(result["title"], "A synthetic validation study")
        self.assertEqual(result["doi"], "10.1234/example")
        self.assertEqual(result["pmcid"], "PMC67890")
        self.assertEqual(result["abstract"][0], {"label": "METHODS", "text": "Synthetic methods."})
        self.assertEqual(result["notices"][0]["type"], "RetractionIn")
        self.assertEqual(result["notices"][0]["pmid"], "54321")
        self.assertIn("Retracted Publication", result["publication_types"])
        self.assertEqual(result["clinical_review"], "not_performed")

    def test_wrong_id_missing_article_and_wrong_doi_fail_closed(self):
        for raw, pmid, doi in [(ARTICLE, "9", None), (b"<PubmedArticleSet/>", "12345", None),
                               (ARTICLE, "12345", "10.9999/wrong")]:
            with self.subTest(pmid=pmid, doi=doi), self.assertRaises(ValueError):
                research.parse_article(raw, pmid, doi)

    def test_malformed_or_entity_payload_cannot_become_evidence(self):
        for raw in [b"<html>Access denied</html>", b"<broken", b'<!DOCTYPE x [<!ENTITY y "bad">]><x/>']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                research.parse_article(raw, "12345")

    def test_full_text_retains_license_and_exact_locator(self):
        result = research.parse_full_text(FULL_TEXT, "12345", "PMC67890")
        self.assertIsNotNone(result)
        self.assertEqual(result["license"], "CC BY synthetic")
        self.assertEqual(result["sections"][0]["id"], "s1")
        self.assertEqual(result["sections"][0]["title"], "Methods")

    def test_full_text_must_match_both_identifiers_and_have_body(self):
        for raw, pmid, pmcid in [(FULL_TEXT, "9", "PMC67890"), (FULL_TEXT, "12345", "PMC9"),
                                 (b"<article/>", "12345", "PMC67890")]:
            with self.subTest(pmid=pmid, pmcid=pmcid), self.assertRaises(ValueError):
                research.parse_full_text(raw, pmid, pmcid)

    def test_verify_detects_tampered_cached_bytes_and_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            digest = hashlib.sha256(ARTICLE).hexdigest()
            (root / f"{digest}.xml").write_bytes(ARTICLE)
            record = {"schema": "radulator-research/v1", "pmid": "12345",
                      "metadata": {"path": f"{digest}.xml", "sha256": digest},
                      "article": research.parse_article(ARTICLE, "12345"), "full_text": None}
            path = root / "record.json"
            path.write_text(json.dumps(record))
            self.assertIsNotNone(research.verify_record(path))
            (root / f"{digest}.xml").write_bytes(b"changed")
            with self.assertRaises(ValueError):
                research.verify_record(path)

    def test_http_client_keeps_key_out_of_url_and_receipt(self):
        captured = []
        class Response:
            status = 200
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def read(self, limit):
                return ARTICLE
        def opener(request, timeout):
            captured.append(request)
            return Response()
        client = research.Client(api_key="SYNTHETIC_SECRET", opener=opener, sleep=lambda _: None)
        raw, receipt = client.request("efetch", {"db": "pubmed", "id": "12345", "retmode": "xml"})
        self.assertEqual(raw, ARTICLE)
        self.assertNotIn("SYNTHETIC_SECRET", json.dumps(receipt))
        self.assertNotIn("SYNTHETIC_SECRET", captured[0].full_url)
        self.assertEqual(parse_qs(captured[0].data.decode())["api_key"], ["SYNTHETIC_SECRET"])

    def test_http_rate_limit_has_bounded_retry_and_never_leaks_error_body(self):
        calls = []
        def denied(request, timeout):
            calls.append(request)
            raise HTTPError(request.full_url, 429, "SYNTHETIC_SECRET", {"Retry-After": "1"}, None)
        client = research.Client(api_key="SYNTHETIC_SECRET", opener=denied, sleep=lambda _: None)
        with self.assertRaisesRegex(ValueError, "HTTP 429") as failure:
            client.request("efetch", {"db": "pubmed", "id": "12345"})
        self.assertNotIn("SYNTHETIC_SECRET", str(failure.exception))
        self.assertEqual(len(calls), 3)

    def test_fetch_caches_validated_source_and_reuses_it_offline(self):
        class Client:
            calls = 0
            def request(self, utility, params):
                self.calls += 1
                return ARTICLE, {"url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=12345", "status": 200}
        client = Client()
        with tempfile.TemporaryDirectory() as temp:
            first = research.fetch_publication("12345", Path(temp), client)
            self.assertEqual(first["cached"], False)
            self.assertEqual(research.verify_record(first["record"])["integrity"], "pass")
            second = research.fetch_publication("12345", Path(temp), client)
            self.assertEqual(second["cached"], True)
            self.assertEqual(second["record"], first["record"])
            self.assertEqual(client.calls, 1)
            with self.assertRaisesRegex(ValueError, "DOI"):
                research.fetch_publication("12345", Path(temp), client, expected_doi="10.999/wrong")

    def test_full_text_denial_is_a_recorded_gap_not_a_success(self):
        class Client:
            def request(self, utility, params):
                if params["db"] == "pmc":
                    raise ValueError("Source HTTP 403")
                return ARTICLE, {"status": 200}
        with tempfile.TemporaryDirectory() as temp:
            result = research.fetch_publication("12345", Path(temp), Client(), full_text=True)
            record = json.loads(Path(result["record"]).read_text())
            self.assertEqual(record["full_text"]["status"], "unavailable")
            self.assertEqual(record["article"]["clinical_review"], "not_performed")

    def test_wrong_full_text_identity_is_not_silently_downgraded_to_access_gap(self):
        class Client:
            def request(self, utility, params):
                return (FULL_TEXT.replace(b"12345", b"99999") if params["db"] == "pmc" else ARTICLE), {"status": 200}
        with tempfile.TemporaryDirectory() as temp, self.assertRaisesRegex(ValueError, "mismatch"):
            research.fetch_publication("12345", Path(temp), Client(), full_text=True)

    def test_matching_pmc_metadata_without_body_is_an_access_gap(self):
        class Client:
            def request(self, utility, params):
                raw = FULL_TEXT.split(b"<body>")[0] + b"</article></pmc-articleset>"
                return (raw if params["db"] == "pmc" else ARTICLE), {"status": 200}
        with tempfile.TemporaryDirectory() as temp:
            result = research.fetch_publication("12345", Path(temp), Client(), full_text=True)
            self.assertEqual(result["full_text"], "unavailable")

    def test_cache_pointer_cannot_return_a_different_requested_pmid(self):
        class Client:
            def request(self, utility, params):
                return ARTICLE, {"status": 200}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            research.fetch_publication("12345", root, Client())
            (root / "pubmed-99999-latest.json").write_bytes((root / "pubmed-12345-latest.json").read_bytes())
            with self.assertRaisesRegex(ValueError, "PMID"):
                research.fetch_publication("99999", root, Client())

    def test_metadata_only_fulltext_blob_tampering_is_detected(self):
        class Client:
            def request(self, utility, params):
                raw = FULL_TEXT.split(b"<body>")[0] + b"</article></pmc-articleset>"
                return (raw if params["db"] == "pmc" else ARTICLE), {"status": 200}
        with tempfile.TemporaryDirectory() as temp:
            result = research.fetch_publication("12345", Path(temp), Client(), full_text=True)
            record = json.loads(Path(result["record"]).read_text())
            (Path(temp) / record["full_text"]["path"]).write_bytes(b"wrong")
            with self.assertRaisesRegex(ValueError, "hash"):
                research.verify_record(result["record"])

    def test_nested_section_locators_resolve_to_exact_source_sections(self):
        nested = FULL_TEXT.replace(b'<p>Synthetic body.</p>', b'<sec id="inner"><title>Nested</title></sec>')
        nested = nested.replace(b'</body>', b'<sec id="peer"><title>Peer</title></sec></body>')
        parsed = research.parse_full_text(nested, "12345", "PMC67890")
        source = research.xml(nested).find("article")
        self.assertEqual(len(parsed["sections"]), 3)
        for section in parsed["sections"]:
            targets = source.findall(section["locator"])
            self.assertEqual(len(targets), 1)
            self.assertEqual(targets[0].get("id"), section["id"])


if __name__ == "__main__":
    unittest.main()
