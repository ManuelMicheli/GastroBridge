# Cleanup Pass 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a clean, well-organized, bug-free codebase with zero behavioral regressions via four sequential phases on branch `chore/cleanup-pass-1`.

**Architecture:** Four phases (A dead code → C codemaps → B structural refactor → D strict types/lint) with a validation gate and user approval between each. Each phase is a series of atomic commits; failures trigger immediate rollback to a tagged SHA.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Tailwind v4, Supabase, Bun runtime, ESLint 9 (flat config), Prettier. No test framework present — gates rely on build + lint + tsc + manual smoke.

---

## Pre-Flight — Branch Setup

### Task 0: Create cleanup branch from clean main

**Files:**
- None created. Git state change only.

- [ ] **Step 0.1: Verify working tree clean**

```bash
git status --short
```
Expected: empty output. If not empty — stop, commit or stash before proceeding.

- [ ] **Step 0.2: Ensure main is up to date**

```bash
git checkout main
git pull --ff-only origin main
```
Expected: "Already up to date" or fast-forward success.

- [ ] **Step 0.3: Create cleanup branch**

```bash
git checkout -b chore/cleanup-pass-1
```
Expected: "Switched to a new branch 'chore/cleanup-pass-1'".

- [ ] **Step 0.4: Tag pre-phase-A snapshot**

```bash
git tag cleanup-pre-a
```
Expected: no output. Verify with `git tag | grep cleanup`.

- [ ] **Step 0.5: Baseline build + lint + tsc**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```
Expected: all succeed. If any fail on a clean main — STOP. Report baseline failure before making any changes. Do not proceed with cleanup over broken baseline.

---

## Phase A — Dead Code + Stray Files

Goal: remove unused files, exports, deps, and root cruft. Zero runtime behavior change.

### Task A1: Archive root cruft

**Files:**
- Create: `.archive/2026-04-19-cleanup/` directory
- Move: `01_ristoratore_rebrand.md`, `02_fornitore_rebrand.md`, `spend-trend-chart-prompt.md`, `variante_1_financial_terminal.html`

- [ ] **Step A1.1: Create archive directory**

```bash
mkdir -p .archive/2026-04-19-cleanup
```

- [ ] **Step A1.2: Verify cruft files unreferenced**

```bash
# Grep for any code reference to these filenames
grep -rn "01_ristoratore_rebrand\|02_fornitore_rebrand\|spend-trend-chart-prompt\|variante_1_financial_terminal" \
  --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
```
Expected: no matches. If any match found, investigate before moving.

- [ ] **Step A1.3: Move cruft to archive**

```bash
git mv 01_ristoratore_rebrand.md .archive/2026-04-19-cleanup/
git mv 02_fornitore_rebrand.md .archive/2026-04-19-cleanup/
git mv spend-trend-chart-prompt.md .archive/2026-04-19-cleanup/
git mv variante_1_financial_terminal.html .archive/2026-04-19-cleanup/
```

- [ ] **Step A1.4: Add .archive/ to .gitignore considerations**

Read `.gitignore` first. If `.archive/` should be tracked (recoverable cruft), do nothing. If user prefers untracked, add `.archive/` line. Default: track it (safer, visible in history).

- [ ] **Step A1.5: Build check**

```bash
bun run build
```
Expected: success. Moving markdown/html files must not affect build.

- [ ] **Step A1.6: Commit**

```bash
git add .archive/
git commit -m "chore(cleanup): archive stray root files to .archive/2026-04-19-cleanup/"
```

### Task A2: Check orphan component `components/dashboard/supplier/revenue-line-chart.tsx`

**Files:**
- Possibly remove: `components/dashboard/supplier/revenue-line-chart.tsx`

- [ ] **Step A2.1: Search for references**

```bash
grep -rn "revenue-line-chart\|RevenueLineChart" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
```
Expected: either only the file itself → orphan, or real importers. If importers exist, leave it and note in spec that it's NOT orphan.

- [ ] **Step A2.2a: If orphan — archive**

```bash
git mv components/dashboard/supplier/revenue-line-chart.tsx .archive/2026-04-19-cleanup/
```

- [ ] **Step A2.2b: If not orphan — skip this task, document in plan**

Write a one-line comment in the plan checkbox: "A2 skipped — file is imported by [list]".

- [ ] **Step A2.3: Build check**

```bash
bun run build
```
Expected: success.

- [ ] **Step A2.4: Commit (if moved)**

```bash
git commit -m "chore(cleanup): archive orphan revenue-line-chart component"
```

### Task A3: Install and run knip for unused file/export detection

**Files:**
- Modify: `package.json` (add knip devDep temporarily)
- Create: `knip.json` (config)

- [ ] **Step A3.1: Install knip**

```bash
bun add -D knip
```

- [ ] **Step A3.2: Create minimal knip.json**

Write file `knip.json`:
```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "app/**/{page,layout,loading,error,not-found,route,template,default}.{ts,tsx}",
    "app/**/{opengraph-image,twitter-image,icon,apple-icon,manifest,sitemap,robots}.{ts,tsx}",
    "middleware.ts",
    "next.config.*",
    "instrumentation.ts",
    "scripts/**/*.{ts,mjs,js}"
  ],
  "project": [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "providers/**/*.{ts,tsx}",
    "types/**/*.{ts,tsx}"
  ],
  "ignore": [
    "supabase/**",
    ".archive/**",
    "node_modules/**",
    ".next/**"
  ],
  "ignoreDependencies": []
}
```

- [ ] **Step A3.3: Run knip, capture report**

```bash
bunx knip --reporter json > .knip-report.json 2>&1 || true
bunx knip > .knip-report.txt 2>&1 || true
```
Expected: report generated (exit code non-zero is normal when issues found).

- [ ] **Step A3.4: Review report, classify findings**

Read `.knip-report.txt`. For each item categorize:
- **SAFE DELETE:** file explicitly created recently for cruft, no dynamic import.
- **INVESTIGATE:** named in report but used via string/dynamic import.
- **FALSE POSITIVE:** route/layout/loading files, PWA manifest, etc.

Create `docs/superpowers/plans/_knip-triage-2026-04-19.md` with three sections listing files.

- [ ] **Step A3.5: Delete SAFE items only**

For each file in SAFE list, `git rm <path>`.

- [ ] **Step A3.6: Build + lint + tsc**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```
Expected: all green. If any fail → identify which file's removal caused it → `git restore <file>` → recategorize → retry.

