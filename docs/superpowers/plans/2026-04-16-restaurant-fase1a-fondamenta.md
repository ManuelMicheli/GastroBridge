# Admin Ristoratore — Fase 1A: Team & Fondamenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** porre le fondamenta schema + RLS + permessi dell'intera Fase 1 ristoratore e consegnare la prima slice di UI professionale: team multi-utente con 4 ruoli (`owner/manager/chef/viewer`), inviti email, configurazione soglia approvazione ordini, configurazione HACCP base. Tutto dietro feature flag `restaurants.feature_flags.phase1_enabled`. Backward compatibility totale con pagine esistenti.

**Architecture:**
- **Una sola migrazione Supabase** crea gli enum base della Fase 1 + le tabelle necessarie a 1A (`restaurant_members`, `role_permissions_restaurant`), mod a `restaurants` (feature_flags, approval_threshold, haccp_settings, preferred_receiving_window), helper SQL in SECURITY DEFINER (`has_restaurant_permission`, `is_restaurant_member`), seed matrice permessi 17 × 4 ruoli, backfill non distruttivo (1 membership owner per ogni restaurants esistente). Gli enum di 1B/1C/1D che NON servono a 1A restano a quei plan.
- **Helper TypeScript**: `lib/restaurant/permissions.ts` (enum dei permessi + matrice di riferimento), `lib/restaurant/feature-flags.ts` (`isPhase1Enabled`, `requirePhase1`), `lib/restaurant/context.ts` (`getActiveRestaurantMember`, `requireRestaurantMember`, `requirePermission`).
- **Server actions** per team (invite, accept, updateRole, deactivate) e settings (approval threshold, HACCP ranges). Return shape `{ ok: true; data } | { ok: false; error }`.
- **Email inviti** tramite `sendEmail()` già presente in `lib/notifications/email.ts` (Resend).
- **UI 1A**:
  - `/impostazioni/team` rifatta con lista membri + ruoli + inviti
  - `/impostazioni/approvazione` nuova per soglia budget
  - `/impostazioni/haccp` nuova per range temp + responsabile
  - `/invito-ristorante/[token]` pagina accettazione invito
- Altre sezioni (bacheca, ricevimento, analytics) → 1B/1C/1D.
- **Feature flag**: tutte le nuove rotte gated via `isRestaurantPhase1Enabled(restaurantId)`; quando spento la UI ripiega sul layout corrente.

**Tech Stack:** Next.js 15 (App Router) · Supabase SSR · TypeScript strict · Tailwind v4 · Zod v4 (`zod/v4`) · lucide-react · `sendEmail` via Resend (già configurato) · toast `sonner` o `@/components/ui/toast` secondo convenzione.

**Reference spec:** `docs/superpowers/specs/2026-04-16-admin-ristoratore-fase1-design.md` (§§2, 3, 4.1, 4.2 (righe settings), 6, 7 sono la fonte di verità per 1A).

**Testing model:** nessun framework unit test configurato nel progetto. Ogni task termina con **manual verification** (browser + SQL console via Supabase Studio). Per le RLS una RPC di probe nel SQL editor è sufficiente.

**Conventions (seguire il codice esistente):**
- Server actions in `lib/restaurant/<domain>/actions.ts` con direttiva `"use server"` e return shape `{ ok: true; data } | { ok: false; error: string }`.
- Supabase clients: `@/lib/supabase/client` (browser), `@/lib/supabase/server` (server), `@/lib/supabase/admin` (service role — solo per invio inviti e operazioni admin verificate).
- Zod v4 strict (`import { z } from "zod/v4"`).
- Tutte le stringhe UI in italiano.
- Tokens esistenti area ristoratore: `bg-cream`, `text-charcoal`, `text-sage`, `text-forest`, `bg-forest-light`, `text-terracotta`, `border-sage-muted`, `bg-sage-muted`. NON usare i tokens dark-dashboard del supplier — l'area ristoratore ha palette chiara.
- Riusare `Card`, `Button`, `Badge`, `Input` da `components/ui/`.
- Icone `lucide-react` (verifica prima di introdurne di nuove).
- Toast via `@/components/ui/toast`.
- Nessuna dependency nuova.

**Distinzione con migrazioni già in repo del branch corrente `feat/cataloghi-ristoratore`**:
- `restaurant_suppliers` (`20260417000002`) — partnership — NON va toccata. Questo plan si limita a preparare il terreno per i permessi; la partnership resta come è.
- `partnership_messages` (`20260417000005`) — resta come è.
- `supplier_price_lists` (`20260417000004`) — resta come è.
- `enable_phase1_platform_wide` (`20260418000004`) — riguarda i SUPPLIER (feature_flags.phase1_enabled sulla tabella `suppliers`). Il nostro flag sarà `restaurants.feature_flags.phase1_enabled`, distinto.

---

## File Structure

### Created

Migration:
- `supabase/migrations/20260502100000_restaurant_phase1a_foundations.sql`

Helper libs:
- `lib/restaurant/permissions.ts`
- `lib/restaurant/feature-flags.ts`
- `lib/restaurant/context.ts`

Team domain:
- `lib/restaurant/team/schemas.ts`
- `lib/restaurant/team/actions.ts`
- `lib/restaurant/team/queries.ts`
- `lib/restaurant/team/types.ts`
- `lib/restaurant/team/email-templates.ts`

Settings domain:
- `lib/restaurant/settings/schemas.ts`
- `lib/restaurant/settings/actions.ts`
- `lib/restaurant/settings/types.ts`

Pages:
- `app/(app)/impostazioni/team/team-client.tsx` — client wrapper con interazioni
- `app/(app)/impostazioni/approvazione/page.tsx`
- `app/(app)/impostazioni/approvazione/approval-client.tsx`
- `app/(app)/impostazioni/haccp/page.tsx`
- `app/(app)/impostazioni/haccp/haccp-client.tsx`
- `app/invito-ristorante/[token]/page.tsx`
- `app/invito-ristorante/[token]/accept-client.tsx`

Components:
- `components/restaurant/shared/role-gate.tsx`
- `components/restaurant/shared/feature-flag-gate.tsx`
- `components/restaurant/settings/team-member-row.tsx`
- `components/restaurant/settings/invite-member-dialog.tsx`
- `components/restaurant/settings/approval-threshold-form.tsx`
- `components/restaurant/settings/haccp-ranges-form.tsx`

### Modified

- `types/database.ts` — aggiungere types per `restaurant_members`, `role_permissions_restaurant`, enum `restaurant_role`, colonne aggiunte a `restaurants`
- `app/(app)/impostazioni/team/page.tsx` — riscritta completamente (server component + `team-client.tsx`)
- `app/(app)/impostazioni/page.tsx` — aggiungere le voci "Approvazione ordini" e "HACCP" nella lista
- `app/(app)/layout.tsx` — passare `restaurantId` primario al DashboardShell per usare feature flag (non cambia la UI, solo prep)

---

## Task 1 — Migrazione unica 1A: enum + tabelle + helpers + seed + backfill + RLS

**Files:**
- Create: `supabase/migrations/20260502100000_restaurant_phase1a_foundations.sql`

- [ ] **Step 1: Scrivere migration completa in transazione unica**

Tutto il contenuto va in un singolo file. Scrivilo a blocchi in ordine. Avvolgi in `BEGIN; ... COMMIT;` (Supabase già lo fa per le migrations ma lo esplicitiamo per chiarezza).

