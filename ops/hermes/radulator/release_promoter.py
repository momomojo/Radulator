#!/usr/bin/env python3
"""Release promoter: opens scoped develop->main promotion PRs (release train).

Deterministic trigger, judgment elsewhere: this script only decides WHEN a
batch is ripe (rule below); the signed Hermes gate reviews the batch and the
trusted controller merges it. The controller then explicitly dispatches the
deployment workflow. Feature work never touches main directly (AGENTS.md
branch model).

Ripeness rule: develop ahead of main by >=1 commit. Approved work enters the
protected production gate immediately instead of waiting in a passive batch
window. Production promotions use a temporary release branch whose merge
commit has the current main and exact develop heads as parents. When develop
advances, an obsolete open promotion is superseded only after the replacement
promotion has been created and authoritatively read back. This keeps
protected-branch strict checks current without an unsafe direct back-merge
into develop or a passive stale-PR hold. A conflicting main hotfix remains
visible as a normal merge conflict for remediation.

Batched promotions: when the repository variable RADULATOR_BATCH_PROMOTIONS_ENABLED
is exactly "true", approved PRs accumulate on develop in bounded batches (the
trusted controller admits them) and this promoter opens the promotion only when
the batch is ripe: a release-urgent PR is in it or approved and waiting, it
holds N PRs or M high-risk clinical PRs, its oldest PR has waited 2 hours, or
it is quiet (20 minutes since the last merge and no approved develop PR). It
verifies the promotion chain with main's scripts/promotion-chain.mjs against
the fleet public keys; an unverified chain opens the promotion with the
promotion-full-review label, and a mixed-domain batch is never opened (one
alert instead). Any other value, or an unreadable variable, keeps the
single-release behaviour above.

Cron: every 10 minutes in no_agent mode; empty stdout when nothing to do.
"""

import contextlib
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.dirname(SCRIPT_DIR)
REPO = "momomojo/Radulator"
# Keep unattended cron work outside macOS's TCC-protected Documents tree.
# The scheduler's process-attribution chain can lose Documents access even
# while an interactive shell still has it. Allow an explicit override for
# diagnostics and migrations without changing code again.
CLONE = os.environ.get(
    "RADULATOR_RELEASE_PROMOTER_CLONE",
    os.path.join(PROFILE_DIR, "workspace", "release-promoter-repo"),
)
BATCH_MIN = 1
MAX_AGE_DAYS = 0
PROMO_LABEL = "promotion"
GATE_LABEL = "ready-for-gate"
RELEASE_BRANCH_PREFIX = "release/promote"
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")

# Batched promotions (plan A2, section 2.5).
BATCH_MODE_VARIABLE = "RADULATOR_BATCH_PROMOTIONS_ENABLED"
BATCH_WINDOW_SECONDS = 2 * 60 * 60
BATCH_QUIET_SECONDS = 20 * 60
FULL_REVIEW_LABEL = "promotion-full-review"
URGENT_LABEL = "release-urgent"
GATE_AUTHORIZATION_CONTEXT = "Radulator Clinical Release Authorization"
CHAIN_SCHEMA = "radulator-promotion-chain/v1"
BATCH_MARKER = "<!-- radulator-batch-promotion/v1 -->"
PUBLIC_KEYS_FILE = os.environ.get(
    "RADULATOR_JUDGE_PUBLIC_KEYS_FILE",
    os.path.join(PROFILE_DIR, "keys", "radulator-clinical", "public-keys.json"),
)
ALERT_STATE = os.path.join(PROFILE_DIR, "state", "radulator-release-promoter-alerts.json")
SHARED_CLINICAL_INFRASTRUCTURE = (
    "src/components/forms/",
    "src/components/display/",
    "src/components/ui/",
    "src/context/",
    "src/hooks/",
    "src/lib/reportSnippets.js",
    "src/App.jsx",
    "src/main.jsx",
    "src/components/StaticCalculatorShell.jsx",
)
GUIDELINE_REGISTRY_SUFFIX = "guideline-versions.json"
CALCULATOR_PREFIX = "src/components/calculators/"
# Mirrors scripts/release-policy.mjs: a promotion body must never declare high risk by itself.
EXPLICIT_HIGH_RISK_PATTERN = re.compile(
    r"(?:<!--\s*radulator-risk\s*:\s*high\s*-->|"
    r"^\s*(?:radulator[-_ ]*)?(?:clinical[-_ ]*)?risk(?:[-_ ]*tier)?\s*:\s*high\s*$)",
    re.IGNORECASE | re.MULTILINE,
)


