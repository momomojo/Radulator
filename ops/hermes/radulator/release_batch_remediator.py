#!/usr/bin/env python3
"""Release batch remediator: revert-first handling of a batch promotion's NEEDS_FIX.

Owner decision (2026-09-27): remediation reverts first. Deterministic, no agent; a
fleet cron every 10 minutes that prints nothing unless it acted. For the single
open promotion (base main, same-repository head release/promote-*), it verifies
every required-role NEEDS_FIX attestation at the promotion's exact head and base,
and the promotion chain, with main's own code (a detached worktree of origin/main
and the fleet judge public keys). It then reads each blocking finding's
"Batch attribution:" line:

- One attributed non-remediation PR in a batch of two or more non-remediation
  PRs: comment on the promotion and on that PR, and open
  "revert: PR #N (release remediation for promotion #P)" from develop, labelled
  release-remediation, with the high-risk marker when PR #N was high risk. Judges
  review it like any PR. Once it merges, the promoter supersedes the promotion and
  the rest of the batch releases; PR #N's author re-lands the fix in a later batch.
- A batch of one: fix forward, as #287 -> #295 did (an operator card, no revert).
- integration, main-drift, chain, an unattributed finding, several PRs, a later
  batch PR touching the same files, a revert conflict, an unverified chain, or a
  third round for the same main: an operator card and nothing automatic.

Release trackers are not written here: the radulator-release-controller skill
applies needs_fix only to the trackers that an attribution line names.
"""

import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
from contextlib import contextmanager

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.dirname(SCRIPT_DIR)
REPO = "momomojo/Radulator"
# A clone of its own, so the git work never races the release promoter's clone.
CLONE = os.environ.get(
    "RADULATOR_BATCH_REMEDIATOR_CLONE",
    os.path.join(PROFILE_DIR, "workspace", "release-remediator-repo"),
)
STATE_FILE = os.environ.get(
    "RADULATOR_BATCH_REMEDIATOR_STATE",
    os.path.join(PROFILE_DIR, "state", "radulator-release-batch-remediator.json"),
)
PUBLIC_KEYS_FILE = os.environ.get(
    "RADULATOR_JUDGE_PUBLIC_KEYS_FILE",
    os.path.join(PROFILE_DIR, "keys", "radulator-clinical", "public-keys.json"),
)
STATE_SCHEMA = "radulator-release-batch-remediator/v1"
CHAIN_SCHEMA = "radulator-promotion-chain/v1"
PROMOTION_PREFIX = "release/promote-"
ATTESTATION_MARKER = "<!-- radulator-clinical-attestation/v1 -->"
HIGH_RISK_MARKER = "<!-- radulator-risk: high -->"
REMEDIATION_LABEL = "release-remediation"
OPERATOR_ASSIGNEE = "radulator"
MAX_ROUNDS = 2
MAX_HANDLED = 500
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
ATTRIBUTION_LINE = re.compile(r"^[\s>*_`-]*Batch attribution:\s*(.*?)[\s`*_.]*$", re.MULTILINE)
PR_LIST = re.compile(r"^#[1-9]\d*(?:\s*,\s*#[1-9]\d*)*$")
ESCALATING_KINDS = ("integration", "main-drift", "chain", "malformed")

# Verifies records with main's release-policy.mjs: signature and configured identity (record only),
# and whether the record's role is required for its risk tier.
VERIFY_SCRIPT = r"""
import { readFileSync } from "node:fs";
const policy = await import(process.argv[1]);
const input = JSON.parse(readFileSync(0, "utf8"));
const results = input.records.map((record) => {
  const verified = policy.verifyAttestationRecord(record, input.publicKeys);
  let required = [];
  try { required = policy.requiredJudgeRoles(record?.risk?.tier); } catch { required = []; }
  return { ok: verified.ok === true, reasonCode: verified.reasonCode, required: required.includes(record?.judge?.role) };
});
process.stdout.write(JSON.stringify(results));
"""


def log(msg):
    print(f"[release-batch-remediator] {msg}")