```sql
-- ============================================================
-- Restaurant Phase 1A — Foundations
-- Enums + tables + helpers + seed + backfill + RLS
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Enums per la Fase 1 ristoratore usati già in 1A
-- ------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE restaurant_role AS ENUM ('owner', 'manager', 'chef', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_approval_status AS ENUM ('not_required', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. Tabelle 1A
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS restaurant_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          restaurant_role NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  invited_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  invite_token  text UNIQUE,
  invite_expires_at timestamptz,
  invited_email text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_members_restaurant ON restaurant_members(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_restaurant_members_profile    ON restaurant_members(profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_restaurant_members_invite     ON restaurant_members(invite_token) WHERE invite_token IS NOT NULL;

DROP TRIGGER IF EXISTS set_restaurant_members_updated_at ON restaurant_members;
CREATE TRIGGER set_restaurant_members_updated_at
  BEFORE UPDATE ON restaurant_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TABLE IF NOT EXISTS role_permissions_restaurant (
  role       restaurant_role NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

-- ------------------------------------------------------------
-- 3. Mod a restaurants (feature_flags, approval_threshold, haccp_settings, preferred_receiving_window)
-- ------------------------------------------------------------

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS feature_flags      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_threshold numeric      NULL,
  ADD COLUMN IF NOT EXISTS haccp_settings     jsonb        NOT NULL DEFAULT '{
    "frozen":       {"min": -18, "max": -15},
    "refrigerated": {"min": 0,   "max": 4},
    "ambient":      {"min": null,"max": null},
    "responsible_member_id": null,
    "manual_version": null
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_receiving_window jsonb NULL;

-- ------------------------------------------------------------
-- 4. Helper SQL: SECURITY DEFINER, evitano ricorsioni RLS
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_restaurant_member(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_members
    WHERE restaurant_id = p_restaurant_id
      AND profile_id    = auth.uid()
      AND is_active
      AND accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION restaurant_member_role(p_restaurant_id uuid)
RETURNS restaurant_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM restaurant_members
  WHERE restaurant_id = p_restaurant_id
    AND profile_id    = auth.uid()
    AND is_active
    AND accepted_at IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION has_restaurant_permission(p_restaurant_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_members rm
    JOIN role_permissions_restaurant rp ON rp.role = rm.role
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.profile_id    = auth.uid()
      AND rm.is_active
      AND rm.accepted_at IS NOT NULL
      AND rp.permission   = p_permission
  );
$$;

REVOKE EXECUTE ON FUNCTION is_restaurant_member(uuid)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION restaurant_member_role(uuid)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION has_restaurant_permission(uuid, text)         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_restaurant_member(uuid)                   TO authenticated;
GRANT  EXECUTE ON FUNCTION restaurant_member_role(uuid)                  TO authenticated;
GRANT  EXECUTE ON FUNCTION has_restaurant_permission(uuid, text)         TO authenticated;

-- ------------------------------------------------------------
-- 5. Seed matrice role_permissions_restaurant
-- ------------------------------------------------------------

INSERT INTO role_permissions_restaurant (role, permission) VALUES
  -- OWNER: tutto
  ('owner', 'order.draft'),
  ('owner', 'order.submit'),
  ('owner', 'order.approve'),
  ('owner', 'order.receive'),
  ('owner', 'catalog.read'),
  ('owner', 'partnership.manage'),
  ('owner', 'par_levels.manage'),
  ('owner', 'template.manage'),
  ('owner', 'recurring.manage'),
  ('owner', 'issue.open'),
  ('owner', 'issue.resolve'),
  ('owner', 'rating.submit'),
  ('owner', 'analytics.financial'),
  ('owner', 'staff.manage'),
  ('owner', 'settings.manage'),
  ('owner', 'subscription.manage'),
  ('owner', 'multi_sede.switch'),
  -- MANAGER: tutto tranne staff/subscription/approve
  ('manager', 'order.draft'),
  ('manager', 'order.submit'),
  ('manager', 'order.receive'),
  ('manager', 'catalog.read'),
  ('manager', 'partnership.manage'),
  ('manager', 'par_levels.manage'),
  ('manager', 'template.manage'),
  ('manager', 'recurring.manage'),
  ('manager', 'issue.open'),
  ('manager', 'issue.resolve'),
  ('manager', 'rating.submit'),
  ('manager', 'analytics.financial'),
  ('manager', 'settings.manage'),
  ('manager', 'multi_sede.switch'),
  -- CHEF: operativo, no approvazione, no manage staff/settings
  ('chef', 'order.draft'),
  ('chef', 'order.submit'),
  ('chef', 'order.receive'),
  ('chef', 'catalog.read'),
  ('chef', 'par_levels.manage'),
  ('chef', 'template.manage'),
  ('chef', 'recurring.manage'),
  ('chef', 'issue.open'),
  ('chef', 'rating.submit'),
  -- VIEWER: read-only
  ('viewer', 'catalog.read'),
  ('viewer', 'analytics.financial')
ON CONFLICT (role, permission) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Backfill owner membership per ogni restaurants esistente
-- ------------------------------------------------------------

INSERT INTO restaurant_members (restaurant_id, profile_id, role, is_active, invited_by, accepted_at)
SELECT r.id, r.profile_id, 'owner'::restaurant_role, true, r.profile_id, now()
FROM restaurants r
WHERE r.profile_id IS NOT NULL
ON CONFLICT (restaurant_id, profile_id) DO NOTHING;

-- ------------------------------------------------------------
-- 7. RLS restaurant_members
-- ------------------------------------------------------------

ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own memberships" ON restaurant_members;
CREATE POLICY "Members read own memberships"
  ON restaurant_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR is_restaurant_member(restaurant_id)
    OR has_restaurant_permission(restaurant_id, 'staff.manage')
  );

DROP POLICY IF EXISTS "Owner manages memberships" ON restaurant_members;
CREATE POLICY "Owner manages memberships"
  ON restaurant_members FOR INSERT
  WITH CHECK (has_restaurant_permission(restaurant_id, 'staff.manage'));

DROP POLICY IF EXISTS "Owner updates memberships" ON restaurant_members;
CREATE POLICY "Owner updates memberships"
  ON restaurant_members FOR UPDATE
  USING (has_restaurant_permission(restaurant_id, 'staff.manage'))
  WITH CHECK (has_restaurant_permission(restaurant_id, 'staff.manage'));

DROP POLICY IF EXISTS "Owner removes memberships" ON restaurant_members;
CREATE POLICY "Owner removes memberships"
  ON restaurant_members FOR DELETE
  USING (has_restaurant_permission(restaurant_id, 'staff.manage'));

DROP POLICY IF EXISTS "Invitee can accept own invite" ON restaurant_members;
CREATE POLICY "Invitee can accept own invite"
  ON restaurant_members FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND accepted_at IS NULL
    AND invite_token IS NOT NULL
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND accepted_at IS NOT NULL
  );

-- ------------------------------------------------------------
-- 8. RLS role_permissions_restaurant (read-only per tutti auth)
-- ------------------------------------------------------------

ALTER TABLE role_permissions_restaurant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read role permissions" ON role_permissions_restaurant;
CREATE POLICY "Anyone authenticated can read role permissions"
  ON role_permissions_restaurant FOR SELECT
  USING (auth.role() = 'authenticated');

-- (nessuna INSERT/UPDATE/DELETE via policy — solo service role)

COMMIT;
```

- [ ] **Step 2: Applicare migration in locale**

Run:
```bash
cd "D:/Manum/GastroBridge"
npx supabase db reset
```

Expected: nessun errore, tutte le migration ri-applicate incluso questa nuova. Alla fine stampa `Finished supabase db reset`.

Se il DB remoto non serve per lo sviluppo, puoi usare solo `npx supabase migration up`.

- [ ] **Step 3: Verifica manuale in Supabase Studio (locale)**

Apri SQL editor locale (`http://localhost:54323`) e esegui:

```sql
-- Verifica enum
SELECT unnest(enum_range(NULL::restaurant_role));
-- atteso: owner, manager, chef, viewer

SELECT unnest(enum_range(NULL::order_approval_status));
-- atteso: not_required, pending, approved, rejected

-- Verifica matrice permessi
SELECT role, count(*) FROM role_permissions_restaurant GROUP BY role ORDER BY role;
-- atteso: chef=9, manager=14, owner=17, viewer=2

-- Verifica backfill
SELECT count(*) FROM restaurant_members WHERE role = 'owner' AND accepted_at IS NOT NULL;
-- atteso: pari a count(*) da restaurants WHERE profile_id IS NOT NULL

-- Verifica nuove colonne restaurants
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name IN ('feature_flags','approval_threshold','haccp_settings','preferred_receiving_window');
-- atteso: 4 righe, feature_flags/haccp_settings default jsonb, approval_threshold nullable, preferred_receiving_window nullable

-- Verifica helper funzionante (simula un utente logged in via API; qui test con SECURITY DEFINER)
-- In SQL editor eseguito come service role, l'output sarà vuoto, ma la compilazione deve passare:
SELECT prosrc FROM pg_proc WHERE proname IN ('is_restaurant_member','has_restaurant_permission','restaurant_member_role');
-- atteso: 3 righe
```

- [ ] **Step 4: Commit**

```bash
cd "D:/Manum/GastroBridge"
git add supabase/migrations/20260502100000_restaurant_phase1a_foundations.sql
git commit -m "feat(restaurant-1a): migration foundations (members, permissions, helpers, seed, backfill)"
```

---

## Task 2 — Types TypeScript per nuove tabelle

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Aggiungere types manuali per restaurant_members, role_permissions_restaurant, enum**

Cerca in `types/database.ts` la sezione dove sono definiti i types per le tabelle esistenti (es. `Restaurant`, `Supplier`). Aggiungi dopo le dichiarazioni esistenti:

```typescript
// ============================================================
// Restaurant Phase 1 — team & permissions
// ============================================================

export type RestaurantRole = "owner" | "manager" | "chef" | "viewer";

export type OrderApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export interface RestaurantMember {
  id: string;
  restaurant_id: string;
  profile_id: string;
  role: RestaurantRole;
  is_active: boolean;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  invited_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionRestaurant {
  role: RestaurantRole;
  permission: RestaurantPermission;
}

export type RestaurantPermission =
  | "order.draft"
  | "order.submit"
  | "order.approve"
  | "order.receive"
  | "catalog.read"
  | "partnership.manage"
  | "par_levels.manage"
  | "template.manage"
  | "recurring.manage"
  | "issue.open"
  | "issue.resolve"
  | "rating.submit"
  | "analytics.financial"
  | "staff.manage"
  | "settings.manage"
  | "subscription.manage"
  | "multi_sede.switch";

// Shape arricchita di restaurants con nuove colonne
export interface RestaurantHaccpSettings {
  frozen: { min: number | null; max: number | null };
  refrigerated: { min: number | null; max: number | null };
  ambient: { min: number | null; max: number | null };
  responsible_member_id: string | null;
  manual_version: string | null;
}

export interface RestaurantFeatureFlags {
  phase1_enabled?: boolean;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Se esiste interfaccia `Restaurant` già definita, estenderla**

Se `types/database.ts` ha già un type `Restaurant`, aggiungi le nuove colonne:

```typescript
// Dentro Restaurant interface esistente, aggiungi:
  feature_flags: RestaurantFeatureFlags;
  approval_threshold: number | null;
  haccp_settings: RestaurantHaccpSettings;
  preferred_receiving_window: { from: string; to: string } | null;
```

Se non esiste, non creare una nuova `Restaurant` — leggerà a runtime e chi fa query usa cast mirati come nel resto del progetto.

- [ ] **Step 3: Verifica build TypeScript**

```bash
cd "D:/Manum/GastroBridge"
npx tsc --noEmit
```

Expected: nessun errore nuovo. Errori pre-esistenti sono OK (non toccare).

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat(restaurant-1a): add TypeScript types for members, permissions, HACCP"
```

---

## Task 3 — Helper TS: permissions enum + matrice client-side

**Files:**
- Create: `lib/restaurant/permissions.ts`

- [ ] **Step 1: Creare file con enum + matrice hardcoded per UX (evita round-trip DB)**