def log(msg):
    print(f"[release-promoter] {msg}")


def run(args, cwd=CLONE, check=True, timeout=300):
    try:
        res = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                             timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        cmd = " ".join(args[:4])
        raise RuntimeError(f"{cmd} timed out after {timeout}s") from exc
    if check and res.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:4])} failed: {res.stderr.strip()[:300]}")
    return res


def fetch_refs():
    """Fetch main/develop with one retry so transient GitHub stalls do not dump tracebacks."""
    last_error = None
    for attempt in range(1, 3):
        try:
            return run(["git", "fetch", "-q", "origin", "main", "develop"], timeout=180)
        except RuntimeError as exc:
            last_error = exc
            if attempt == 1:
                log(f"fetch failed once ({exc}); retrying")
                continue
    raise RuntimeError(f"fetch failed after retry: {last_error}")


def rev_parse(ref):
    return run(["git", "rev-parse", ref]).stdout.strip()


def promotion_branch(main_sha, develop_sha):
    return f"{RELEASE_BRANCH_PREFIX}-{main_sha[:12]}-{develop_sha[:12]}"


def open_promotions():
    existing = run(["gh", "pr", "list", "--repo", REPO, "--base", "main",
                    "--state", "open", "--label", PROMO_LABEL,
                    "--json", "number,url,headRefName,headRefOid"]).stdout
    return json.loads(existing)


def open_promotion_for_branch(branch, attempts=4, delay_seconds=1):
    """Read back an exact-head PR, tolerating brief GitHub index lag."""
    for attempt in range(attempts):
        existing = run(["gh", "pr", "list", "--repo", REPO, "--base", "main",
                        "--head", branch, "--state", "open",
                        "--json", "number,url,headRefName"]).stdout
        matches = json.loads(existing)
        if len(matches) > 1:
            raise RuntimeError(f"multiple open promotion PRs found for {branch}")
        if matches:
            return matches[0]
        if attempt + 1 < attempts:
            time.sleep(delay_seconds)
    return None


def _json_command(args):
    result = run(args)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"malformed JSON readback from {' '.join(args[:4])}") from exc


