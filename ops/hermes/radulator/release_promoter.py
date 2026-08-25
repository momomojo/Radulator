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

Cron: every 10 minutes in no_agent mode; empty stdout when nothing to do.
"""

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

    bound_branch = ensure_promotion_branch(main_sha, develop_sha)
    if bound_branch != release_branch:
        raise RuntimeError("promotion branch does not match desired exact heads")

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
    res = run(["gh", "pr", "create", "--repo", REPO, "--base", "main",
               "--head", release_branch,
               "--title", f"release: promote develop to main ({len(commits)} changes)",
              "--body", body, "--label", f"{PROMO_LABEL},{GATE_LABEL}"],
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
