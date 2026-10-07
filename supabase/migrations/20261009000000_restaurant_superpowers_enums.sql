-- Restaurant superpowers (docs/superpowers/specs/2026-10-08-restaurant-superpowers.md)
-- New in-app / push notification kinds for the restaurant side.
--
-- Kept in its own migration: a value added with ALTER TYPE … ADD VALUE cannot be
-- used in the same transaction that adds it. Purely additive.

ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'order_cutoff_reminder';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'price_change';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'kitchen_request';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'delivery_issue';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'restaurant_digest';
