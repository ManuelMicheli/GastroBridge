# Cleanup Pass 1 — Design Spec

**Date:** 2026-04-19
**Branch:** `chore/cleanup-pass-1`
**Owner:** ManuelMicheli
**Status:** Approved — ready for plan

---

## Goal

Deliver a clean, well-organized, bug-free codebase where finding and changing code is fast. Zero regressions to current behavior.

## Non-Goals

- No new features.
- No design/UI changes.
- No database schema changes.
- No touching recent mobile work (commits from 2026-04-17 onward) with aggressive refactor.
- No changes to `migrations/`, `.env*`, `node_modules/`, `.next/`, `.claude/`, `memory/`.

## Scope Summary

Four sequential phases on a single feature branch, with a validation gate between each phase. Each phase has atomic commits. If any gate fails, roll back that phase before proceeding.

| Phase | Name | Risk | Est. Time | Gate |
|-------|------|------|-----------|------|
| A | Dead code + stray files | Low | 1–2 h | build + lint + tsc |
| C | Codemap + docs | Zero (no runtime change) | 2–3 h | build (sanity) |
| B | Structural refactor | Medium | Days | build + lint + tsc + test + **manual smoke test** |
| D | Bug hunt + strict mode | Variable | Variable | build + lint + tsc strict + test |

Phases run in order A → C → B → D. User approval required between phases.

---

## Phase A — Dead Code + Stray Files

### Inputs
- `knip` scan (unused files/exports/deps).
- `depcheck` scan (unused npm deps).
- `ts-prune` scan (unused TypeScript exports).
- `eslint --fix` with `no-unused-vars`.
- Manual grep for orphan components (no import referrer).

### Actions
1. Archive root cruft to `.archive/2026-04-19-cleanup/`:
   - `01_ristoratore_rebrand.md`
   - `02_fornitore_rebrand.md`
   - `spend-trend-chart-prompt.md`
   - `variante_1_financial_terminal.html`
   - `components/dashboard/supplier/revenue-line-chart.tsx` (if orphan — verify first)
2. Run `knip`, review output, delete unused files after confirming no dynamic import.
3. Run `depcheck`, remove genuinely unused deps (keep ones used via CLI/scripts).
4. Run `ts-prune`, remove unused exports.
5. Run `eslint --fix` for auto-fixable rules only.
6. Manual audit: any `*.old.tsx`, `*.backup.ts`, `_old/` dirs, commented-out blocks > 10 lines.

### Safety checks
- Every delete preceded by grep across `app/`, `components/`, `lib/`, `hooks/`, `pages/` (if any), `scripts/`.
- Check for dynamic `import()` with template strings.
- Check for string-based references (e.g., config loading by filename).
- When in doubt: archive, do not delete.

### Commits
- `chore(cleanup): archive root cruft files`
- `chore(cleanup): remove unused npm deps`
- `chore(cleanup): remove unused files (knip)`
- `chore(cleanup): remove unused exports (ts-prune)`
- `chore(cleanup): eslint --fix auto-fixable`
- `chore(cleanup): remove orphan components`

### Gate
```bash
bun run build
bun run lint
bunx tsc --noEmit
```
All green → push, user ack → proceed to Phase C.

---

## Phase C — Codemap + Docs

### Output Structure
```
docs/CODEMAPS/
├── README.md          # index + conventions + how to read
├── ristoratore.md     # app/(app)/* (restaurant area)
├── fornitore.md       # app/(supplier)/* (supplier area)
├── shared.md          # components/, lib/, hooks/, providers/
├── api.md             # app/api/* + server actions
├── db.md              # Supabase schema, RLS, migrations overview
└── mobile.md          # PWA chrome, responsive primitives, mobile overhaul
```

### Per-codemap sections
1. **Purpose** — one paragraph.
2. **Entry points** — layout, page, route files with one-line descriptions.
3. **Primary components** — table: file, responsibility, key props/hooks.
4. **Data flow** — how data enters/leaves (server action, client query, realtime).
5. **External dependencies** — npm packages specific to this area.
6. **Known pain points** — files > 400 LOC, duplicated logic, tangled state (feeds Phase B).
7. **"Where do I find X?"** — common tasks → file paths.

### Actions
1. Generate each codemap by reading code (no edits).
2. Update root `README.md`: add "Code navigation" section pointing at `docs/CODEMAPS/`.
3. Audit existing `docs/`: list stale files, show user before removing anything.
4. Update `memory/project_gastrobridge.md` pointer if needed.

