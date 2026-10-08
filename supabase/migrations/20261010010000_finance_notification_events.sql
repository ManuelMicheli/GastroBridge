-- Fatture fornitori + food cost: new in-app / push notification kinds.
--
-- Kept in its own migration: a value added with ALTER TYPE … ADD VALUE cannot
-- be used in the same transaction that adds it. Purely additive.

ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'invoice_received';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'invoice_anomaly';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'food_cost_alert';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'payment_due';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'finance_digest';