```typescript
import type { RestaurantPermission, RestaurantRole } from "@/types/database";

export const RESTAURANT_PERMISSIONS = [
  "order.draft",
  "order.submit",
  "order.approve",
  "order.receive",
  "catalog.read",
  "partnership.manage",
  "par_levels.manage",
  "template.manage",
  "recurring.manage",
  "issue.open",
  "issue.resolve",
  "rating.submit",
  "analytics.financial",
  "staff.manage",
  "settings.manage",
  "subscription.manage",
  "multi_sede.switch",
] as const satisfies readonly RestaurantPermission[];

/**
 * Source of truth duplicata della matrice in `role_permissions_restaurant`.
 * Usata SOLO per rendering UI (nascondere pulsanti) — NON per authz reale.
 * Authz reale = sempre via RPC `has_restaurant_permission` lato DB.
 */
export const ROLE_PERMISSIONS_MATRIX: Record<RestaurantRole, readonly RestaurantPermission[]> = {
  owner: RESTAURANT_PERMISSIONS,
  manager: [
    "order.draft",
    "order.submit",
    "order.receive",
    "catalog.read",
    "partnership.manage",
    "par_levels.manage",
    "template.manage",
    "recurring.manage",
    "issue.open",
    "issue.resolve",
    "rating.submit",
    "analytics.financial",
    "settings.manage",
    "multi_sede.switch",
  ],
  chef: [
    "order.draft",
    "order.submit",
    "order.receive",
    "catalog.read",
    "par_levels.manage",
    "template.manage",
    "recurring.manage",
    "issue.open",
    "rating.submit",
  ],
  viewer: ["catalog.read", "analytics.financial"],
};

export function roleHasPermission(role: RestaurantRole, permission: RestaurantPermission): boolean {
  return ROLE_PERMISSIONS_MATRIX[role].includes(permission);
}

export const RESTAURANT_ROLE_LABELS: Record<RestaurantRole, string> = {
  owner: "Titolare",
  manager: "Responsabile",
  chef: "Cuoco / Buyer",
  viewer: "Osservatore",
};

export const RESTAURANT_ROLE_DESCRIPTIONS: Record<RestaurantRole, string> = {
  owner: "Accesso completo: team, abbonamento, approvazione ordini, report finanziari.",
  manager: "Gestisce ordini e fornitori di una sede; no team, no abbonamento.",
  chef: "Crea bozze ordini, riceve merce, gestisce par levels e ordini-tipo.",
  viewer: "Sola lettura: spesa, fatture, analytics. Nessuna modifica.",
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/permissions.ts
git commit -m "feat(restaurant-1a): add permissions enum + matrix client-side helper"
```

---

## Task 4 — Helper TS: feature flag

**Files:**
- Create: `lib/restaurant/feature-flags.ts`

- [ ] **Step 1: Creare file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { RestaurantFeatureFlags } from "@/types/database";

export async function isRestaurantPhase1Enabled(restaurantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("feature_flags")
    .eq("id", restaurantId)
    .single<{ feature_flags: RestaurantFeatureFlags | null }>();

  return data?.feature_flags?.phase1_enabled === true;
}

/**
 * Gate di routing: se la fase 1 è spenta per questo restaurant, redirige a /dashboard.
 * Usare nei page.tsx delle nuove sezioni (team/approvazione/haccp/ecc).
 */
export async function requirePhase1(restaurantId: string, fallbackPath = "/dashboard"): Promise<void> {
  const enabled = await isRestaurantPhase1Enabled(restaurantId);
  if (!enabled) {
    redirect(fallbackPath);
  }
}

/**
 * Helper: recupera il restaurant_id primario dell'utente corrente.
 * Ritorna null se l'utente non ha ristoranti collegati.
 */
export async function getPrimaryRestaurantId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/feature-flags.ts
git commit -m "feat(restaurant-1a): add feature flag helper with phase1 gating"
```

---

## Task 5 — Helper TS: context (active member + permission require)

**Files:**
- Create: `lib/restaurant/context.ts`

- [ ] **Step 1: Creare file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { RestaurantMember, RestaurantPermission } from "@/types/database";

/**
 * Ritorna la membership attiva dell'utente corrente per il dato ristorante, o null.
 */
export async function getActiveRestaurantMember(restaurantId: string): Promise<RestaurantMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("restaurant_members")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle<RestaurantMember>();

  return data;
}

/**
 * Richiede una membership attiva — se assente redirige al login o dashboard.
 * Da usare a inizio page.tsx server component.
 */
export async function requireRestaurantMember(restaurantId: string): Promise<RestaurantMember> {
  const member = await getActiveRestaurantMember(restaurantId);
  if (!member) {
    redirect("/dashboard");
  }
  return member;
}

/**
 * Verifica via RPC (SECURITY DEFINER) se l'utente corrente ha il permesso richiesto
 * sul ristorante indicato. NON usare la matrice client-side per decisioni di sicurezza.
 */
export async function hasRestaurantPermission(
  restaurantId: string,
  permission: RestaurantPermission
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: permission,
  });

  if (error) return false;
  return data === true;
}

/**
 * Gate: se l'utente non ha il permesso, redirige. Da usare in page.tsx.
 */
export async function requirePermission(
  restaurantId: string,
  permission: RestaurantPermission,
  fallbackPath = "/dashboard"
): Promise<void> {
  const ok = await hasRestaurantPermission(restaurantId, permission);
  if (!ok) {
    redirect(fallbackPath);
  }
}
```

- [ ] **Step 2: Verificare che `supabase.rpc("has_restaurant_permission", …)` abbia type supportato**

Controlla se `types/database.ts` ha un tipo `Database` con le RPC typed. Se il progetto non tipa le RPC (il supplier 1A funziona senza), lascia come sopra con `.rpc(...)` unchecked — a runtime funziona. Se serve, casta:

```typescript
const { data, error } = await (supabase as any).rpc("has_restaurant_permission", {
  p_restaurant_id: restaurantId,
  p_permission: permission,
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/restaurant/context.ts
git commit -m "feat(restaurant-1a): add context helpers (member, permission)"
```

---

## Task 6 — Team domain: types

**Files:**
- Create: `lib/restaurant/team/types.ts`

- [ ] **Step 1: Creare file**

```typescript
import type { RestaurantMember, RestaurantRole } from "@/types/database";

export interface TeamMemberRow extends RestaurantMember {
  profile_email: string | null;
  profile_company_name: string | null;
}

export interface InvitePayload {
  restaurantId: string;
  email: string;
  role: Exclude<RestaurantRole, "owner">; // non si può invitare come owner, c'è già il titolare
  welcomeMessage?: string;
}

export interface InviteResult {
  memberId: string;
  inviteToken: string;
  inviteUrl: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/team/types.ts
git commit -m "feat(restaurant-1a): add team domain types"
```

---

## Task 7 — Team domain: Zod schemas

**Files:**
- Create: `lib/restaurant/team/schemas.ts`

- [ ] **Step 1: Creare file**

```typescript
import { z } from "zod/v4";

export const InviteMemberSchema = z.object({
  restaurantId: z.string().uuid(),
  email: z.string().email("Email non valida").toLowerCase().trim(),
  role: z.enum(["manager", "chef", "viewer"]),
  welcomeMessage: z.string().max(500).optional(),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["manager", "chef", "viewer"]),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export const DeactivateMemberSchema = z.object({
  memberId: z.string().uuid(),
});
export type DeactivateMemberInput = z.infer<typeof DeactivateMemberSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
});
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/team/schemas.ts
git commit -m "feat(restaurant-1a): add team Zod schemas"
```

---

## Task 8 — Team domain: email templates

**Files:**
- Create: `lib/restaurant/team/email-templates.ts`

- [ ] **Step 1: Creare file con template HTML + text dell'invito**

```typescript
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurant/permissions";
import type { RestaurantRole } from "@/types/database";

export interface InviteEmailData {
  restaurantName: string;
  inviterName: string;
  role: Exclude<RestaurantRole, "owner">;
  inviteUrl: string;
  welcomeMessage?: string;
}

export function buildInviteEmailHtml(data: InviteEmailData): string {
  const roleLabel = RESTAURANT_ROLE_LABELS[data.role];
  const safeMessage = data.welcomeMessage
    ? `<blockquote style="border-left:3px solid #d4d8d0;padding-left:12px;margin:16px 0;color:#5a6856;">${escapeHtml(data.welcomeMessage)}</blockquote>`
    : "";

  return `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f8f6f2;padding:32px 16px;color:#2d2d2d;">
    <table style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <tr><td>
        <h1 style="font-size:24px;font-weight:700;margin:0 0 16px 0;color:#2d2d2d;">Sei stato invitato su GastroBridge</h1>
        <p style="font-size:15px;line-height:1.55;margin:0 0 12px 0;">
          <strong>${escapeHtml(data.inviterName)}</strong> ti ha invitato a far parte del team di
          <strong>${escapeHtml(data.restaurantName)}</strong> come <strong>${escapeHtml(roleLabel)}</strong>.
        </p>
        ${safeMessage}
        <p style="margin:24px 0;">
          <a href="${escapeAttr(data.inviteUrl)}"
             style="display:inline-block;background:#2d4a2b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;">
            Accetta invito
          </a>
        </p>
        <p style="font-size:13px;color:#6b7262;margin:16px 0 0 0;">
          Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
          <span style="word-break:break-all;">${escapeHtml(data.inviteUrl)}</span>
        </p>
        <p style="font-size:12px;color:#9a9e94;margin:24px 0 0 0;">
          Questo invito scade tra 7 giorni. Se non ti aspettavi questo messaggio, puoi ignorarlo.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function buildInviteEmailText(data: InviteEmailData): string {
  const roleLabel = RESTAURANT_ROLE_LABELS[data.role];
  return `Sei stato invitato su GastroBridge.

${data.inviterName} ti ha invitato a far parte del team di ${data.restaurantName} come ${roleLabel}.
${data.welcomeMessage ? `\nMessaggio: ${data.welcomeMessage}\n` : ""}
Accetta l'invito: ${data.inviteUrl}

L'invito scade tra 7 giorni.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/team/email-templates.ts
git commit -m "feat(restaurant-1a): add invite email templates"
```

---

## Task 9 — Team domain: queries

**Files:**
- Create: `lib/restaurant/team/queries.ts`

- [ ] **Step 1: Creare file**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { TeamMemberRow } from "./types";

export async function listMembers(restaurantId: string): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_members")
    .select(
      `id, restaurant_id, profile_id, role, is_active, invited_by, invited_at, accepted_at,
       invite_token, invite_expires_at, invited_email, created_at, updated_at,
       profiles:profile_id (id, email, company_name)`
    )
    .eq("restaurant_id", restaurantId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const profile = (row as unknown as { profiles: { email: string | null; company_name: string | null } | null }).profiles;
    return {
      id: row.id as string,
      restaurant_id: row.restaurant_id as string,
      profile_id: row.profile_id as string,
      role: row.role as TeamMemberRow["role"],
      is_active: row.is_active as boolean,
      invited_by: (row.invited_by as string | null) ?? null,
      invited_at: row.invited_at as string,
      accepted_at: (row.accepted_at as string | null) ?? null,
      invite_token: (row.invite_token as string | null) ?? null,
      invite_expires_at: (row.invite_expires_at as string | null) ?? null,
      invited_email: (row.invited_email as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      profile_email: profile?.email ?? null,
      profile_company_name: profile?.company_name ?? null,
    };
  });
}