def run(args, cwd=None, check=True, timeout=300, stdin_text=None):
    try:
        res = subprocess.run(args, cwd=cwd, input=stdin_text, capture_output=True, text=True,
                             timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"{' '.join(args[:4])} timed out after {timeout}s") from exc
    if check and res.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:4])} failed: {res.stderr.strip()[:300]}")
    return res


def gh_json(args):
    res = run(args)
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"malformed JSON from {' '.join(args[:4])}") from exc


# -- State ---------------------------------------------------------------------------------------

def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as handle:
            state = json.load(handle)
    except FileNotFoundError:
        state = None
    except (OSError, ValueError) as exc:
        raise RuntimeError(f"remediator state is unreadable: {exc}") from exc
    if not isinstance(state, dict) or state.get("schema") != STATE_SCHEMA:
        state = {"schema": STATE_SCHEMA, "handled": {}, "rounds": {}}
    state.setdefault("handled", {})
    state.setdefault("rounds", {})
    return state


def save_state(state):
    handled = state.get("handled", {})
    if len(handled) > MAX_HANDLED:
        keep = sorted(handled.items(), key=lambda item: item[1].get("at", ""))[-MAX_HANDLED:]
        state["handled"] = dict(keep)
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    temporary = f"{STATE_FILE}.tmp-{os.getpid()}"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
    os.replace(temporary, STATE_FILE)


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# -- Pure decisions ----------------------------------------------------------------------------------

def parse_carrier(body):
    if not isinstance(body, str) or ATTESTATION_MARKER not in body:
        return None
    suffix = body[body.index(ATTESTATION_MARKER) + len(ATTESTATION_MARKER):].strip()
    fenced = re.match(r"^```(?:json)?\s*\n([\s\S]*?)\n```\s*$", suffix, re.IGNORECASE)
    try:
        record = json.loads(fenced.group(1) if fenced else suffix)
    except (TypeError, ValueError):
        return None
    return record if isinstance(record, dict) else None


def parse_attributions(text):
    """Every "Batch attribution:" line: ("prs", [n, ...]), (kind, []) or ("malformed", [])."""
    found = []
    for match in ATTRIBUTION_LINE.finditer(text or ""):
        value = match.group(1).strip()
        if value in ("integration", "main-drift", "chain"):
            found.append((value, []))
        elif PR_LIST.fullmatch(value):
            found.append(("prs", [int(number) for number in re.findall(r"\d+", value)]))
        else:
            found.append(("malformed", []))
    return found


def decide(chain, findings, rounds_used):
    """What to do about verified required-role NEEDS_FIX findings on one promotion head."""
    attributions = []
    for finding in findings:
        lines = parse_attributions(finding["record"].get("clinical_analysis", ""))
        if not lines:
            return {"action": "card", "kind": "unattributed",
                    "detail": f"NEEDS_FIX comment {finding['comment_id']} has no Batch attribution line."}
        attributions.extend(lines)
    for kind in ESCALATING_KINDS:
        if any(line[0] == kind for line in attributions):
            return {"action": "card", "kind": kind,
                    "detail": f"A finding is attributed to {kind}; nothing is reverted automatically."}
    prs = sorted({number for kind, numbers in attributions if kind == "prs" for number in numbers})
    if len(prs) != 1:
        return {"action": "card", "kind": "several-prs",
                "detail": f"Findings name {', '.join(f'#{n}' for n in prs)}; only a single PR is reverted automatically."}
    if not isinstance(chain, dict) or chain.get("schema") != CHAIN_SCHEMA or not chain.get("ok"):
        reason = chain.get("reasonCode") if isinstance(chain, dict) else "missing"
        return {"action": "card", "kind": "chain-unverified",
                "detail": f"The promotion chain is not verified ({reason}); no revert without it."}
    entries = chain.get("entries") or []
    target = next((entry for entry in entries if entry.get("pr") == prs[0]), None)
    if target is None:
        return {"action": "card", "kind": "not-in-batch", "detail": f"#{prs[0]} is not in this promotion's batch."}
    if target.get("remediation"):
        return {"action": "card", "kind": "remediation-attributed",
                "detail": f"#{prs[0]} is itself a release-remediation PR; fix forward."}
    if not SHA_PATTERN.fullmatch(str(target.get("squash") or "")):
        return {"action": "card", "kind": "chain-unverified", "detail": f"#{prs[0]} has no squash commit in the chain."}
    if sum(1 for entry in entries if not entry.get("remediation")) < 2:
        return {"action": "card", "kind": "fix-forward", "entry": target,
                "detail": f"#{prs[0]} is the only PR in this release; fix it forward with a release-remediation PR."}
    files = set(target.get("files") or [])
    later = [entry.get("pr") for entry in entries[entries.index(target) + 1:]
             if files & set(entry.get("files") or [])]
    if later:
        return {"action": "card", "kind": "later-overlap",
                "detail": f"Later batch PRs {', '.join(f'#{n}' for n in later)} change the same files as #{prs[0]}."}
    if rounds_used >= MAX_ROUNDS:
        return {"action": "card", "kind": "rounds-exhausted",
                "detail": f"This release already had {rounds_used} remediation rounds."}
    return {"action": "revert", "entry": target}


