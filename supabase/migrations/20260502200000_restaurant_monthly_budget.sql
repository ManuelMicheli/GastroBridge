-- Restaurant monthly budget column
-- Used by /analytics page to track spending vs monthly target and project end-of-month spend.
-- Nullable: budget is opt-in (ristoratore lo imposta da /impostazioni/budget).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS monthly_budget_eur numeric
  CHECK (monthly_budget_eur IS NULL OR monthly_budget_eur >= 0);