export async function getMemberByInviteToken(token: string): Promise<
  | {
      memberId: string;
      restaurantId: string;
      restaurantName: string;
      role: TeamMemberRow["role"];
      invitedEmail: string | null;
      expiresAt: string | null;
      alreadyAccepted: boolean;
    }
  | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_members")
    .select(
      "id, restaurant_id, role, invited_email, invite_expires_at, accepted_at, restaurants:restaurant_id (name)"
    )
    .eq("invite_token", token)
    .maybeSingle<{
      id: string;
      restaurant_id: string;
      role: TeamMemberRow["role"];
      invited_email: string | null;
      invite_expires_at: string | null;
      accepted_at: string | null;
      restaurants: { name: string } | null;
    }>();

  if (error || !data) return null;

  return {
    memberId: data.id,
    restaurantId: data.restaurant_id,
    restaurantName: data.restaurants?.name ?? "Ristorante",
    role: data.role,
    invitedEmail: data.invited_email,
    expiresAt: data.invite_expires_at,
    alreadyAccepted: data.accepted_at !== null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/team/queries.ts
git commit -m "feat(restaurant-1a): add team queries (listMembers, getMemberByInviteToken)"
```

---

## Task 10 — Team domain: server actions

**Files:**
- Create: `lib/restaurant/team/actions.ts`

- [ ] **Step 1: Creare file con 4 action**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import {
  AcceptInviteSchema,
  DeactivateMemberSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  type AcceptInviteInput,
  type DeactivateMemberInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "./schemas";
import { buildInviteEmailHtml, buildInviteEmailText } from "./email-templates";
import type { InviteResult } from "./types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const INVITE_TTL_DAYS = 7;

export async function inviteMember(input: InviteMemberInput): Promise<ActionResult<InviteResult>> {
  const parsed = InviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };
  }
  const { restaurantId, email, role, welcomeMessage } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  // Check permesso via RPC
  const { data: canManage } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "staff.manage",
  });
  if (canManage !== true) return { ok: false, error: "Non autorizzato" };

  const admin = createAdminClient();

  // Trova o crea il profilo dell'invitato by email
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, email, company_name")
    .eq("email", email)
    .maybeSingle<{ id: string; email: string; company_name: string | null }>();

  let inviteeProfileId: string;

  if (existingProfile) {
    inviteeProfileId = existingProfile.id;
  } else {
    // Crea auth user + profilo
    const { data: authResult, error: authErr } = await admin.auth.admin.inviteUserByEmail(email);
    if (authErr || !authResult?.user) {
      return { ok: false, error: `Errore invito: ${authErr?.message ?? "sconosciuto"}` };
    }
    inviteeProfileId = authResult.user.id;
  }

  // Check non sia già membro attivo
  const { data: existingMember } = await admin
    .from("restaurant_members")
    .select("id, is_active, accepted_at")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", inviteeProfileId)
    .maybeSingle<{ id: string; is_active: boolean; accepted_at: string | null }>();

  if (existingMember && existingMember.is_active) {
    return { ok: false, error: "Utente già membro attivo" };
  }

  // Restaurant + inviter name
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .single<{ name: string }>();

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("company_name, email")
    .eq("id", user.id)
    .single<{ company_name: string | null; email: string }>();

  // Genera token + scadenza
  const inviteToken = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  // Insert o update membership
  let memberId: string;
  if (existingMember) {
    const { data, error } = await admin
      .from("restaurant_members")
      .update({
        role,
        is_active: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        accepted_at: null,
        invite_token: inviteToken,
        invite_expires_at: expiresAt.toISOString(),
        invited_email: email,
      })
      .eq("id", existingMember.id)
      .select("id")
      .single<{ id: string }>();
    if (error || !data) return { ok: false, error: `Errore: ${error?.message ?? "update fallito"}` };
    memberId = data.id;
  } else {
    const { data, error } = await admin
      .from("restaurant_members")
      .insert({
        restaurant_id: restaurantId,
        profile_id: inviteeProfileId,
        role,
        is_active: true,
        invited_by: user.id,
        invite_token: inviteToken,
        invite_expires_at: expiresAt.toISOString(),
        invited_email: email,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) return { ok: false, error: `Errore: ${error?.message ?? "insert fallito"}` };
    memberId = data.id;
  }

  // Invia email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gastrobridge.it";
  const inviteUrl = `${appUrl}/invito-ristorante/${inviteToken}`;

  const emailData = {
    restaurantName: restaurant?.name ?? "Ristorante",
    inviterName: inviterProfile?.company_name ?? inviterProfile?.email ?? "Un membro del team",
    role,
    inviteUrl,
    welcomeMessage,
  };

  const emailResult = await sendEmail({
    to: email,
    subject: `Invito team — ${emailData.restaurantName}`,
    html: buildInviteEmailHtml(emailData),
    text: buildInviteEmailText(emailData),
  });

  if (!emailResult.ok) {
    // Log ma non abort — il record membership esiste
    console.warn("Invite email send failed:", emailResult.error);
  }

  revalidatePath("/impostazioni/team");
  return { ok: true, data: { memberId, inviteToken, inviteUrl } };
}

export async function updateMemberRole(input: UpdateMemberRoleInput): Promise<ActionResult<void>> {
  const parsed = UpdateMemberRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };
  const { memberId, role } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  // Fetch member to get restaurant_id
  const { data: member } = await supabase
    .from("restaurant_members")
    .select("id, restaurant_id, role")
    .eq("id", memberId)
    .maybeSingle<{ id: string; restaurant_id: string; role: string }>();
  if (!member) return { ok: false, error: "Membro non trovato" };
  if (member.role === "owner") return { ok: false, error: "Non puoi cambiare il ruolo del titolare" };

  const { data: canManage } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: member.restaurant_id,
    p_permission: "staff.manage",
  });
  if (canManage !== true) return { ok: false, error: "Non autorizzato" };

  const { error } = await supabase.from("restaurant_members").update({ role }).eq("id", memberId);
  if (error) return { ok: false, error: `Errore: ${error.message}` };

  revalidatePath("/impostazioni/team");
  return { ok: true, data: undefined };
}

export async function deactivateMember(input: DeactivateMemberInput): Promise<ActionResult<void>> {
  const parsed = DeactivateMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };
  const { memberId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("id, restaurant_id, role")
    .eq("id", memberId)
    .maybeSingle<{ id: string; restaurant_id: string; role: string }>();
  if (!member) return { ok: false, error: "Membro non trovato" };
  if (member.role === "owner") return { ok: false, error: "Non puoi disattivare il titolare" };

  const { data: canManage } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: member.restaurant_id,
    p_permission: "staff.manage",
  });
  if (canManage !== true) return { ok: false, error: "Non autorizzato" };

  const { error } = await supabase
    .from("restaurant_members")
    .update({ is_active: false })
    .eq("id", memberId);
  if (error) return { ok: false, error: `Errore: ${error.message}` };

  revalidatePath("/impostazioni/team");
  return { ok: true, data: undefined };
}

export async function acceptInvite(input: AcceptInviteInput): Promise<ActionResult<{ restaurantId: string }>> {
  const parsed = AcceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Token non valido" };
  const { token } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Devi prima accedere per accettare l'invito" };

  // Fetch invite (using service role to bypass RLS since token is the auth itself)
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("restaurant_members")
    .select("id, restaurant_id, profile_id, invited_email, invite_expires_at, accepted_at, is_active")
    .eq("invite_token", token)
    .maybeSingle<{
      id: string;
      restaurant_id: string;
      profile_id: string;
      invited_email: string | null;
      invite_expires_at: string | null;
      accepted_at: string | null;
      is_active: boolean;
    }>();

  if (!invite) return { ok: false, error: "Invito non valido o già usato" };
  if (invite.accepted_at) return { ok: false, error: "Invito già accettato" };
  if (!invite.is_active) return { ok: false, error: "Invito revocato" };
  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return { ok: false, error: "Invito scaduto" };
  }

  // Verify the logged in user matches (by profile_id or by invited_email)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", user.id)
    .single<{ id: string; email: string }>();

  const matchesProfile = profile?.id === invite.profile_id;
  const matchesEmail =
    !!invite.invited_email && profile?.email?.toLowerCase() === invite.invited_email.toLowerCase();

  if (!matchesProfile && !matchesEmail) {
    return { ok: false, error: "Questo invito non è per il tuo account" };
  }

  // Se matchesEmail ma non matchesProfile, riassegna profile_id (caso raro: utente crea account dopo invito)
  const updates: Record<string, unknown> = {
    accepted_at: new Date().toISOString(),
    invite_token: null,
    invite_expires_at: null,
  };
  if (!matchesProfile && matchesEmail) {
    updates.profile_id = user.id;
  }

  const { error } = await admin.from("restaurant_members").update(updates).eq("id", invite.id);
  if (error) return { ok: false, error: `Errore: ${error.message}` };

  revalidatePath("/dashboard");
  return { ok: true, data: { restaurantId: invite.restaurant_id } };
}
```

- [ ] **Step 2: Verifica `profiles` columns (già confermato: usa `company_name`, non `full_name`)**

Il codice sopra usa `company_name` — confermato esistente in `types/database.ts`. Se la struttura cambia in futuro, aggiornare di conseguenza.

- [ ] **Step 3: Verifica build**

```bash
npx tsc --noEmit
```

Expected: nessun errore nuovo.

- [ ] **Step 4: Commit**

```bash
git add lib/restaurant/team/actions.ts
git commit -m "feat(restaurant-1a): add team server actions (invite, updateRole, deactivate, accept)"
```

---

## Task 11 — Components: shared gates (role + feature flag)

**Files:**
- Create: `components/restaurant/shared/role-gate.tsx`
- Create: `components/restaurant/shared/feature-flag-gate.tsx`

- [ ] **Step 1: Creare `role-gate.tsx`**

```typescript
import type { ReactNode } from "react";
import { hasRestaurantPermission } from "@/lib/restaurant/context";
import type { RestaurantPermission } from "@/types/database";

interface RoleGateProps {
  restaurantId: string;
  permission: RestaurantPermission;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Server component: mostra children solo se l'utente ha il permesso.
 * Controllo reale via RPC (non client-side matrix).
 */
export async function RoleGate({ restaurantId, permission, children, fallback = null }: RoleGateProps) {
  const ok = await hasRestaurantPermission(restaurantId, permission);
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 2: Creare `feature-flag-gate.tsx`**

```typescript
import type { ReactNode } from "react";
import { isRestaurantPhase1Enabled } from "@/lib/restaurant/feature-flags";

interface FeatureFlagGateProps {
  restaurantId: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export async function Phase1Gate({ restaurantId, children, fallback = null }: FeatureFlagGateProps) {
  const enabled = await isRestaurantPhase1Enabled(restaurantId);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/restaurant/shared/
git commit -m "feat(restaurant-1a): add role-gate and phase1-gate server components"
```

---

## Task 12 — Team UI: server page rewrite

**Files:**
- Modify: `app/(app)/impostazioni/team/page.tsx` (riscrittura completa)
- Create: `app/(app)/impostazioni/team/team-client.tsx`
- Create: `components/restaurant/settings/team-member-row.tsx`
- Create: `components/restaurant/settings/invite-member-dialog.tsx`

- [ ] **Step 1: Creare `components/restaurant/settings/team-member-row.tsx`**

```typescript
"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, UserX, Mail, Clock } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { deactivateMember, updateMemberRole } from "@/lib/restaurant/team/actions";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurant/permissions";
import type { TeamMemberRow } from "@/lib/restaurant/team/types";
import type { RestaurantRole } from "@/types/database";

interface Props {
  member: TeamMemberRow;
  canManage: boolean;
}

export function TeamMemberRowComponent({ member, canManage }: Props) {
  const [pending, startTransition] = useTransition();

  const isPending = member.accepted_at === null;
  const displayName = member.profile_company_name || member.profile_email || member.invited_email || "Membro";

  function handleRoleChange(role: RestaurantRole) {
    if (role === "owner") return;
    startTransition(async () => {
      const res = await updateMemberRole({ memberId: member.id, role: role as "manager" | "chef" | "viewer" });
      if (res.ok) toast("Ruolo aggiornato");
      else toast(`Errore: ${res.error}`);
    });
  }

  function handleDeactivate() {
    if (!confirm(`Disattivare ${displayName}? Non potrà più accedere.`)) return;
    startTransition(async () => {
      const res = await deactivateMember({ memberId: member.id });
      if (res.ok) toast("Membro disattivato");
      else toast(`Errore: ${res.error}`);
    });
  }

  return (
    <div className="flex items-center justify-between py-4 border-b border-sage-muted/20 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-sage-muted/30 rounded-full flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-sage">{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-charcoal truncate">{displayName}</p>
            {isPending && (
              <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                <Clock className="h-3 w-3" /> In attesa
              </Badge>
            )}
            {!member.is_active && (
              <Badge variant="default" className="text-[10px]">
                Disattivato
              </Badge>
            )}
          </div>
          {member.profile_email && <p className="text-xs text-sage truncate flex items-center gap-1">
            <Mail className="h-3 w-3" /> {member.profile_email}
          </p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {member.role === "owner" ? (
          <Badge variant="success">{RESTAURANT_ROLE_LABELS.owner}</Badge>
        ) : canManage && member.is_active ? (
          <>
            <select
              disabled={pending}
              value={member.role}
              onChange={(e) => handleRoleChange(e.target.value as RestaurantRole)}
              className="text-sm border border-sage-muted/40 rounded-lg px-2 py-1 bg-white"
            >
              <option value="manager">{RESTAURANT_ROLE_LABELS.manager}</option>
              <option value="chef">{RESTAURANT_ROLE_LABELS.chef}</option>
              <option value="viewer">{RESTAURANT_ROLE_LABELS.viewer}</option>
            </select>
            <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={pending}>
              <UserX className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Badge variant="info">{RESTAURANT_ROLE_LABELS[member.role]}</Badge>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Creare `components/restaurant/settings/invite-member-dialog.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { UserPlus, X } from "lucide-react";
import { inviteMember } from "@/lib/restaurant/team/actions";
import { RESTAURANT_ROLE_LABELS, RESTAURANT_ROLE_DESCRIPTIONS } from "@/lib/restaurant/permissions";

interface Props {
  restaurantId: string;
}

export function InviteMemberDialog({ restaurantId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "chef" | "viewer">("chef");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteMember({
        restaurantId,
        email,
        role,
        welcomeMessage: message || undefined,
      });
      if (res.ok) {
        toast("Invito inviato");
        setOpen(false);
        setEmail("");
        setMessage("");
        setRole("chef");
      } else {
        toast(`Errore: ${res.error}`);
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Invita membro
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-charcoal">Invita un membro</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-sage-muted/30">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@ristorante.it"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-1">Ruolo</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "chef" | "viewer")}
              className="w-full border border-sage-muted/40 rounded-xl px-3 py-2 bg-white"
            >
              <option value="manager">{RESTAURANT_ROLE_LABELS.manager}</option>
              <option value="chef">{RESTAURANT_ROLE_LABELS.chef}</option>
              <option value="viewer">{RESTAURANT_ROLE_LABELS.viewer}</option>
            </select>
            <p className="text-xs text-sage mt-1">{RESTAURANT_ROLE_DESCRIPTIONS[role]}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-1">Messaggio (opzionale)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ciao! Ti ho aggiunto al team di…"
              className="w-full border border-sage-muted/40 rounded-xl px-3 py-2 bg-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Invio…" : "Invia invito"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Creare `app/(app)/impostazioni/team/team-client.tsx`**

```typescript
"use client";

import { TeamMemberRowComponent } from "@/components/restaurant/settings/team-member-row";
import { InviteMemberDialog } from "@/components/restaurant/settings/invite-member-dialog";
import { Card } from "@/components/ui/card";
import type { TeamMemberRow } from "@/lib/restaurant/team/types";

interface Props {
  restaurantId: string;
  members: TeamMemberRow[];
  canManage: boolean;
}

export function TeamClient({ restaurantId, members, canManage }: Props) {
  const activeMembers = members.filter((m) => m.is_active);
  const inactiveMembers = members.filter((m) => !m.is_active);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <InviteMemberDialog restaurantId={restaurantId} />
        </div>
      )}

      <Card>
        <h2 className="font-bold text-charcoal mb-2">Membri attivi ({activeMembers.length})</h2>
        <div>
          {activeMembers.length === 0 ? (
            <p className="text-sage text-sm py-4">Nessun membro.</p>
          ) : (
            activeMembers.map((m) => (
              <TeamMemberRowComponent key={m.id} member={m} canManage={canManage} />
            ))
          )}
        </div>
      </Card>

      {inactiveMembers.length > 0 && (
        <Card>
          <h2 className="font-bold text-charcoal mb-2">Disattivati ({inactiveMembers.length})</h2>
          <div>
            {inactiveMembers.map((m) => (
              <TeamMemberRowComponent key={m.id} member={m} canManage={false} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Riscrivere `app/(app)/impostazioni/team/page.tsx`**

Sostituisci il contenuto corrente con:

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPrimaryRestaurantId } from "@/lib/restaurant/feature-flags";
import { hasRestaurantPermission } from "@/lib/restaurant/context";
import { listMembers } from "@/lib/restaurant/team/queries";
import { TeamClient } from "./team-client";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const restaurantId = await getPrimaryRestaurantId();
  if (!restaurantId) {
    return (
      <div>
        <Link
          href="/impostazioni"
          className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Impostazioni
        </Link>
        <h1 className="text-2xl font-bold text-charcoal mb-2">Team</h1>
        <p className="text-sage">Nessun ristorante collegato al profilo.</p>
      </div>
    );
  }

  const members = await listMembers(restaurantId);
  const canManage = await hasRestaurantPermission(restaurantId, "staff.manage");

  return (
    <div>
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Team</h1>
        <p className="text-sage mt-1">
          Invita colleghi e assegna ruoli per gestire ordini, ricevimento e fornitori.
        </p>
      </div>

      <TeamClient restaurantId={restaurantId} members={members} canManage={canManage} />
    </div>
  );
}
```

- [ ] **Step 5: Verifica build + manuale in browser**

```bash
cd "D:/Manum/GastroBridge"
npx tsc --noEmit
npm run dev
```

Naviga a `http://localhost:3000/impostazioni/team` (loggato come owner).

Verifica:
- Vedi te stesso come "Titolare"
- Il bottone "Invita membro" è visibile
- Cliccando apri dialog → compila email valida + ruolo Chef → clicca "Invia invito"
- Toast "Invito inviato"
- Dopo refresh vedi la riga "In attesa" per il nuovo membro

- [ ] **Step 6: Commit**

```bash
git add app/(app)/impostazioni/team/ components/restaurant/settings/team-member-row.tsx components/restaurant/settings/invite-member-dialog.tsx
git commit -m "feat(restaurant-1a): rewrite team page with roles, invites, member management"
```

---

## Task 13 — Invito ristoratore: pagina accept

**Files:**
- Create: `app/invito-ristorante/[token]/page.tsx`
- Create: `app/invito-ristorante/[token]/accept-client.tsx`

- [ ] **Step 1: Creare page.tsx**

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberByInviteToken } from "@/lib/restaurant/team/queries";
import { Card } from "@/components/ui/card";
import { AcceptInviteClient } from "./accept-client";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getMemberByInviteToken(token);

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <Card className="max-w-md w-full text-center py-10">
          <h1 className="text-xl font-bold text-charcoal mb-2">Invito non valido</h1>
          <p className="text-sage mb-4">Questo link di invito non esiste o è già stato usato.</p>
          <Link href="/" className="text-forest underline">Torna alla home</Link>
        </Card>
      </div>
    );
  }

  if (invite.alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <Card className="max-w-md w-full text-center py-10">
          <h1 className="text-xl font-bold text-charcoal mb-2">Invito già accettato</h1>
          <p className="text-sage mb-4">Hai già accettato questo invito in precedenza.</p>
          <Link href="/dashboard" className="text-forest underline">Vai alla dashboard</Link>
        </Card>
      </div>
    );
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <Card className="max-w-md w-full text-center py-10">
          <h1 className="text-xl font-bold text-charcoal mb-2">Invito scaduto</h1>
          <p className="text-sage mb-4">Chiedi al titolare di inviartene uno nuovo.</p>
        </Card>
      </div>
    );
  }

  // Verifica se l'utente è loggato
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirige a login con redirect_to
    redirect(`/login?redirect_to=/invito-ristorante/${token}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <Card className="max-w-md w-full py-8 px-6">
        <h1 className="text-2xl font-bold text-charcoal mb-2">
          Benvenuto in {invite.restaurantName}
        </h1>
        <p className="text-sage mb-6">Accetta l'invito per iniziare a collaborare.</p>
        <AcceptInviteClient token={token} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Creare accept-client.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { acceptInvite } from "@/lib/restaurant/team/actions";

interface Props {
  token: string;
}

export function AcceptInviteClient({ token }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptInvite({ token });
      if (res.ok) {
        setAccepted(true);
        toast("Invito accettato");
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        toast(`Errore: ${res.error}`);
      }
    });
  }

  if (accepted) {
    return <p className="text-forest font-semibold">Redirezione alla dashboard…</p>;
  }

  return (
    <div className="flex gap-3">
      <Button onClick={handleAccept} disabled={pending} className="flex-1">
        {pending ? "Accettazione…" : "Accetta invito"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Manuale**

Con server dev acceso, apri l'URL dell'invito generato al Task 12 Step 5 (controlla email inviata o copia dal DB `SELECT invite_token FROM restaurant_members WHERE accepted_at IS NULL`). Loggati con l'account invitato, clicca "Accetta invito". Verifica redirect a dashboard e che in `/impostazioni/team` (loggato come owner) lo stato passi da "In attesa" a membro attivo.

- [ ] **Step 4: Commit**

```bash
git add app/invito-ristorante/
git commit -m "feat(restaurant-1a): add invite acceptance page"
```

---

## Task 14 — Settings: Zod schemas

**Files:**
- Create: `lib/restaurant/settings/schemas.ts`

- [ ] **Step 1: Creare file**

```typescript
import { z } from "zod/v4";

export const ApprovalThresholdSchema = z.object({
  restaurantId: z.string().uuid(),
  threshold: z
    .number()
    .min(0, "La soglia non può essere negativa")
    .max(1_000_000, "Soglia fuori range")
    .nullable(),
});
export type ApprovalThresholdInput = z.infer<typeof ApprovalThresholdSchema>;

const RangeSchema = z.object({
  min: z.number().min(-50).max(50).nullable(),
  max: z.number().min(-50).max(50).nullable(),
});

export const HaccpSettingsSchema = z.object({
  restaurantId: z.string().uuid(),
  frozen: RangeSchema,
  refrigerated: RangeSchema,
  ambient: RangeSchema,
  responsibleMemberId: z.string().uuid().nullable(),
  manualVersion: z.string().max(50).nullable(),
});
export type HaccpSettingsInput = z.infer<typeof HaccpSettingsSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/restaurant/settings/schemas.ts
git commit -m "feat(restaurant-1a): add settings Zod schemas"
```

---

## Task 15 — Settings: types + actions

**Files:**
- Create: `lib/restaurant/settings/types.ts`
- Create: `lib/restaurant/settings/actions.ts`

- [ ] **Step 1: Creare `types.ts`**

```typescript
export type SettingsActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

- [ ] **Step 2: Creare `actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  ApprovalThresholdSchema,
  HaccpSettingsSchema,
  type ApprovalThresholdInput,
  type HaccpSettingsInput,
} from "./schemas";
import type { SettingsActionResult } from "./types";

export async function updateApprovalThreshold(
  input: ApprovalThresholdInput
): Promise<SettingsActionResult> {
  const parsed = ApprovalThresholdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: canManage } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: parsed.data.restaurantId,
    p_permission: "settings.manage",
  });
  if (canManage !== true) return { ok: false, error: "Non autorizzato" };

  const { error } = await supabase
    .from("restaurants")
    .update({ approval_threshold: parsed.data.threshold })
    .eq("id", parsed.data.restaurantId);

  if (error) return { ok: false, error: `Errore: ${error.message}` };

  revalidatePath("/impostazioni/approvazione");
  return { ok: true, data: undefined };
}

export async function updateHaccpSettings(input: HaccpSettingsInput): Promise<SettingsActionResult> {
  const parsed = HaccpSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: canManage } = await supabase.rpc("has_restaurant_permission", {
    p_restaurant_id: parsed.data.restaurantId,
    p_permission: "settings.manage",
  });
  if (canManage !== true) return { ok: false, error: "Non autorizzato" };

  const haccpSettings = {
    frozen: parsed.data.frozen,
    refrigerated: parsed.data.refrigerated,
    ambient: parsed.data.ambient,
    responsible_member_id: parsed.data.responsibleMemberId,
    manual_version: parsed.data.manualVersion,
  };

  const { error } = await supabase
    .from("restaurants")
    .update({ haccp_settings: haccpSettings })
    .eq("id", parsed.data.restaurantId);

  if (error) return { ok: false, error: `Errore: ${error.message}` };

  revalidatePath("/impostazioni/haccp");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/restaurant/settings/
git commit -m "feat(restaurant-1a): add settings actions (approval threshold, HACCP)"
```

---

## Task 16 — Approval threshold UI

**Files:**
- Create: `app/(app)/impostazioni/approvazione/page.tsx`
- Create: `app/(app)/impostazioni/approvazione/approval-client.tsx`
- Create: `components/restaurant/settings/approval-threshold-form.tsx`

- [ ] **Step 1: Creare `components/restaurant/settings/approval-threshold-form.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateApprovalThreshold } from "@/lib/restaurant/settings/actions";
import { Infinity as InfinityIcon, Lock, ShieldCheck } from "lucide-react";

interface Props {
  restaurantId: string;
  initialThreshold: number | null;
  canManage: boolean;
}

type Mode = "never" | "always" | "threshold";

function detectMode(threshold: number | null): Mode {
  if (threshold === null) return "never";
  if (threshold === 0) return "always";
  return "threshold";
}

export function ApprovalThresholdForm({ restaurantId, initialThreshold, canManage }: Props) {
  const [mode, setMode] = useState<Mode>(detectMode(initialThreshold));
  const [thresholdValue, setThresholdValue] = useState<string>(
    initialThreshold !== null && initialThreshold > 0 ? String(initialThreshold) : "500"
  );
  const [pending, startTransition] = useTransition();

  function handleSave() {
    let threshold: number | null;
    if (mode === "never") threshold = null;
    else if (mode === "always") threshold = 0;
    else {
      const num = parseFloat(thresholdValue);
      if (Number.isNaN(num) || num < 0) {
        toast("Valore soglia non valido");
        return;
      }
      threshold = num;
    }

    startTransition(async () => {
      const res = await updateApprovalThreshold({ restaurantId, threshold });
      if (res.ok) toast("Impostazione salvata");
      else toast(`Errore: ${res.error}`);
    });
  }

  return (
    <Card>
      <h2 className="font-bold text-charcoal mb-2">Approvazione ordini</h2>
      <p className="text-sm text-sage mb-6">
        Decidi quando gli ordini creati dal team devono essere approvati dal titolare prima dell'invio.
      </p>

      <div className="space-y-3 mb-6">
        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${mode === "never" ? "border-forest bg-forest-light" : "border-sage-muted/30"}`}>
          <input
            type="radio"
            name="approval-mode"
            checked={mode === "never"}
            onChange={() => setMode("never")}
            disabled={!canManage}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <InfinityIcon className="h-4 w-4 text-sage" />
              <span className="font-semibold text-charcoal">Nessuna approvazione</span>
            </div>
            <p className="text-xs text-sage mt-1">
              Chiunque del team può inviare ordini direttamente. Consigliato per ristoratori singoli.
            </p>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${mode === "always" ? "border-forest bg-forest-light" : "border-sage-muted/30"}`}>
          <input
            type="radio"
            name="approval-mode"
            checked={mode === "always"}
            onChange={() => setMode("always")}
            disabled={!canManage}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sage" />
              <span className="font-semibold text-charcoal">Sempre approvazione</span>
            </div>
            <p className="text-xs text-sage mt-1">
              Ogni ordine creato da chef/manager richiede approvazione del titolare prima dell'invio.
            </p>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${mode === "threshold" ? "border-forest bg-forest-light" : "border-sage-muted/30"}`}>
          <input
            type="radio"
            name="approval-mode"
            checked={mode === "threshold"}
            onChange={() => setMode("threshold")}
            disabled={!canManage}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sage" />
              <span className="font-semibold text-charcoal">Soglia budget</span>
            </div>
            <p className="text-xs text-sage mt-1 mb-3">
              Approvazione richiesta solo per ordini sopra questo importo.
            </p>
            {mode === "threshold" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  disabled={!canManage}
                  className="max-w-[160px]"
                />
                <span className="text-sm text-sage">€</span>
              </div>
            )}
          </div>
        </label>
      </div>

      {canManage ? (
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Salvataggio…" : "Salva impostazione"}
        </Button>
      ) : (
        <p className="text-xs text-sage italic">Solo il titolare può modificare questa impostazione.</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Creare `approval-client.tsx` (wrapper se serve — o riusa direttamente il form)**

```typescript
"use client";

import { ApprovalThresholdForm } from "@/components/restaurant/settings/approval-threshold-form";

interface Props {
  restaurantId: string;
  initialThreshold: number | null;
  canManage: boolean;
}

export function ApprovalClient(props: Props) {
  return <ApprovalThresholdForm {...props} />;
}
```

- [ ] **Step 3: Creare `app/(app)/impostazioni/approvazione/page.tsx`**

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryRestaurantId } from "@/lib/restaurant/feature-flags";
import { hasRestaurantPermission } from "@/lib/restaurant/context";
import { ApprovalClient } from "./approval-client";

export const metadata: Metadata = { title: "Approvazione ordini" };

export default async function ApprovalSettingsPage() {
  const restaurantId = await getPrimaryRestaurantId();
  if (!restaurantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">Approvazione ordini</h1>
        <p className="text-sage">Nessun ristorante collegato al profilo.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("approval_threshold")
    .eq("id", restaurantId)
    .single<{ approval_threshold: number | null }>();

  const canManage = await hasRestaurantPermission(restaurantId, "settings.manage");

  return (
    <div>
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Approvazione ordini</h1>
        <p className="text-sage mt-1">
          Configura quando è richiesta l'approvazione del titolare per gli ordini del team.
        </p>
      </div>

      <ApprovalClient
        restaurantId={restaurantId}
        initialThreshold={restaurant?.approval_threshold ?? null}
        canManage={canManage}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manuale**

Avvia `npm run dev`. Naviga a `http://localhost:3000/impostazioni/approvazione`. Verifica:
- Vedi 3 radio buttons
- Seleziona "Soglia budget", inserisci 500 → salva → toast OK
- Ricarica pagina → selezione "Soglia budget" con valore 500 persistita
- In DB: `SELECT approval_threshold FROM restaurants WHERE id = '<id>'` → 500

- [ ] **Step 5: Commit**

```bash
git add app/(app)/impostazioni/approvazione/ components/restaurant/settings/approval-threshold-form.tsx
git commit -m "feat(restaurant-1a): add approval threshold settings page"
```

---

## Task 17 — HACCP settings UI

**Files:**
- Create: `components/restaurant/settings/haccp-ranges-form.tsx`
- Create: `app/(app)/impostazioni/haccp/page.tsx`
- Create: `app/(app)/impostazioni/haccp/haccp-client.tsx`

- [ ] **Step 1: Creare `haccp-ranges-form.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateHaccpSettings } from "@/lib/restaurant/settings/actions";
import { Snowflake, Refrigerator, Box } from "lucide-react";
import type { RestaurantHaccpSettings } from "@/types/database";

interface Props {
  restaurantId: string;
  initial: RestaurantHaccpSettings;
  members: { id: string; label: string }[];
  canManage: boolean;
}

export function HaccpRangesForm({ restaurantId, initial, members, canManage }: Props) {
  const [frozenMin, setFrozenMin] = useState(String(initial.frozen.min ?? -18));
  const [frozenMax, setFrozenMax] = useState(String(initial.frozen.max ?? -15));
  const [refMin, setRefMin] = useState(String(initial.refrigerated.min ?? 0));
  const [refMax, setRefMax] = useState(String(initial.refrigerated.max ?? 4));
  const [ambMin, setAmbMin] = useState(initial.ambient.min !== null ? String(initial.ambient.min) : "");
  const [ambMax, setAmbMax] = useState(initial.ambient.max !== null ? String(initial.ambient.max) : "");
  const [responsible, setResponsible] = useState(initial.responsible_member_id ?? "");
  const [manualVer, setManualVer] = useState(initial.manual_version ?? "");
  const [pending, startTransition] = useTransition();

  function parseNum(v: string): number | null {
    if (v === "") return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateHaccpSettings({
        restaurantId,
        frozen: { min: parseNum(frozenMin), max: parseNum(frozenMax) },
        refrigerated: { min: parseNum(refMin), max: parseNum(refMax) },
        ambient: { min: parseNum(ambMin), max: parseNum(ambMax) },
        responsibleMemberId: responsible || null,
        manualVersion: manualVer || null,
      });
      if (res.ok) toast("Impostazioni HACCP salvate");
      else toast(`Errore: ${res.error}`);
    });
  }

  return (
    <Card>
      <h2 className="font-bold text-charcoal mb-2">Range temperature HACCP</h2>
      <p className="text-sm text-sage mb-6">
        Imposta i range di temperatura conformi al tuo manuale di corretta prassi igienica.
        Saranno usati automaticamente al ricevimento per segnalare anomalie.
      </p>

      <div className="space-y-6">
        <RangeRow
          icon={<Snowflake className="h-4 w-4 text-sage" />}
          label="Surgelati"
          hint="Default normativo: -18 / -15 °C"
          minVal={frozenMin}
          maxVal={frozenMax}
          onMin={setFrozenMin}
          onMax={setFrozenMax}
          disabled={!canManage}
        />
        <RangeRow
          icon={<Refrigerator className="h-4 w-4 text-sage" />}
          label="Refrigerati"
          hint="Default normativo: 0 / 4 °C (pesce fresco: 0 / 2 °C)"
          minVal={refMin}
          maxVal={refMax}
          onMin={setRefMin}
          onMax={setRefMax}
          disabled={!canManage}
        />
        <RangeRow
          icon={<Box className="h-4 w-4 text-sage" />}
          label="Temperatura ambiente"
          hint="Lascia vuoto se non necessario tracciare"
          minVal={ambMin}
          maxVal={ambMax}
          onMin={setAmbMin}
          onMax={setAmbMax}
          disabled={!canManage}
          optional
        />

        <div className="pt-4 border-t border-sage-muted/20">
          <label className="block text-sm font-semibold text-charcoal mb-2">
            Responsabile HACCP
          </label>
          <select
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            disabled={!canManage}
            className="w-full border border-sage-muted/40 rounded-xl px-3 py-2 bg-white max-w-md"
          >
            <option value="">— nessuno —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-sage mt-1">
            Comparirà come firmatario nei log temperature e nei documenti HACCP.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-charcoal mb-2">
            Versione Manuale HACCP (opzionale)
          </label>
          <Input
            value={manualVer}
            onChange={(e) => setManualVer(e.target.value)}
            disabled={!canManage}
            placeholder="es. v2024.1"
            className="max-w-md"
            maxLength={50}
          />
        </div>
      </div>

      {canManage && (
        <Button onClick={handleSave} disabled={pending} className="mt-6">
          {pending ? "Salvataggio…" : "Salva impostazioni HACCP"}
        </Button>
      )}
      {!canManage && (
        <p className="text-xs text-sage italic mt-6">
          Solo chi ha il permesso "Gestisci impostazioni" può modificare questa sezione.
        </p>
      )}
    </Card>
  );
}

function RangeRow({
  icon,
  label,
  hint,
  minVal,
  maxVal,
  onMin,
  onMax,
  disabled,
  optional,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  disabled: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="pt-2">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-charcoal">{label}</span>
          {optional && <span className="text-[10px] text-sage">(opzionale)</span>}
        </div>
        <p className="text-xs text-sage mb-2">{hint}</p>
        <div className="flex items-center gap-2">
          <div>
            <span className="text-xs text-sage">Min</span>
            <Input
              type="number"
              step={0.5}
              value={minVal}
              onChange={(e) => onMin(e.target.value)}
              disabled={disabled}
              className="w-24"
            />
          </div>
          <span className="text-sage mt-5">/</span>
          <div>
            <span className="text-xs text-sage">Max</span>
            <Input
              type="number"
              step={0.5}
              value={maxVal}
              onChange={(e) => onMax(e.target.value)}
              disabled={disabled}
              className="w-24"
            />
          </div>
          <span className="text-sage mt-5">°C</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Creare `haccp-client.tsx`**

```typescript
"use client";

import { HaccpRangesForm } from "@/components/restaurant/settings/haccp-ranges-form";
import type { RestaurantHaccpSettings } from "@/types/database";

interface Props {
  restaurantId: string;
  initial: RestaurantHaccpSettings;
  members: { id: string; label: string }[];
  canManage: boolean;
}

export function HaccpClient(props: Props) {
  return <HaccpRangesForm {...props} />;
}
```

- [ ] **Step 3: Creare `page.tsx`**

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryRestaurantId } from "@/lib/restaurant/feature-flags";
import { hasRestaurantPermission } from "@/lib/restaurant/context";
import { listMembers } from "@/lib/restaurant/team/queries";
import { HaccpClient } from "./haccp-client";
import type { RestaurantHaccpSettings } from "@/types/database";

export const metadata: Metadata = { title: "HACCP" };

const DEFAULT_HACCP: RestaurantHaccpSettings = {
  frozen: { min: -18, max: -15 },
  refrigerated: { min: 0, max: 4 },
  ambient: { min: null, max: null },
  responsible_member_id: null,
  manual_version: null,
};

export default async function HaccpSettingsPage() {
  const restaurantId = await getPrimaryRestaurantId();
  if (!restaurantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">HACCP</h1>
        <p className="text-sage">Nessun ristorante collegato.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("haccp_settings")
    .eq("id", restaurantId)
    .single<{ haccp_settings: RestaurantHaccpSettings | null }>();

  const members = await listMembers(restaurantId);
  const memberOptions = members
    .filter((m) => m.is_active && m.accepted_at !== null)
    .map((m) => ({
      id: m.id,
      label: m.profile_company_name || m.profile_email || "Membro",
    }));

  const canManage = await hasRestaurantPermission(restaurantId, "settings.manage");

  return (
    <div>
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">HACCP</h1>
        <p className="text-sage mt-1">
          Configura range di temperatura e responsabile per il ricevimento merce conforme.
        </p>
      </div>

      <HaccpClient
        restaurantId={restaurantId}
        initial={restaurant?.haccp_settings ?? DEFAULT_HACCP}
        members={memberOptions}
        canManage={canManage}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manuale**

Avvia `npm run dev`. Vai a `/impostazioni/haccp`. Verifica:
- Vedi i 3 range (Surgelati -18/-15, Refrigerati 0/4, Ambiente vuoto)
- Modifica "Refrigerati max" da 4 a 3 → Salva → toast OK
- Ricarica → valore 3 persistito
- DB: `SELECT haccp_settings->'refrigerated' FROM restaurants WHERE id = '<id>'` → `{"min":0,"max":3}`

- [ ] **Step 5: Commit**

```bash
git add app/(app)/impostazioni/haccp/ components/restaurant/settings/haccp-ranges-form.tsx
git commit -m "feat(restaurant-1a): add HACCP settings page (temp ranges, responsible, manual version)"
```

---

## Task 18 — Impostazioni index: aggiungere voci

**Files:**
- Modify: `app/(app)/impostazioni/page.tsx`

- [ ] **Step 1: Aggiungere le nuove voci nell'array `SETTINGS_SECTIONS`**

Trova in `app/(app)/impostazioni/page.tsx` l'array `SETTINGS_SECTIONS`. Aggiungi dopo la voce "Team":

```typescript
  { href: "/impostazioni/approvazione", label: "Approvazione ordini", description: "Soglia budget e regole di approvazione", icon: ShieldCheck },
  { href: "/impostazioni/haccp", label: "HACCP", description: "Range temperature e responsabile", icon: Thermometer },
```

Aggiungi i due import nella sezione import da `lucide-react`:

```typescript
import { User, MapPin, Users, CreditCard, ChevronRight, SlidersHorizontal, ShieldCheck, Thermometer } from "lucide-react";
```

- [ ] **Step 2: Manuale**

Ricarica `/impostazioni`. Verifica che compaiano 2 nuove tile "Approvazione ordini" e "HACCP", clickabili e portano alle pagine giuste.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/impostazioni/page.tsx
git commit -m "feat(restaurant-1a): add approvazione and HACCP links to settings index"
```

---

## Task 19 — Feature flag: attivazione admin (seed per dev) + doc

**Files:**
- Create: `supabase/migrations/20260502100001_restaurant_phase1a_dev_enable.sql` (opzionale — solo per dev DB)
- Modify: (nessun altro file in Plan 1A; gating attivo in Plan 1B quando le nuove rotte esistono)

- [ ] **Step 1: Creare migration opzionale (se stai testando in dev locale)**

**NOTA:** questa migration è solo per sviluppo locale — NON deployarla in produzione. Serve per accendere il flag per tutti i ristoranti di test nel DB locale.

```sql
-- DEV ONLY: abilita phase1 per tutti i restaurants locali per testing.
-- NON merge-are in main prima della beta/GA.
-- Per rimuovere: UPDATE restaurants SET feature_flags = feature_flags - 'phase1_enabled';

UPDATE restaurants
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{phase1_enabled}',
  'true'::jsonb,
  true
);
```

Se stai lavorando solo in locale e vuoi saltare questa migration, puoi eseguire manualmente l'UPDATE nel SQL editor di Supabase Studio locale.

- [ ] **Step 2: Verifica**

```sql
SELECT id, name, feature_flags FROM restaurants LIMIT 5;
```

Atteso: `feature_flags` contiene `"phase1_enabled": true`.

- [ ] **Step 3: NON committare questa migration** (solo locale). Se proprio vuoi tenerla versionata dietro flag env, aggiungila a `.gitignore` per la sessione:

```bash
echo "supabase/migrations/20260502100001_restaurant_phase1a_dev_enable.sql" >> .gitignore
# poi riguarda .gitignore — assicurati di non averlo sporcato con altri pattern
```

Oppure applica solo manualmente via SQL console senza creare il file.

**Skip commit** per questo task.

---

## Task 20 — Verifica end-to-end manuale

- [ ] **Step 1: Reset + seed + dev**

```bash
cd "D:/Manum/GastroBridge"
npx supabase db reset
npm run dev
```

- [ ] **Step 2: Preparazione utenti test**

Crea (o riusa) due account di test:
- **Owner**: `owner@test.it` — ha un restaurant associato
- **Invitato**: `chef@test.it` — nessun restaurant ancora

- [ ] **Step 3: Journey Owner**

Loggato come `owner@test.it`:
1. Vai `/impostazioni/team` → vedi te stesso come Titolare
2. Clicca "Invita membro" → email `chef@test.it`, ruolo Chef, messaggio "Benvenuto"
3. Verifica toast "Invito inviato"
4. Controlla log Resend / inbox Mailpit / SQL `SELECT invite_token FROM restaurant_members WHERE invited_email = 'chef@test.it'`
5. Vai `/impostazioni/approvazione` → seleziona "Soglia budget" 500 → salva → verifica
6. Vai `/impostazioni/haccp` → modifica refrigerati max a 3 → salva → verifica
7. Torna a `/impostazioni/team` → la riga di chef ha badge "In attesa"

- [ ] **Step 4: Journey Chef (invitato)**

Loggato come `chef@test.it`:
1. Apri il link invito (dal DB / email)
2. Vedi card "Benvenuto in [nome]" con bottone "Accetta invito"
3. Clicca → toast "Invito accettato" → redirect a `/dashboard`
4. Torna al team: loggato come owner, `/impostazioni/team` → riga chef ora è attiva (no "In attesa")

- [ ] **Step 5: Journey permessi (verifica enforcement)**

Loggato come `chef@test.it` (che NON ha `staff.manage`):
1. Vai `/impostazioni/team` → NON vedi bottone "Invita membro"
2. Vai `/impostazioni/approvazione` → vedi il form ma messaggio "Solo il titolare può modificare"
3. Verifica SQL: `SELECT has_restaurant_permission('<rid>', 'staff.manage')` loggato come chef → `false`

- [ ] **Step 6: Commit messaggio finale (nessun file da committare)**

```bash
git log --oneline -20
```

Expected: vedi tutti i commit di Plan 1A.

---

## Self-Review

**Spec coverage (vs `docs/superpowers/specs/2026-04-16-admin-ristoratore-fase1-design.md` §9 Plan 1A):**

| Requisito spec | Task |
|---|---|
| Migration `restaurant_members` | Task 1 |
| Migration `role_permissions_restaurant` con seed matrice | Task 1 |
| Mod `restaurants`: feature_flags, approval_threshold, haccp_settings | Task 1 |
| Backfill owner membership | Task 1 |
| Helper RPC `has_restaurant_permission`, `is_restaurant_member` | Task 1 |
| Helper RPC `restaurant_member_role` | Task 1 (bonus) |
| UI `impostazioni/team` rifatta con ruoli + inviti | Task 12 + 13 |
| UI `impostazioni/approvazione` per soglia | Task 16 |
| UI `impostazioni/haccp` | Task 17 (bonus, era menzionata in §4.1 ma non esplicita in §9 1A — inclusa qui perché dipende dai ruoli) |
| Feature flag infrastructure | Task 4 (helper) + Task 19 (attivazione dev) |
| Integrazione con auth esistente | Task 10 (acceptInvite con check user logged) + Task 13 (redirect a /login) |

**Gap noti:**
- Il feature flag è definito ma NON è ancora usato per gating reale delle rotte 1A — perché 1A non introduce pagine nuove "consumer" (team/approvazione/haccp sono impostazioni sempre visibili anche a chi non è 1A-enabled; il gating completo arriva in Plan 1B quando ci sarà `/da-ordinare`). Decisione documentata in header architecture.
- `haccp_settings.responsible_member_id` viene scelto dal dropdown ma non ancora validato che sia effettivamente un membro (il vincolo è solo UI — si potrebbe aggiungere check FK in trigger; rinviato a 1C che introduce temperatura logs dove serve davvero).

**Placeholder scan:** nessuno (nessun TBD/TODO/FIXME).

**Type consistency:**
- `RestaurantRole` usato coerentemente in schemas (Zod `enum(['manager','chef','viewer'])` exclude 'owner' dove applicabile)
- `RestaurantPermission` string union usata in `roleHasPermission`, `ROLE_PERMISSIONS_MATRIX`, `RoleGate`, actions
- Return shape `{ ok: true; data } | { ok: false; error }` consistente in tutte le actions

**Convention consistency:**
- Tutte le server actions iniziano con `"use server"` ✓
- Tutte usano `createClient()` o `createAdminClient()` via `@/lib/supabase/*` ✓
- Zod import `zod/v4` ✓
- Icone da `lucide-react` ✓
- Stringhe UI italiane ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-restaurant-fase1a-fondamenta.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