def revert_body(promotion, entry, comment_ids):
    links = ", ".join(f"https://github.com/{REPO}/pull/{promotion['number']}#issuecomment-{cid}" for cid in comment_ids)
    lines = [
        f"Release remediation for promotion #{promotion['number']} (revert first).",
        "",
        f"The judge's NEEDS_FIX on promotion #{promotion['number']} at head `{promotion['headRefOid'][:12]}` "
        f"attributes a blocking finding to #{entry['pr']} ({links}).",
        "",
        f"This PR reverts #{entry['pr']}'s squash commit `{entry['squash']}` from develop "
        f"(`git revert --no-edit {entry['squash'][:12]}`), so the rest of the batch can release. After it "
        f"merges, the release promoter supersedes promotion #{promotion['number']}. #{entry['pr']}'s change "
        "re-lands, corrected, in a later batch.",
        "",
        f"Review it like any PR: it should be the exact inverse of #{entry['pr']}'s squash on develop.",
        "",
    ]
    if entry.get("tier") == "high":
        lines += [HIGH_RISK_MARKER, ""]
    lines.append("🤖 release_batch_remediator.py")
    return "\n".join(lines)


# -- GitHub, git and card actions ------------------------------------------------------------------

def open_promotion():
    pulls = gh_json(["gh", "pr", "list", "--repo", REPO, "--base", "main", "--state", "open",
                     "--json", "number,url,headRefName,headRefOid,baseRefOid,isCrossRepository"])
    promotions = [pull for pull in pulls
                  if str(pull.get("headRefName") or "").startswith(PROMOTION_PREFIX)
                  and pull.get("isCrossRepository") is False
                  and SHA_PATTERN.fullmatch(str(pull.get("headRefOid") or ""))
                  and SHA_PATTERN.fullmatch(str(pull.get("baseRefOid") or ""))]
    # The promoter keeps one open promotion; anything else is its to reconcile first.
    return promotions[0] if len(promotions) == 1 else None


def promotion_comments(number):
    raw = run(["gh", "api", "--paginate", f"repos/{REPO}/issues/{number}/comments",
               "--jq", ".[] | {id, body}"]).stdout
    return [json.loads(line) for line in raw.splitlines() if line.strip()]


@contextmanager
def main_worktree():
    """A detached worktree of exact origin/main: verification always runs trusted main code."""
    run(["git", "fetch", "-q", "origin", "main", "develop"], cwd=CLONE, timeout=180)
    main_sha = run(["git", "rev-parse", "origin/main"], cwd=CLONE).stdout.strip()
    with tempfile.TemporaryDirectory(prefix="radulator-remediator-") as worktree:
        run(["git", "worktree", "add", "--detach", worktree, main_sha], cwd=CLONE)
        try:
            yield worktree
        finally:
            run(["git", "worktree", "remove", "--force", worktree], cwd=CLONE, check=False)