def delete_closed_promotion_branch(promotion, desired_branch):
    """Delete one exact closed promotion ref with an atomic expected-SHA lease."""
    number = promotion.get("number")
    branch = promotion.get("headRefName")
    expected_sha = promotion.get("headRefOid")
    if (
        not isinstance(number, int)
        or number <= 0
        or not isinstance(branch, str)
        or not branch.startswith(f"{RELEASE_BRANCH_PREFIX}-")
        or branch == desired_branch
        or not isinstance(expected_sha, str)
        or not SHA_PATTERN.fullmatch(expected_sha)
    ):
        raise RuntimeError("superseded promotion identity is incomplete or unsafe")

    closed = _json_command([
        "gh", "pr", "view", str(number), "--repo", REPO,
        "--json", "number,state,mergedAt,headRefName,headRefOid,baseRefName",
    ])
    if (
        closed.get("number") != number
        or closed.get("state") != "CLOSED"
        or closed.get("mergedAt") is not None
        or closed.get("baseRefName") != "main"
        or closed.get("headRefName") != branch
        or closed.get("headRefOid") != expected_sha
    ):
        log(f"preserving {branch}: authoritative PR readback is not the exact closed promotion")
        return False

    repository = _json_command(["gh", "api", f"repos/{REPO}"])
    branch_state = _json_command(["gh", "api", f"repos/{REPO}/branches/{branch}"])
    if repository.get("default_branch") == branch or branch_state.get("protected") is not False:
        log(f"preserving {branch}: branch is default or protected")
        return False
    if branch_state.get("name") != branch or branch_state.get("commit", {}).get("sha") != expected_sha:
        log(f"preserving {branch}: ref advanced after the promotion closed")
        return False

    open_for_branch = _json_command([
        "gh", "pr", "list", "--repo", REPO, "--head", branch,
        "--state", "open", "--json", "number,headRefOid",
    ])
    if not isinstance(open_for_branch, list):
        raise RuntimeError(f"open PR readback for {branch} is malformed")
    if open_for_branch:
        log(f"preserving {branch}: an open PR still uses the ref")
        return False

    lease = f"--force-with-lease=refs/heads/{branch}:{expected_sha}"
    deletion = run(["git", "push", lease, "origin", "--delete", branch], check=False)
    if deletion.returncode != 0:
        raise RuntimeError(
            f"exact-SHA deletion failed for {branch}: "
            f"{(deletion.stderr or deletion.stdout).strip()[:300]}"
        )
    remaining = run([
        "git", "ls-remote", "--heads", "origin", f"refs/heads/{branch}",
    ]).stdout.strip()
    if remaining:
        raise RuntimeError(f"deleted promotion ref still exists after readback: {branch}")
    log(f"deleted superseded closed promotion ref {branch} at {expected_sha}")
    return True


def close_superseded_promotions(promotions, desired_branch, replacement):
    """Close obsolete promotions, then delete only their exact closed refs."""
    replacement_url = replacement.get("url")
    if replacement.get("headRefName") != desired_branch or not replacement_url:
        raise RuntimeError("replacement promotion readback does not match desired branch")
    for promotion in promotions:
        if promotion.get("headRefName") == desired_branch:
            continue
        number = promotion.get("number")
        if not isinstance(number, int) or number <= 0:
            raise RuntimeError("open promotion readback has an invalid PR number")
        message = (
            f"Superseded by {replacement_url} because develop advanced. "
            "The replacement binds the current exact main/develop heads and "
            "continues through the protected production gate automatically."
        )
        result = run(["gh", "pr", "close", str(number), "--repo", REPO,
                      "--comment", message], check=False)
        if result.returncode != 0:
            raise RuntimeError(
                f"failed to close superseded promotion #{number}: "
                f"{result.stderr.strip()[:300]}"
            )
        delete_closed_promotion_branch(promotion, desired_branch)


def exact_promotion_attempt_exists(branch):
    """Do not reopen a closed/rejected promotion for the same exact pair."""
    attempts = run(["gh", "pr", "list", "--repo", REPO, "--base", "main",
                    "--head", branch, "--state", "all",
                    "--json", "number,state"]).stdout
    return bool(json.loads(attempts))


def ensure_promotion_branch(main_sha, develop_sha):
    """Return a remote branch whose tip directly joins exact main/develop."""
    branch = promotion_branch(main_sha, develop_sha)
    remote_ref = f"refs/remotes/origin/{branch}"
    remote = run(["git", "ls-remote", "--heads", "origin",
                  f"refs/heads/{branch}"]).stdout.strip()
    if remote:
        run(["git", "fetch", "-q", "origin", branch])
        tip = rev_parse(remote_ref)
        parents = run(["git", "show", "-s", "--format=%P", tip]).stdout.split()
        if parents[:2] != [main_sha, develop_sha]:
            raise RuntimeError(f"existing {branch} does not bind the current exact heads")
        return branch

    with tempfile.TemporaryDirectory(prefix="radulator-promotion-") as worktree:
        run(["git", "worktree", "add", "--detach", worktree, main_sha])
        try:
            run(["git", "-c", "user.name=Radulator Release Promoter",
                 "-c", "user.email=actions@users.noreply.github.com",
                 "merge", "--no-ff", "--no-edit", develop_sha], cwd=worktree)
            tip = run(["git", "rev-parse", "HEAD"], cwd=worktree).stdout.strip()
            parents = run(["git", "show", "-s", "--format=%P", tip],
                          cwd=worktree).stdout.split()
            if parents[:2] != [main_sha, develop_sha]:
                raise RuntimeError("promotion commit does not bind exact main/develop heads")
            run(["git", "push", "-q", "origin",
                 f"HEAD:refs/heads/{branch}"], cwd=worktree)
        finally:
            run(["git", "worktree", "remove", "--force", worktree],
                check=False)
    return branch