### Commits
- `docs(codemap): add ristoratore.md`
- `docs(codemap): add fornitore.md`
- `docs(codemap): add shared.md`
- `docs(codemap): add api.md`
- `docs(codemap): add db.md`
- `docs(codemap): add mobile.md`
- `docs(codemap): index + README link`
- `docs(cleanup): remove stale docs (user-approved list)`

### Gate
```bash
bun run build   # sanity — docs shouldn't affect build
```
Green → proceed to Phase B.

---

## Phase B — Structural Refactor

### Criteria for "needs refactor"
- File > 400 LOC AND has multiple responsibilities.
- Same logic duplicated in 2+ places (extract shared util).
- Component with mixed server/client/presentational concerns.
- Inconsistent naming within a single module (pick one, apply).

### Explicit exclusions
- Any file changed in commits from **2026-04-17** onward (recent mobile/badge/mobile-overhaul work).
- Generated code (Supabase types, route manifests).
- Component libraries we don't own.

### Methodology
1. Generate candidate list from Phase C pain points + `cloc` / file-size scan.
2. Rank by impact × safety. Pick top 5 for this pass.
3. For each candidate:
   a. Write down current contract (props/exports/behavior).
   b. Plan split (what moves where, new file names).
   c. User ack on plan for that candidate.
   d. Implement refactor.
   e. Run gate. If green, commit. If red, revert.
   f. Request user smoke test of affected feature.
   g. Wait for "ok". Move to next candidate.

### Refactor patterns allowed
- Extract component → own file.
- Extract hook → `hooks/` or co-located `_hooks/`.
- Extract util → `lib/` or co-located `_lib/`.
- Merge duplicate components behind shared primitive.
- Rename for consistency (careful — may break external refs).

### Refactor patterns NOT allowed in this pass
- Changing public API of server actions (breaks callers).
- Changing database queries (touches runtime correctness).
- Introducing new abstractions "for the future".
- Restructuring directory hierarchy beyond single-file moves.

### Commits
- One commit per candidate refactor. Format: `refactor(<area>): <what> <why>`.

### Gate
```bash
bun run build
bun run lint
bunx tsc --noEmit
bun test          # if any tests exist
# + MANUAL: user tests login, dashboard ristoratore, dashboard fornitore, cerca, ordini detail, chat
```
All green + user "ok" → next candidate. Phase complete when top 5 done.

---

## Phase D — Bug Hunt + Strict Mode

### Actions
1. Enable `tsconfig` strict flags incrementally if not already on: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
2. Run `bunx tsc --noEmit --strict`. Fix type errors.
3. Run `eslint --max-warnings 0`. Fix or silence-with-comment warnings.
4. Grep `any` type annotations. Replace where trivial.
5. Grep `TODO|FIXME|HACK|XXX`. For each: fix inline, or document in an issue file `docs/TODO-tracker.md`.
6. Run `bun test`. Fix flaky/failing.

### Non-goals
- Not refactoring to satisfy strict — if a file needs major rewrite, note it and skip.
- Not adding tests (separate initiative).

### Commits
- `fix(types): <file> strict null checks`
- `fix(lint): <rule> <area>`
- `chore(types): replace any with <concrete> in <area>`
- `docs(todo): track pending FIXMEs`

### Gate
```bash
bun run build
bun run lint --max-warnings 0
bunx tsc --noEmit --strict
bun test
```
Green → merge PR.

---

## Safety Rails (all phases)

1. Branch created from clean main: `git checkout main && git pull && git checkout -b chore/cleanup-pass-1`.
2. Before each phase: `git status` must be clean.
3. Atomic commits with conventional-commit prefix.
4. Gate green → proceed. Gate red → `git reset --hard <last-good-sha>` and reassess.
5. **Never** `git push --force` on main. Never `--no-verify`. Never amend pushed commits.
6. **Never** touch: `.env*`, `migrations/*.sql`, `supabase/migrations/`, `node_modules/`, `.next/`, `.claude/`, `memory/`.
7. Between phases: snapshot SHA, user explicit "ok" to proceed.
8. Archive beats delete when uncertain.

## Acceptance Criteria

- All four phases complete.
- Final build green, lint green (max-warnings 0), tsc strict green, tests green.
- PR opened `chore/cleanup-pass-1 → main`, summary of removed LOC + new codemaps.
- User smoke-test passes on: login, restaurant dashboard, supplier dashboard, cerca, ordini, chat, mobile PWA.
- No behavioral changes reported for 24h after merge.

## Rollback Plan

Per phase:
- Tag SHA before phase start: `cleanup-pre-<phase>`.
- If issue found mid-phase: `git reset --hard cleanup-pre-<phase>`.
- If issue found post-merge: revert merge commit on main, re-open PR.

## Open Questions

None. Ready for implementation plan.