def verify_records(worktree, records):
    if not records:
        return []
    with open(PUBLIC_KEYS_FILE, encoding="utf-8") as handle:
        public_keys = json.load(handle)
    policy = pathlib.Path(worktree, "scripts", "release-policy.mjs").as_uri()
    res = run(["node", "--input-type=module", "-e", VERIFY_SCRIPT, policy], cwd=worktree,
              stdin_text=json.dumps({"records": records, "publicKeys": public_keys}))
    results = json.loads(res.stdout)
    if not isinstance(results, list) or len(results) != len(records):
        raise RuntimeError("attestation verifier returned a malformed result")
    return results


def verify_chain(worktree, main_sha, promotion_sha):
    res = run(["node", os.path.join(worktree, "scripts", "promotion-chain.mjs"), "--repo", REPO,
               "--main", main_sha, "--promotion", promotion_sha, "--public-keys-file", PUBLIC_KEYS_FILE],
              cwd=worktree, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"promotion chain verifier failed: {(res.stderr or res.stdout).strip()[:300]}")
    return json.loads(res.stdout)


def open_revert(promotion, entry, comment_ids):
    number = entry["pr"]
    branch = f"remediation/revert-pr{number}-{entry['squash'][:12]}"
    existing = gh_json(["gh", "pr", "list", "--repo", REPO, "--head", branch, "--state", "all",
                        "--json", "number,url,state"])
    if existing:
        return {"status": "exists", "pr": existing[0]}
    develop_sha = run(["git", "rev-parse", "origin/develop"], cwd=CLONE).stdout.strip()
    with tempfile.TemporaryDirectory(prefix="radulator-revert-") as worktree:
        run(["git", "worktree", "add", "--detach", worktree, develop_sha], cwd=CLONE)
        try:
            reverted = run(["git", "-c", "user.name=Radulator Release Remediator",
                            "-c", "user.email=actions@users.noreply.github.com",
                            "revert", "--no-edit", entry["squash"]], cwd=worktree, check=False)
            if reverted.returncode != 0:
                run(["git", "revert", "--abort"], cwd=worktree, check=False)
                return {"status": "conflict", "detail": (reverted.stderr or reverted.stdout).strip()[:300]}
            run(["git", "push", "-q", "origin", f"HEAD:refs/heads/{branch}"], cwd=worktree)
        finally:
            run(["git", "worktree", "remove", "--force", worktree], cwd=CLONE, check=False)
    title = f"revert: PR #{number} (release remediation for promotion #{promotion['number']})"
    run(["gh", "pr", "create", "--repo", REPO, "--base", "develop", "--head", branch,
         "--title", title, "--body", revert_body(promotion, entry, comment_ids),
         "--label", REMEDIATION_LABEL], check=False)
    created = gh_json(["gh", "pr", "list", "--repo", REPO, "--head", branch, "--state", "open",
                       "--json", "number,url,state"])
    if len(created) != 1:
        raise RuntimeError(f"revert PR for #{number} failed authoritative readback")
    revert = created[0]
    run(["gh", "pr", "comment", str(promotion["number"]), "--repo", REPO, "--body", (
        f"Release remediation (revert first): the NEEDS_FIX at this head attributes its blocking finding "
        f"to #{number}. #{revert['number']} reverts #{number} (`{entry['squash'][:12]}`) from develop. "
        f"When it merges, the promoter supersedes this promotion and the rest of the batch releases; "
        f"#{number} re-lands in a later batch.")])
    run(["gh", "pr", "comment", str(number), "--repo", REPO, "--body", (
        f"Promotion #{promotion['number']} found a blocking problem attributed to this PR. "
        f"#{revert['number']} reverts it from develop so the rest of the batch can release. "
        "Please re-land the corrected change in a new PR.")])
    return {"status": "opened", "pr": revert}