- [ ] **Step A3.7: Commit safe deletions**

```bash
git add -A
git commit -m "chore(cleanup): remove unused files (knip safe list)"
```

### Task A4: depcheck for unused npm deps

**Files:**
- Modify: `package.json`
- Modify: `bun.lockb` (auto)

- [ ] **Step A4.1: Run depcheck**

```bash
bunx depcheck --ignores="@types/*,eslint-*,prettier*,tailwind-*,postcss,autoprefixer,@tailwindcss/*,typescript,supabase" > .depcheck-report.txt 2>&1 || true
```

- [ ] **Step A4.2: Review report**

Read `.depcheck-report.txt`. For each reported unused dep:
- Check `package.json` scripts for usage.
- Check for runtime imports with string templates or config (e.g., `next.config.*`, `postcss.config.*`).
- If truly unused → add to removal list. If used in a non-obvious way → keep.

- [ ] **Step A4.3: Remove confirmed-unused deps**

```bash
bun remove <dep1> <dep2> ...
```
Run only for deps confirmed unused in A4.2.

- [ ] **Step A4.4: Build + lint + tsc**

```bash
bun install
bun run build
bun run lint
bunx tsc --noEmit
```
Expected: all green.

- [ ] **Step A4.5: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore(deps): remove unused npm dependencies (depcheck)"
```

### Task A5: ts-prune for unused exports

**Files:**
- Multiple `.ts`/`.tsx` files — remove unused `export` keywords.

- [ ] **Step A5.1: Run ts-prune**

```bash
bunx ts-prune > .ts-prune-report.txt 2>&1 || true
```

- [ ] **Step A5.2: Filter "(used in module)" entries**

```bash
grep -v "(used in module)" .ts-prune-report.txt > .ts-prune-dead.txt
```
`(used in module)` = self-used internally, not truly dead.

- [ ] **Step A5.3: Review .ts-prune-dead.txt**

For each entry `path:line - name`:
- If it's a default export of a page/layout/route → SKIP (Next.js convention).
- If it's a named export that appears in `app/api/*/route.ts` → check for framework convention (GET, POST, etc.) → SKIP.
- If it's a component/util/hook → candidate for removal.

- [ ] **Step A5.4: Remove unused exports one file at a time**

For each candidate file:
1. Open file.
2. Change `export function foo` → `function foo` (if truly internal) or remove the function entirely (if nothing in the file uses it).
3. Run `bunx tsc --noEmit` after each file.

- [ ] **Step A5.5: Final build + lint + tsc**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```
Expected: all green.

- [ ] **Step A5.6: Commit**

```bash
git add -A
git commit -m "chore(cleanup): remove unused exports (ts-prune)"
```

### Task A6: ESLint auto-fix pass

**Files:**
- Any `.ts`/`.tsx` file touched by auto-fixable rules.

- [ ] **Step A6.1: Run eslint --fix**

```bash
bun run lint -- --fix
```
Expected: some files modified.

- [ ] **Step A6.2: Review diff**

```bash
git diff --stat
```
Ensure only trivial fixes (unused imports, prefer-const, semi-colon style). If anything non-trivial, revert and investigate.

- [ ] **Step A6.3: Build + tsc**

```bash
bun run build
bunx tsc --noEmit
```
Expected: green.

- [ ] **Step A6.4: Commit**

```bash
git add -A
git commit -m "chore(lint): apply eslint --fix auto-fixable rules"
```

### Task A7: Manual sweep for `.old`, `.backup`, commented blocks

**Files:**
- Any file matching `*.old.*`, `*.backup.*`, or containing large commented-out blocks.

- [ ] **Step A7.1: Find suspicious filename patterns**

```bash
find . -type f \( -name "*.old.*" -o -name "*.backup.*" -o -name "*_old.*" -o -name "*_backup.*" \) \
  -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.archive/*"
```
Expected: empty, or a short list to archive.

- [ ] **Step A7.2: Archive any matches**

```bash
git mv <each-match> .archive/2026-04-19-cleanup/
```

- [ ] **Step A7.3: Find large commented blocks (10+ consecutive lines starting with //)**

Optional, risky — **skip unless time allows**. If done: identify via grep, read context, remove only if clearly dead (no TODO reference, no "restore when X" note).

- [ ] **Step A7.4: Build**

```bash
bun run build
```
Expected: green.

- [ ] **Step A7.5: Commit**

```bash
git add -A
git commit -m "chore(cleanup): remove .old/.backup file variants"
```

### Phase A Gate

- [ ] **Gate A.1: Full validation**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```
Expected: all green.

- [ ] **Gate A.2: Diff summary**

```bash
git log cleanup-pre-a..HEAD --stat
git diff cleanup-pre-a..HEAD --stat | tail -1
```
Report to user: commits made, files changed, lines removed.

- [ ] **Gate A.3: User acknowledgment**

Ask user: "Fase A completa. [summary]. Procedo con Fase C?"
Wait for explicit "ok" / "procedi" before continuing.

- [ ] **Gate A.4: Tag pre-C snapshot**

```bash
git tag cleanup-pre-c
```

---

## Phase C — Codemap + Docs

Goal: produce navigable documentation of each major area. No runtime changes.

### Task C1: Create codemap directory and index

**Files:**
- Create: `docs/CODEMAPS/README.md`

- [ ] **Step C1.1: Create directory**

```bash
mkdir -p docs/CODEMAPS
```

- [ ] **Step C1.2: Write index**

Create `docs/CODEMAPS/README.md`:
```markdown
# GastroBridge Codemaps

Navigate the codebase by area. Each codemap documents entry points, primary components, data flow, and common tasks.

## Areas

- [ristoratore.md](./ristoratore.md) — Restaurant area (`app/(app)/*`)
- [fornitore.md](./fornitore.md) — Supplier area (`app/(supplier)/*`)
- [shared.md](./shared.md) — Cross-cutting: `components/`, `lib/`, `hooks/`, `providers/`
- [api.md](./api.md) — Route handlers and server actions (`app/api/*`, `app/**/actions.ts`)
- [db.md](./db.md) — Supabase schema, RLS, migrations overview
- [mobile.md](./mobile.md) — PWA shell, responsive primitives, mobile overhaul

## Conventions

- Paths are relative to repo root.
- "Server" = runs on server (RSC, server action, route handler).
- "Client" = runs in browser (`"use client"`).
- Hooks are prefixed `use*`; placed in `hooks/` (global) or `_hooks/` (local to segment).

## How to read

1. Start with the area you're working in.
2. "Where do I find X?" section gives task → file path mappings.
3. Pain points section flags files that need refactor (fed into Phase B).
```

