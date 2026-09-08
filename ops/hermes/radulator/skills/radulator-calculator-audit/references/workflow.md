# One-calculator workflow

Use the current calculator record as the plan, evidence map and handoff. Do not
create a second status tracker. The owner performs source-based clinical review
before clinical changes and final acceptance afterward. Independent release
judges remain separate. Delegate only bounded work that reduces total effort.

## 1. Reconcile once

Read current `AGENTS.md`, calculator definition/core, shared renderer surfaces it
uses, tests, registry row, canonical record and linked receipt. Check Git status,
worktree list, relevant refs/PRs and current production identity in compact
batches. Search this calculator's ID and historical branch names, not all logs.
Compare content, not ancestry alone: squash merges can contain old branch work.
Record incorporated, still missing, superseded and unrelated work separately.

One active calculator worktree is normally sufficient. Preserve dirty or unique
work and unrelated branches. Retire a redundant clean checkout only after its
commits/evidence are retained and equivalence is established; no force removal.

## 2. Clinical plan before edits

Exercise the current calculator using synthetic inputs. Define users, clinical
question, population, inputs/units, outputs, exclusions, version and limitations.
List every computation, interpretation, risk estimate and management claim,
including copy/print text and contextual links.

Use these columns in the existing record:

| Claim/output | Current behavior | Required behavior | Source/version and exact locator | Independent expected cases | Gap/task and acceptance |
|---|---|---|---|---|---|
| One clinically meaningful rule per row | Observed, not assumed | Agreed supported scope | Equation/table/page/statement; availability and review date | Normal, boundary, exclusion and invalid cases | Small allowed-file task, or no change needed |

### Research and US-guideline alignment

- Review derivation/validation research for equations, endpoints and populations.
  Separately review current applicable US guidelines for interpretation and
  management: e.g. ACR, AASLD, SIR or other relevant specialty bodies. Search the
  official current-version page and its updates/corrections; an older open paper
  alone cannot establish current guideline-directed management.
- Mark each recommendation **aligned**, **different population/version**,
  **material conflict**, **unsupported/access gap**, or **not a management
  recommendation**. “Not applicable” needs a scope reason, not an omitted check.
  Do not infer treatment eligibility or individual risk from a prognostic score.
- Record exact statements and relevant exclusions/qualifiers. A contextual risk
  factor is not a blanket contraindication. Genuine consequential conflicts go
  to the clinician with competing evidence and proposed presentation.
- Retrieve public research through the existing research CLI and source tools.
  Verify PMID/DOI/version, relevant notices and returned full-text scope. Use
  official publishers, PMC and legitimate institutional/author copies. Neither
  metadata, an abstract, a comparator, nor an AI answer proves unseen details.
- For access failure, try bounded legitimate alternatives and record the gap.
  Check independent-review-host access early. Do not remove an unsupported
  warning or alter expected answers to satisfy the gate. Withhold unsupported
  outputs while preserving supported functionality and reporting restrictions.
- Record reviewed claim/source fingerprints and retrieval identities. Reuse
  unchanged evidence within its scope; cached bytes do not preserve stale
  authorization. Do not commit full copyrighted sources or send patient data.

## 3. Implement and verify the actual surfaces

Write independent expected cases before changing behavior. Use focused failing
regressions, make the smallest repair, and verify failure then recovery.

| Surface | Applicable checks |
|---|---|
| Math | Normal examples; every decision-changing boundary and interaction; raw versus displayed rounding; conversions without intermediate rounding |
| Inputs | Missing/blank/invalid units; entire-string parsing; zero/negative/nonfinite/extreme values; overflow/underflow; applicability exclusions |
| Independence | Source-derived answers; representative deliberate rule mutations fail relevant tests, then restore and rerun |
| Form/state | Conditional inputs, validation, edits invalidate results, recovery, reset and unit-switch semantics |
| Clinical usefulness | Outputs answer intended question; necessary inputs present; limitations concise; selector not mislabeled as inference |
| Reports | Warning precedence; units/assumptions/precision retained in actual clipboard text; all required reference links resolve |
| Browser | Desktop/mobile screenshots and real calculations; no overflow; keyboard behavior; console/page errors; required actions asserted non-optionally |
| Printing | Generate representative normal/warning PDFs, render and inspect all pages for clipping, overlap, contrast and missing output; native printing separate |
| Privacy | Synthetic canaries in search/form/results; inspect/intercept actual requests and logs, including a blocked negative control; verify production configuration |
| Tracking | Registry/record/test consistency; regenerated inventory; review date is not deployment date |

Keep successful dependency installs while lockfile/runtime are unchanged. Run
focused checks while editing and the required full suite on the finalized
candidate. Capture counts of passed/failed/skipped/flaky tests honestly. Do not
repeat unchanged full runs without an invalidation reason; clinical mutation
checks and a final release suite serve different purposes.

## 4. Tool routing, not another harness

Resolve commands in the current checkout's `package.json` before execution.
These existing routes were available in the 2026-09-08 control candidate; a
command in an unmerged worktree is not automatically available on production.

```sh
git status --short --branch
git worktree list --porcelain
gh pr view <PR> --json headRefOid,baseRefName,state,statusCheckRollup,labels
npm run research -- fetch <PMID> --expect-doi <DOI> --full-text
npm run research -- verify <absolute-record-json-path>
npm run build
npm run lint
npm run check:invariants
node scripts/calculator-verification-inventory.mjs
```

Research details: `docs/development/research-access.md`. Run the actual focused
compute/test commands discovered for this calculator and any changed metadata
consumer. For browser tests, use the existing Playwright config, a dedicated
worktree port and production-built preview when supported. Do not reuse another
checkout's server. The compact `qa:local` runner was deferred in the control
candidate; check current availability instead of inventing it.

Keep detailed receipts/PDFs/screenshots outside removable worktrees (Git common
directory or an existing evidence store). Read summaries/failures first, not
multi-megabyte traces. Use batched GitHub state and completion events rather than
continuous polling. Optional plugins need a demonstrated retrieval/QA benefit.

## 5. Release and close without reopening history

Read current trusted release mode and branch protections. Keep clinical changes
separate from control changes. Freeze head and evidence before final CI/review;
head/base/evidence changes invalidate the applicable checks/signatures. Read back
required exact-head CI and independent signed decisions. A blocked reviewer is
not permission to self-sign, bypass, force-publish or manually merge.

Trace approved candidate → protected merged source → production-built/tested
artifact → deployment → live revision. Preserve already-live privacy/hotfixes
when the production merge combines a different base. Simulated merges are useful
preflight evidence, not deployed proof. Test changed-calculator live behavior,
reports and synthetic privacy at the actual released identity.

Update the existing canonical record and its authoritative release companion.
Use a linked post-commit receipt where needed rather than another code release
only to stamp the previous SHA. Record source/head/artifact IDs, CI/signature/
deployment links, actual live results, limitations and worktree disposition.
Read back the receipt. An absent/incomplete receipt remains open; a completed
receipt closes only its stated supported scope.

Mark superseded notes with a canonical pointer and preserve history. New work
starts from current protected source, reopening only affected rows for an actual
source change, defect or approved extension. Do not rebuild a calculator because
an archived checklist says “pending.” See `hermes-lifecycle.md` before claiming
that remote planning and learning also recognize closure.