def open_card(promotion, kind, detail, comment_ids):
    key = f"radulator-batch-remediation:{promotion['number']}:{promotion['headRefOid'][:12]}:{kind}"
    title = f"Radulator promotion #{promotion['number']} NEEDS_FIX needs an operator ({kind})"
    body = "\n".join([
        f"Promotion #{promotion['number']} (head {promotion['headRefOid'][:12]}, main {promotion['baseRefOid'][:12]}) "
        "has a required-role NEEDS_FIX that the batch remediator does not act on automatically.",
        "",
        f"Why: {detail}",
        f"NEEDS_FIX attestation comment ids: {', '.join(str(cid) for cid in comment_ids)}.",
        "",
        "Options: fix forward with a release-remediation PR to develop, revert by hand with a "
        "release-remediation PR, or add promotion-full-review for a full re-review. Never edit the "
        "promotion itself.",
    ])
    res = run(["hermes", "kanban", "create", title, "--assignee", OPERATOR_ASSIGNEE, "--body", body,
               "--idempotency-key", key, "--created-by", "radulator-release-batch-remediator",
               "--initial-status", "blocked", "--json"], check=False, timeout=60)
    if res.returncode != 0:
        raise RuntimeError(f"operator card creation failed: {(res.stderr or res.stdout).strip()[:300]}")
    try:
        payload = json.loads(res.stdout or "{}")
    except ValueError:
        payload = {}
    return payload.get("id") or payload.get("task_id") or "created"


# -- Main --------------------------------------------------------------------------------------------

def main():
    state = load_state()
    promotion = open_promotion()
    if promotion is None:
        return
    number, head, base = promotion["number"], promotion["headRefOid"], promotion["baseRefOid"]
    handled = state["handled"]
    fresh = []
    for comment in promotion_comments(number):
        record = parse_carrier(comment.get("body"))
        if (
            record and str(comment.get("id")) not in handled and record.get("pr") == number
            and record.get("head_sha") == head and record.get("base_sha") == base
            and record.get("base_ref") == "main" and record.get("verdict") == "NEEDS_FIX"
        ):
            fresh.append({"comment_id": comment.get("id"), "record": record})
    if not fresh:
        return
    with main_worktree() as worktree:
        verdicts = verify_records(worktree, [item["record"] for item in fresh])
        findings = [item for item, verdict in zip(fresh, verdicts) if verdict.get("ok") and verdict.get("required")]
        chain = verify_chain(worktree, base, head) if findings else None
    stamp = now_iso()
    for item, verdict in zip(fresh, verdicts):
        if not (verdict.get("ok") and verdict.get("required")):
            handled[str(item["comment_id"])] = {"promotion": number, "action": "ignored",
                                                "reason": verdict.get("reasonCode") or "not a required role", "at": stamp}
    if not findings:
        save_state(state)
        return
    comment_ids = [item["comment_id"] for item in findings]
    decision = decide(chain, findings, state["rounds"].get(base, 0))
    if decision["action"] == "revert":
        outcome = open_revert(promotion, decision["entry"], comment_ids)
        if outcome["status"] == "conflict":
            decision = {"action": "card", "kind": "revert-conflict",
                        "detail": f"Reverting #{decision['entry']['pr']} on develop conflicts: {outcome['detail']}"}
        else:
            if outcome["status"] == "opened":
                state["rounds"][base] = state["rounds"].get(base, 0) + 1
            for cid in comment_ids:
                handled[str(cid)] = {"promotion": number, "action": "revert",
                                     "revert": outcome["pr"].get("number"), "at": stamp}
            save_state(state)
            if outcome["status"] == "opened":
                log(f"promotion #{number}: opened revert #{outcome['pr'].get('number')} of "
                    f"#{decision['entry']['pr']} (release remediation, round {state['rounds'][base]})")
            return
    card = open_card(promotion, decision["kind"], decision["detail"], comment_ids)
    for cid in comment_ids:
        handled[str(cid)] = {"promotion": number, "action": "card", "kind": decision["kind"], "card": card, "at": stamp}
    save_state(state)
    log(f"promotion #{number}: NEEDS_FIX needs an operator ({decision['kind']}); card {card}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - cron should see a concise failure, not a traceback wall
        log(f"ERROR {type(exc).__name__}: {exc}")
        sys.exit(1)