def batch_mode():
    """Read the owner's switch. Anything but an exact "true" or "shadow" is "disabled".

    Only "true" changes this promoter; "shadow" is logged by the merge controller. Any
    failure to read the variable (unset, network, CLI) keeps single-release promotions.
    """
    try:
        res = run(["gh", "variable", "get", BATCH_MODE_VARIABLE, "--repo", REPO],
                  check=False, timeout=60)
    except Exception:  # noqa: BLE001 - an unreadable switch keeps today's behaviour
        return "disabled"
    if res.returncode != 0:
        return "disabled"
    value = (res.stdout or "").strip()
    return value if value in ("true", "shadow") else "disabled"


@contextlib.contextmanager
def main_worktree(main_sha):
    """A detached worktree of exact main: the chain verifier always runs trusted main code."""
    with tempfile.TemporaryDirectory(prefix="radulator-chain-") as worktree:
        run(["git", "worktree", "add", "--detach", worktree, main_sha])
        try:
            yield worktree
        finally:
            run(["git", "worktree", "remove", "--force", worktree], check=False)


def verify_chain(worktree, main_sha, develop_sha=None, promotion_sha=None):
    """Run main's promotion-chain verifier against the fleet judge public keys."""
    args = ["node", os.path.join(worktree, "scripts", "promotion-chain.mjs"),
            "--repo", REPO, "--main", main_sha, "--public-keys-file", PUBLIC_KEYS_FILE]
    if develop_sha:
        args += ["--develop", develop_sha]
    if promotion_sha:
        args += ["--promotion", promotion_sha]
    res = run(args, cwd=worktree, check=False, timeout=300)
    if res.returncode != 0:
        raise RuntimeError(f"promotion chain verifier failed: {(res.stderr or res.stdout).strip()[:300]}")
    try:
        chain = json.loads(res.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("promotion chain verifier returned malformed JSON") from exc
    if not isinstance(chain, dict) or chain.get("schema") != CHAIN_SCHEMA:
        raise RuntimeError("promotion chain verifier returned an unexpected schema")
    return chain


def approved_develop_prs():
    """Open develop PRs whose exact head carries a successful gate authorization."""
    raw = run(["gh", "pr", "list", "--repo", REPO, "--base", "develop", "--state", "open",
               "--limit", "100", "--json", "number,labels,statusCheckRollup"]).stdout
    approved = []
    for pr in json.loads(raw):
        rollup = pr.get("statusCheckRollup") or []
        if any(item.get("context") == GATE_AUTHORIZATION_CONTEXT and item.get("state") == "SUCCESS"
               for item in rollup):
            approved.append({
                "number": pr.get("number"),
                "labels": [label.get("name") for label in pr.get("labels") or []],
            })
    return approved


def _timestamp(value):
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def batch_ripeness(chain, now, approved, replacing):
    """Return why a verified batch should be promoted now; an empty list means wait."""
    counts = chain.get("counts") or {}
    policy = chain.get("policy") or {}
    reasons = []
    if replacing:
        reasons.append("develop advanced while a promotion was open")
    if counts.get("urgent", 0) > 0:
        reasons.append("a release-urgent PR is in the batch")
    if any(URGENT_LABEL in (pr.get("labels") or []) for pr in approved):
        reasons.append("an approved release-urgent PR is waiting to release alone")
    max_prs = policy.get("maxPrs") or 1
    max_high = policy.get("maxHighRiskClinical") or 1
    if counts.get("nonRemediation", 0) >= max_prs:
        reasons.append(f"the batch is full ({counts.get('nonRemediation', 0)} of {max_prs} PRs)")
    if counts.get("highRiskClinical", 0) >= max_high:
        reasons.append(f"it holds {counts.get('highRiskClinical', 0)} of {max_high} high-risk clinical PRs")
    first = _timestamp(chain.get("firstMergedAt"))
    last = _timestamp(chain.get("lastMergedAt"))
    if first is None or now - first >= BATCH_WINDOW_SECONDS:
        reasons.append("its oldest PR has waited 2 hours")
    if last is not None and now - last >= BATCH_QUIET_SECONDS and not approved:
        reasons.append("it is quiet (20 minutes since the last merge and no approved develop PR)")
    return reasons


def alert_once(key, message):
    """Print an alert once per key, so the every-10-minutes cron does not repeat it."""
    try:
        with open(ALERT_STATE, encoding="utf-8") as handle:
            state = json.load(handle)
    except (OSError, ValueError):
        state = {}
    if isinstance(state, dict) and state.get("last") == key:
        return False
    log(message)
    os.makedirs(os.path.dirname(ALERT_STATE), exist_ok=True)
    temporary = f"{ALERT_STATE}.tmp-{os.getpid()}"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump({"last": key, "at": int(time.time())}, handle)
    os.replace(temporary, ALERT_STATE)
    return True


def plan_batch_promotion(main_sha, develop_sha, commit_times, replacing, now=None):
    """Decide whether to open a batch promotion now; None means wait (or never, with an alert)."""
    now = time.time() if now is None else now
    with main_worktree(main_sha) as worktree:
        chain = verify_chain(worktree, main_sha, develop_sha=develop_sha)
    if not chain.get("ok"):
        reason = chain.get("reasonCode") or "unknown"
        if reason == "BATCH_DOMAIN_MIXED":
            alert_once(
                f"domain-mixed:{develop_sha}",
                f"ALERT develop {develop_sha[:12]} mixes clinical and release-control PRs; not "
                "opening a promotion. Revert one domain with a release-remediation PR.",
            )
            return None
        oldest = min(commit_times) if commit_times else now
        if reason == "CHAIN_EVIDENCE_UNAVAILABLE" and not replacing and now - oldest < BATCH_WINDOW_SECONDS:
            return None  # likely transient: retried every run until the 2-hour window closes
        return {"chain": chain, "full_review": True,
                "why": f"the promotion chain is not verified ({reason})"}
    reasons = batch_ripeness(chain, now, approved_develop_prs(), replacing)
    if not reasons:
        return None
    return {"chain": chain, "full_review": False, "why": "; ".join(reasons)}


def remote_branch_sha(branch):
    line = run(["git", "ls-remote", "--heads", "origin", f"refs/heads/{branch}"]).stdout.strip()
    sha = line.split()[0] if line else ""
    if not SHA_PATTERN.fullmatch(sha):
        raise RuntimeError(f"promotion branch {branch} has no exact remote head")
    return sha


def _cell(text, limit=110):
    """A single-line, table-safe cell that can never form an HTML comment or risk marker."""
    flat = " ".join(str(text or "").split())[:limit]
    return flat.replace("\\", "\\\\").replace("|", "\\|").replace("<", "&lt;").replace(">", "&gt;")


def _paths(paths, limit=40):
    paths = list(paths or [])
    if not paths:
        return "none"
    shown = ", ".join(f"`{_cell(path, 200)}`" for path in paths[:limit])
    return shown + (f", and {len(paths) - limit} more" if len(paths) > limit else "")


def batch_pr_fields(plan, chain, commit_prs):
    """Title, body and labels for a batch promotion. The body is never edited afterwards."""
    entries = chain.get("entries") or []
    prs = [entry.get("pr") for entry in entries] if chain.get("ok") else list(commit_prs)
    full_review = plan["full_review"] or not chain.get("ok")
    why = plan["why"]
    if not chain.get("ok") and not plan["full_review"]:
        why = f"the promotion chain is not verified ({chain.get('reasonCode') or 'unknown'})"
    numbers = ", ".join(f"#{number}" for number in prs)
    noun = "PR" if len(prs) == 1 else "PRs"
    title = f"release: promote develop to main ({len(prs)} {noun}: {numbers})"
    if len(title) > 240:
        title = title[:238] + "…)"
    files = sorted({path for entry in entries for path in entry.get("files") or []})
    shared = [path for path in files
              if path.startswith(SHARED_CLINICAL_INFRASTRUCTURE) or path.endswith(GUIDELINE_REGISTRY_SUFFIX)]
    calculators = [path for path in files if path.startswith(CALCULATOR_PREFIX)]
    lines = [
        f"Automated batch promotion (release train): {len(prs)} {noun}.",
        "",
        (f"**Review mode: FULL REVIEW.** {why[0].upper() + why[1:]}. Review this promotion like any "
         "high-risk PR, over its whole diff."
         if full_review else
         "**Review mode: BATCH.** The promotion chain is verified; judges follow \"Release "
         "promotions\" in the radulator-clinical-judge skill."),
        "",
    ]
    if not full_review:
        lines += [f"Promoted now because {why}.", ""]
    if chain.get("ok"):
        lines += [
            "## Batch",
            "",
            "| PR | Title | Squash | Head | Base | Tier | Domain | Labels | Judges |",
            "|---|---|---|---|---|---|---|---|---|",
        ]
        for entry in entries:
            number = entry.get("pr")
            judges = ", ".join(
                f"[{_cell(role.get('role'), 20)}](https://github.com/{REPO}/pull/{number}"
                f"#issuecomment-{role.get('commentId')})"
                for role in entry.get("roles") or []
            )
            lines.append(
                f"| #{number} | {_cell(entry.get('title'))} | `{str(entry.get('squash'))[:7]}` "
                f"| `{str(entry.get('head'))[:7]}` | `{str(entry.get('base'))[:7]}` "
                f"| {_cell(entry.get('tier'), 20)} | {_cell(entry.get('domain'), 20)} "
                f"| {_cell(', '.join(entry.get('labels') or []), 80)} | {judges} |"
            )
        lines += [
            "",
            "## Integration focus",
            "",
            f"- Files changed by two or more PRs: {_paths(chain.get('overlappingFiles'))}",
            f"- Paths merged three ways with main drift (review fully): {_paths(chain.get('integrationMergedPaths'))}",
            f"- Shared clinical infrastructure touched: {_paths(shared)}",
            f"- Calculators changed: {_paths(calculators)}",
            "",
        ]
    lines += [
        "## Required at the promotion head",
        "",
        "`Smoke Tests`, `Targeted Calculator Tests`, `Full Test Suite`, and `Clinical Source "
        "Audits (exact head)` with every audit selected (mode `all`) and passing.",
        "",
        "## Batch rubric",
        "",
        "Judges: end each blocking finding with exactly one attribution line: "
        "`Batch attribution: #<pr>[, #<pr>]`, `Batch attribution: integration`, "
        "`Batch attribution: main-drift`, or `Batch attribution: chain`. A finding attributed to "
        "one PR of a batch of two or more is reverted from develop first; the rest of the batch "
        "then releases and the fix re-lands in a later batch.",
        "",
    ]
    manifest = {
        "schema": "radulator-batch-promotion/v1",
        "review_mode": "full" if full_review else "batch",
        "chain_ok": bool(chain.get("ok")),
        "chain_reason": chain.get("reasonCode"),
        "chain_digest": chain.get("digest"),
        "main": chain.get("M"),
        "develop": chain.get("D"),
        "merge_base": chain.get("S0"),
        "promotion": chain.get("P"),
        "entries": [
            {key: entry.get(key) for key in ("pr", "squash", "head", "base", "tier", "domain", "remediation", "urgent")}
            for entry in entries
        ],
        "overlapping_files": chain.get("overlappingFiles") or [],
        "integration_merged_paths": chain.get("integrationMergedPaths") or [],
    }
    lines += [BATCH_MARKER, "```json", json.dumps(manifest, sort_keys=True, separators=(",", ":")), "```", "",
              "🤖 release_promoter.py (WF-9)"]
    body = "\n".join(lines)
    if EXPLICIT_HIGH_RISK_PATTERN.search(f"{title}\n{body}"):
        raise RuntimeError("batch promotion body would declare high risk; refusing to open it")
    labels = [PROMO_LABEL, GATE_LABEL] + ([FULL_REVIEW_LABEL] if full_review else [])
    return title, body, ",".join(labels)


def commit_pr_numbers(commits):
    numbers = []
    for line in commits:
        match = re.search(r"PR #(\d+): exact-head clinical gate passed", line)
        if match:
            numbers.append(int(match.group(1)))
    return sorted(set(numbers))


def main():
    fetch_refs()

    main_sha = rev_parse("origin/main")
    develop_sha = rev_parse("origin/develop")

    ahead_raw = run(["git", "rev-list", "--format=%ct %h %s", "--no-merges",
                     "origin/main..origin/develop"]).stdout
    commits = [l for l in ahead_raw.splitlines() if not l.startswith("commit ")]
    if not commits:
        return

    oldest_ts = min(int(l.split()[0]) for l in commits)
    age_days = (datetime.datetime.now(datetime.timezone.utc).timestamp()
                - oldest_ts) / 86400
    if len(commits) < BATCH_MIN and age_days < MAX_AGE_DAYS:
        return

    release_branch = promotion_branch(main_sha, develop_sha)
    promotions = open_promotions()
    current = next(
        (promotion for promotion in promotions
         if promotion.get("headRefName") == release_branch),
        None,
    )
    if current:
        close_superseded_promotions(promotions, release_branch, current)
        return

    if exact_promotion_attempt_exists(release_branch):
        return

    batch = None
    if batch_mode() == "true":
        commit_times = [int(l.split()[0]) for l in commits]
        batch = plan_batch_promotion(main_sha, develop_sha, commit_times, replacing=bool(promotions))
        if batch is None:
            return

    bound_branch = ensure_promotion_branch(main_sha, develop_sha)
    if bound_branch != release_branch:
        raise RuntimeError("promotion branch does not match desired exact heads")

    if batch is None:
        listing = "\n".join("- " + " ".join(l.split()[1:])[:110] for l in commits[:30])
        body = (
            f"Automated release-train promotion: {len(commits)} change(s), "
            f"oldest {age_days:.1f} days.\n\n## Batch\n{listing}\n\n"
            "Full Test Suite runs automatically (PR targets main). Gate: review "
            "this as a RELEASE — batch-level regression classes, coherence, and "
            "anything in the batch that individually passed develop CI but "
            "interacts badly together.\n\n"
            "🤖 release_promoter.py (WF-9)"
        )
        title = f"release: promote develop to main ({len(commits)} changes)"
        labels = f"{PROMO_LABEL},{GATE_LABEL}"
    else:
        # The pushed promotion head's own chain adds the content proof (integration paths).
        head_sha = remote_branch_sha(release_branch)
        with main_worktree(main_sha) as worktree:
            chain = verify_chain(worktree, main_sha, develop_sha=develop_sha, promotion_sha=head_sha)
        title, body, labels = batch_pr_fields(batch, chain, commit_pr_numbers(commits))
    res = run(["gh", "pr", "create", "--repo", REPO, "--base", "main",
               "--head", release_branch,
               "--title", title,
              "--body", body, "--label", labels],
              check=False)
    replacement = open_promotion_for_branch(release_branch)
    if replacement is None and res.returncode != 0:
        log(f"ERROR opening promotion PR: {res.stderr.strip()[:300]}")
        sys.exit(1)
    if replacement is None:
        raise RuntimeError("promotion PR creation succeeded but open PR readback failed")

    close_superseded_promotions(promotions, release_branch, replacement)
    log(f"promotion PR opened: {replacement['url']} "
        f"({len(commits)} changes)")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - cron should see concise failure, not a traceback wall
        log(f"ERROR {type(exc).__name__}: {exc}")
        sys.exit(1)