- [ ] **Step C1.3: Commit**

```bash
git add docs/CODEMAPS/README.md
git commit -m "docs(codemap): add index"
```

### Task C2: Ristoratore codemap

**Files:**
- Create: `docs/CODEMAPS/ristoratore.md`

- [ ] **Step C2.1: Enumerate ristoratore entry points**

```bash
find app/\(app\) -maxdepth 3 -type f \( -name "page.tsx" -o -name "layout.tsx" -o -name "loading.tsx" \) | sort
```
Capture list for codemap.

- [ ] **Step C2.2: Read layout + dashboard + key pages**

Read these files to understand area structure:
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/ordini/page.tsx`
- `app/(app)/cerca/page.tsx`
- `app/(app)/carrello/page.tsx`
- `app/(app)/fornitori/page.tsx`
- `app/(app)/cataloghi/page.tsx`
- `app/(app)/analytics/page.tsx`
- `app/(app)/impostazioni/page.tsx`

- [ ] **Step C2.3: Write codemap**

Create `docs/CODEMAPS/ristoratore.md` with sections:
1. **Purpose** — one paragraph on restaurant user's workflow.
2. **Entry points** — table of all `page.tsx` with one-line purpose.
3. **Primary components** — for each top-level segment (dashboard, ordini, cerca, carrello, fornitori, cataloghi, analytics, impostazioni): list `_components/*.tsx` files and their responsibility.
4. **Data flow** — how data enters (server actions in `actions.ts`, Supabase queries, realtime subscriptions via provider).
5. **Pain points** — files > 400 LOC (use `wc -l` on `.tsx` files), duplicated patterns.
6. **Where do I find X?** — common tasks with paths. Examples:
   - "Add new dashboard KPI" → `app/(app)/dashboard/_components/` + `app/(app)/dashboard/actions.ts`
   - "Change order status UI" → `components/status/order-status-badge.tsx`
   - "Update mobile nav" → check `mobile.md`

- [ ] **Step C2.4: Commit**

```bash
git add docs/CODEMAPS/ristoratore.md
git commit -m "docs(codemap): add ristoratore area map"
```

### Task C3: Fornitore codemap

**Files:**
- Create: `docs/CODEMAPS/fornitore.md`

- [ ] **Step C3.1: Enumerate entry points**

```bash
find app/\(supplier\) -maxdepth 4 -type f \( -name "page.tsx" -o -name "layout.tsx" -o -name "loading.tsx" \) | sort
```

- [ ] **Step C3.2: Read layout + key pages**

Read:
- `app/(supplier)/layout.tsx`
- `app/(supplier)/supplier/dashboard/page.tsx`
- `app/(supplier)/supplier/ordini/page.tsx` (if exists)
- `app/(supplier)/supplier/ordini/kanban/page.tsx`
- `app/(supplier)/supplier/catalogo/page.tsx` (if exists)
- `app/(supplier)/supplier/listini/page.tsx`
- `app/(supplier)/supplier/magazzino/page.tsx`
- `app/(supplier)/supplier/clienti/page.tsx` (if exists)
- `app/(supplier)/supplier/consegne/calendario/page.tsx`
- `app/(supplier)/supplier/ddt/ddt-book-client.tsx`
- `app/(supplier)/supplier/staff/page.tsx` (if exists)
- `app/(supplier)/supplier/impostazioni/page.tsx` (if exists)

- [ ] **Step C3.3: Write codemap**

Create `docs/CODEMAPS/fornitore.md` with same 6 sections as ristoratore, adapted.

- [ ] **Step C3.4: Commit**

```bash
git add docs/CODEMAPS/fornitore.md
git commit -m "docs(codemap): add fornitore area map"
```

### Task C4: Shared codemap

**Files:**
- Create: `docs/CODEMAPS/shared.md`

- [ ] **Step C4.1: Enumerate shared dirs**

```bash
ls -la components/ lib/ hooks/ providers/ 2>/dev/null
find components lib hooks providers -maxdepth 2 -type d 2>/dev/null
```

- [ ] **Step C4.2: Read top-level indexes or entry files**

Read a few representative files from each dir to understand categorization.

- [ ] **Step C4.3: Write codemap**

Create `docs/CODEMAPS/shared.md`:
1. **Purpose** — cross-cutting code used by both areas.
2. **`components/`** — table by sub-folder (ui, status, dashboard, etc.) with purpose.
3. **`lib/`** — utility modules (supabase clients, formatters, etc.).
4. **`hooks/`** — global hooks with purpose.
5. **`providers/`** — React providers (theme, realtime, auth, etc.).
6. **Pain points** — same criteria.
7. **Where do I find X?**

- [ ] **Step C4.4: Commit**

```bash
git add docs/CODEMAPS/shared.md
git commit -m "docs(codemap): add shared/cross-cutting map"
```

### Task C5: API codemap

**Files:**
- Create: `docs/CODEMAPS/api.md`

- [ ] **Step C5.1: Enumerate route handlers and actions**

```bash
find app -name "route.ts" -not -path "*/node_modules/*" | sort
find app -name "actions.ts" -not -path "*/node_modules/*" | sort
find lib/actions -type f 2>/dev/null
```

- [ ] **Step C5.2: Read top-level route handlers**

Sample ~10 route files to understand patterns (auth, RLS, response shape).

- [ ] **Step C5.3: Write codemap**

Create `docs/CODEMAPS/api.md`:
1. **Purpose** — server-side endpoints and mutations.
2. **Route handlers** — table: path, method, purpose, auth.
3. **Server actions** — grouped by area, table: function, purpose, RLS-relevant notes.
4. **Patterns** — how errors surface, how auth is checked, how FormData is parsed.
5. **Where do I find X?** — "Create new endpoint", "Add RLS to new table", "Debug failed action".

- [ ] **Step C5.4: Commit**

```bash
git add docs/CODEMAPS/api.md
git commit -m "docs(codemap): add api/actions map"
```

### Task C6: DB codemap

**Files:**
- Create: `docs/CODEMAPS/db.md`

- [ ] **Step C6.1: Enumerate migrations**

```bash
ls -la supabase/migrations/ 2>/dev/null
find . -maxdepth 3 -type d -name "migrations" -not -path "*/node_modules/*"
```

- [ ] **Step C6.2: Extract table list and RLS overview**

Read the 5 most recent migrations to understand current state. Read any `schema.sql` snapshot if present.

- [ ] **Step C6.3: Write codemap**

Create `docs/CODEMAPS/db.md`:
1. **Purpose** — DB schema overview.
2. **Tables** — table: name, purpose, key columns, RLS approach (helper function vs inline).
3. **RLS helpers** — list `SECURITY DEFINER` functions used (per `feedback_rls_recursion.md`).
4. **Migrations discipline** — additive only, named `YYYYMMDD_<desc>.sql`, never edited post-apply.
5. **Where do I find X?** — "Add new table", "Change RLS", "Debug RLS recursion".

- [ ] **Step C6.4: Commit**

```bash
git add docs/CODEMAPS/db.md
git commit -m "docs(codemap): add db/RLS map"
```

### Task C7: Mobile codemap

**Files:**
- Create: `docs/CODEMAPS/mobile.md`

- [ ] **Step C7.1: Gather mobile-related files**

Reference: `memory/project_mobile_responsive.md`, `memory/project_restaurant_mobile_ios_editorial.md`.

```bash
find components -name "*mobile*" -o -name "*pwa*" 2>/dev/null
find app -name "manifest.ts" -o -name "manifest.webmanifest" 2>/dev/null
```

- [ ] **Step C7.2: Read mobile primitives and chrome**

Read the mobile primitive components (nav, header, container queries) and PWA manifest.

- [ ] **Step C7.3: Write codemap**

Create `docs/CODEMAPS/mobile.md`:
1. **Purpose** — PWA strategy, responsive system, editorial palette.
2. **Responsive tokens** — clamp scales, container queries.
3. **Mobile primitives** — files (mobile-nav, pill-nav, mobile-header, etc.).
4. **PWA config** — manifest, icons, service worker if any.
5. **Areas status** — ristoratore overhaul state, fornitore overhaul state (from memory).
6. **Where do I find X?** — "Change mobile nav", "Add responsive breakpoint", "Update PWA icon".

- [ ] **Step C7.4: Commit**

```bash
git add docs/CODEMAPS/mobile.md
git commit -m "docs(codemap): add mobile/PWA map"
```

### Task C8: Root README link + stale doc audit

**Files:**
- Modify: `README.md`
- List (no delete yet): `docs/` stale candidates

- [ ] **Step C8.1: Read current README**

```bash
# Use Read tool on README.md
```

- [ ] **Step C8.2: Add code navigation section to README**

Add after project overview, before setup:
```markdown
## Code navigation

See [`docs/CODEMAPS/`](./docs/CODEMAPS/README.md) for a map of the codebase by area:
- Restaurant area, supplier area, shared, api, db, mobile.
```

- [ ] **Step C8.3: List stale docs**

```bash
ls docs/
```
Identify files last modified > 60 days ago OR referencing removed features. Do NOT delete yet.

- [ ] **Step C8.4: Write stale candidates list to plan triage file**

Create `docs/superpowers/plans/_stale-docs-triage-2026-04-19.md` listing each candidate with last-modified date and reason for suspicion.

- [ ] **Step C8.5: Present list to user**

Ask: "Candidati stale in docs/: [list]. Quali rimuovere?" Wait for explicit per-file approval.

- [ ] **Step C8.6: Remove approved-stale docs**

```bash
git mv <each-approved> .archive/2026-04-19-cleanup/
```

- [ ] **Step C8.7: Commit README + stale cleanup**

```bash
git add README.md .archive/
git commit -m "docs(cleanup): README code-navigation link + archive stale docs"
```

### Phase C Gate

- [ ] **Gate C.1: Build sanity**

```bash
bun run build
```
Expected: green. Docs-only changes, should not affect build.

- [ ] **Gate C.2: Summary**

```bash
git log cleanup-pre-c..HEAD --stat
```
Report to user: codemaps created, README updated, stale docs archived.

- [ ] **Gate C.3: User acknowledgment**

Ask: "Fase C completa. Codemaps: [list]. Procedo con Fase B?"
Wait for "ok".

- [ ] **Gate C.4: Tag pre-B snapshot**

```bash
git tag cleanup-pre-b
```

---

## Phase B — Structural Refactor

Goal: split oversized files, consolidate duplicates, improve naming consistency. Medium risk — required manual smoke test per candidate.

### Task B1: Generate refactor candidate list

**Files:**
- Create: `docs/superpowers/plans/_refactor-candidates-2026-04-19.md`

- [ ] **Step B1.1: Find files > 400 LOC**

```bash
find app components lib hooks providers -name "*.tsx" -o -name "*.ts" 2>/dev/null \
  | grep -v node_modules \
  | xargs wc -l \
  | sort -rn \
  | head -40 > .file-sizes.txt
```

- [ ] **Step B1.2: Filter exclusions**

Remove from candidate list:
- Any file whose most-recent commit is on or after 2026-04-17 (recent mobile/badge work).
- Generated files (`supabase/types.ts`, Next.js build outputs).
- Third-party copies.

Check recency per file:
```bash
git log --since="2026-04-17" --name-only --pretty=format: | sort -u > .recent-files.txt
```
Any file in both `.file-sizes.txt` and `.recent-files.txt` → EXCLUDE.

- [ ] **Step B1.3: Write candidate list with impact/safety scores**

Create `docs/superpowers/plans/_refactor-candidates-2026-04-19.md`:

For each remaining file:
```
## <path>
- LOC: <n>
- Responsibilities (rough): <list>
- Proposed split: <plan>
- Impact: <low/med/high> — how much of app uses it
- Safety: <low/med/high> — reversibility, test coverage via manual smoke
- Priority: <score>
```

Rank top 5. These are Phase B targets.

- [ ] **Step B1.4: Present list to user**

Ask: "Top 5 refactor candidates: [list]. Approvi questi 5, o sostituisci?" Wait for explicit list.

- [ ] **Step B1.5: Commit triage doc**

```bash
git add docs/superpowers/plans/_refactor-candidates-2026-04-19.md
git commit -m "docs(plan): refactor candidates for cleanup pass 1"
```

### Task B2–B6: Per-candidate refactor (repeat 5x)

**Template — apply to each of the 5 approved candidates.**

**Files:**
- Modify: `<candidate-path>`
- Create: new files from split (names determined during plan)

- [ ] **Step B<n>.1: Document current contract**

Read the candidate file fully. Write down in `_refactor-candidates-2026-04-19.md` under that candidate:
- Public exports (names + signatures).
- Side effects (Supabase calls, DOM manipulation, subscriptions).
- Callers (result of `grep -rn` on the file's export names).

- [ ] **Step B<n>.2: Plan split**

Under the candidate heading, write:
- New file 1: path, responsibility, exports moved here.
- New file 2: path, responsibility, exports moved here.
- (etc.)
- What stays in original file.
- Which imports each new file needs.

- [ ] **Step B<n>.3: User ack plan**

Ask: "Piano split per `<candidate>`: [plan]. Ok?" Wait for "ok".

- [ ] **Step B<n>.4: Execute split, file by file**

For each new file:
1. Create file with extracted code.
2. Update original file to import from new file.
3. Update any other callers only if import path changes.

- [ ] **Step B<n>.5: Gate**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```
If green → proceed. If red → `git restore .` → re-plan.

- [ ] **Step B<n>.6: User smoke test request**

Ask user to test the feature that uses this code. Wait for "ok".

- [ ] **Step B<n>.7: Commit**

```bash
git add -A
git commit -m "refactor(<area>): split <what> into <new-structure>"
```

**Repeat B<n>.1–B<n>.7 for each of candidates 2, 3, 4, 5.**

### Phase B Gate

- [ ] **Gate B.1: Full validation**

```bash
bun run build
bun run lint
bunx tsc --noEmit
```

- [ ] **Gate B.2: Global smoke test**

Ask user to do end-to-end smoke: login → restaurant dashboard → order detail → cerca → cart → checkout → supplier dashboard → supplier order kanban → chat. Wait for "ok".

- [ ] **Gate B.3: Summary to user**

```bash
git log cleanup-pre-b..HEAD --stat
```

- [ ] **Gate B.4: User acknowledgment**

Ask: "Fase B completa. [summary]. Procedo con Fase D?"

- [ ] **Gate B.5: Tag pre-D snapshot**

```bash
git tag cleanup-pre-d
```

---

## Phase D — Bug Hunt + Strict Mode

Goal: enable stricter type checking and lint, resolve resulting issues.

### Task D1: Baseline strict tsc run

**Files:**
- Read only: `tsconfig.json`

- [ ] **Step D1.1: Read current tsconfig**

```bash
cat tsconfig.json
```
Note current strict settings.

- [ ] **Step D1.2: Run strict tsc without modifying config**

```bash
bunx tsc --noEmit --strict > .tsc-strict-report.txt 2>&1 || true
```

- [ ] **Step D1.3: Categorize errors**

Count errors per category (implicit any, null check, unchecked index). Summarize in `docs/superpowers/plans/_strict-tsc-triage-2026-04-19.md`.

### Task D2: Fix strict errors in chunks

**Files:**
- Many `.ts`/`.tsx` files across repo.

- [ ] **Step D2.1: Group errors by directory**

Split `.tsc-strict-report.txt` into chunks of ~20 errors, grouped by top-level dir (app, components, lib).

- [ ] **Step D2.2: Fix chunk 1**

Apply minimal fixes: add null checks, narrow types, replace `any` with concrete types where obvious. For complex cases, use `// TODO(strict): <reason>` comment rather than rewriting.

- [ ] **Step D2.3: Verify chunk 1**

```bash
bunx tsc --noEmit --strict 2>&1 | wc -l
```
Expected: error count decreased by size of chunk 1.

- [ ] **Step D2.4: Commit chunk 1**

```bash
git add -A
git commit -m "fix(types): strict null checks in <dir> (chunk 1)"
```

- [ ] **Step D2.5–D2.N: Repeat for remaining chunks**

Continue until `bunx tsc --noEmit --strict` is clean, or remaining errors are documented as deferred with `TODO(strict)` comments.

### Task D3: Enable strict in tsconfig (if not already)

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step D3.1: Add/enable strict flags**

If tsconfig doesn't have `"strict": true`, add it. Alternatively enable individually: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.

- [ ] **Step D3.2: Full tsc run**

```bash
bunx tsc --noEmit
```
Expected: green (or only TODO(strict)-marked deferrals).

- [ ] **Step D3.3: Build**

```bash
bun run build
```
Expected: green.

- [ ] **Step D3.4: Commit**

```bash
git add tsconfig.json
git commit -m "chore(types): enable strict mode in tsconfig"
```

### Task D4: ESLint --max-warnings 0 pass

**Files:**
- Many `.ts`/`.tsx` files.

- [ ] **Step D4.1: Run lint at zero warnings**

```bash
bun run lint -- --max-warnings 0 > .lint-strict-report.txt 2>&1 || true
```

- [ ] **Step D4.2: Fix warnings in chunks**

Same approach as D2: group by dir, fix chunks, commit per chunk.

- [ ] **Step D4.3: Final lint check**

```bash
bun run lint -- --max-warnings 0
```
Expected: clean exit (code 0).

- [ ] **Step D4.4: Commit final lint pass**

```bash
git add -A
git commit -m "chore(lint): fix remaining eslint warnings (max-warnings 0)"
```

### Task D5: Track surviving TODO/FIXME

**Files:**
- Create: `docs/TODO-tracker.md`

- [ ] **Step D5.1: Grep all TODO/FIXME/HACK/XXX**

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.archive \
  > .todo-report.txt
```

- [ ] **Step D5.2: Categorize**

Create `docs/TODO-tracker.md` with sections:
- **Active** — things with a known owner/timeline.
- **Deferred strict** — `TODO(strict)` items from Phase D.
- **Speculative** — "maybe later" notes; mark for removal if no real need.

- [ ] **Step D5.3: Remove speculative TODOs from code**

For items in "Speculative" section that have no clear reason to keep, delete the comment (not the surrounding code).

- [ ] **Step D5.4: Build + tsc + lint**

```bash
bun run build
bunx tsc --noEmit
bun run lint -- --max-warnings 0
```
Expected: all green.

- [ ] **Step D5.5: Commit**

```bash
git add -A
git commit -m "docs(todo): track active/deferred/speculative TODOs; remove speculative"
```

### Phase D Gate

- [ ] **Gate D.1: Full validation**

```bash
bun run build
bun run lint -- --max-warnings 0
bunx tsc --noEmit
```
Expected: all green.

- [ ] **Gate D.2: Final global smoke test**

Ask user to smoke-test: login → restaurant full flow → supplier full flow → mobile PWA. Wait for "ok".

- [ ] **Gate D.3: Summary**

```bash
git log cleanup-pre-d..HEAD --stat
git log cleanup-pre-a..HEAD --oneline | wc -l   # total commits in pass
git diff cleanup-pre-a..HEAD --stat | tail -1   # net line change
```

- [ ] **Gate D.4: Remove scratch artifacts**

Delete any `.knip-report.*`, `.depcheck-report.*`, `.ts-prune-report.*`, `.tsc-strict-report.*`, `.lint-strict-report.*`, `.file-sizes.txt`, `.recent-files.txt`, `.todo-report.txt`, `_knip-triage-*.md`, `_stale-docs-triage-*.md`, `_refactor-candidates-*.md`, `_strict-tsc-triage-*.md`. Alternative: move to `.archive/2026-04-19-cleanup/reports/`.

```bash
mkdir -p .archive/2026-04-19-cleanup/reports
mv .knip-report.* .depcheck-report.* .ts-prune-report.* .tsc-strict-report.* .lint-strict-report.* .file-sizes.txt .recent-files.txt .todo-report.txt .archive/2026-04-19-cleanup/reports/ 2>/dev/null || true
mv docs/superpowers/plans/_*-triage-2026-04-19.md docs/superpowers/plans/_refactor-candidates-2026-04-19.md .archive/2026-04-19-cleanup/reports/ 2>/dev/null || true
git add -A
git commit -m "chore(cleanup): archive pass-1 triage reports"
```

---

## Finalization — PR

### Task F1: Push and open PR

- [ ] **Step F1.1: Push branch**

```bash
git push -u origin chore/cleanup-pass-1
```

- [ ] **Step F1.2: Open PR**

```bash
gh pr create --title "chore(cleanup): pass 1 — dead code, codemaps, refactors, strict types" --body "$(cat <<'EOF'
## Summary
- Phase A: removed unused files/exports/deps + archived root cruft.
- Phase C: added `docs/CODEMAPS/` (ristoratore, fornitore, shared, api, db, mobile) + README link.
- Phase B: refactored top-5 oversized/tangled files into focused units.
- Phase D: enabled strict TypeScript and `eslint --max-warnings 0`.

Spec: `docs/superpowers/specs/2026-04-19-cleanup-pass-1-design.md`
Plan: `docs/superpowers/plans/2026-04-19-cleanup-pass-1.md`

## Behavior
Zero intentional behavior change. All gates green. User manual smoke-tests passed for each phase.

## Test plan
- [x] `bun run build` green
- [x] `bun run lint --max-warnings 0` green
- [x] `bunx tsc --noEmit` (strict) green
- [x] Manual smoke: login, restaurant dashboard, cerca, cart, orders, supplier dashboard, supplier kanban, chat, mobile PWA

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step F1.3: Report PR URL to user**

---

## Rollback Reference

At any failure point:
- **Within a task:** `git restore .` (uncommitted) or `git reset --hard HEAD~1` (committed but broken).
- **Within a phase:** `git reset --hard cleanup-pre-<phase>`.
- **Whole pass:** `git checkout main && git branch -D chore/cleanup-pass-1` (after confirming no local-only work worth keeping).

Tags created during the pass:
- `cleanup-pre-a` — before Phase A.
- `cleanup-pre-c` — before Phase C.
- `cleanup-pre-b` — before Phase B.
- `cleanup-pre-d` — before Phase D.

Clean up tags after merge:
```bash
git tag -d cleanup-pre-a cleanup-pre-c cleanup-pre-b cleanup-pre-d
```
