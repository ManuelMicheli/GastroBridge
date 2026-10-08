-- Order to any supplier, any channel
-- (docs/superpowers/specs/2026-10-08-restaurant-superpowers.md §4.9).
--
-- Suppliers that are not on the platform (private catalogs, restaurant_catalogs)
-- receive orders through their preferred channel: WhatsApp deep link, email
-- (Resend, PDF attached, reply-to the restaurant) or a printed / downloaded PDF.
--
--   restaurant_catalog_contacts  preferred channel + contact per private supplier
--                                (separate table: restaurant_catalogs is left
--                                untouched for the catalog import flows)
--   order_dispatches             how/when each supplier block of an order was
--                                sent, and when the supplier confirmed it
--
-- Purely ADDITIVE; policies in DO blocks guarded by pg_policies; no DROP.
-- Depends on 20261009000100 (private.restaurant_can / restaurant_can_read).

CREATE TABLE IF NOT EXISTS public.restaurant_catalog_contacts (
  catalog_id         uuid PRIMARY KEY REFERENCES public.restaurant_catalogs(id) ON DELETE CASCADE,
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  preferred_channel  text NOT NULL DEFAULT 'whatsapp'
                     CHECK (preferred_channel IN ('whatsapp', 'email', 'pdf', 'phone')),
  contact_name       text NULL CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  -- International format, digits only (e.g. 393331234567) for wa.me links.
  whatsapp_phone     text NULL CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]{6,15}$'),
  email              text NULL CHECK (email IS NULL OR (char_length(email) <= 200 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  notes              text NULL CHECK (notes IS NULL OR char_length(notes) <= 300),
  updated_by         uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_catalog_contacts_restaurant
  ON public.restaurant_catalog_contacts (restaurant_id);

CREATE OR REPLACE TRIGGER trg_restaurant_catalog_contacts_touch
  BEFORE UPDATE ON public.restaurant_catalog_contacts
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.restaurant_catalog_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.order_dispatches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- Index of the supplier block in orders.notes ("--- Fornitore (€) ---").
  block_index    integer NOT NULL CHECK (block_index >= 0),
  catalog_id     uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE SET NULL,
  supplier_label text NOT NULL CHECK (char_length(supplier_label) BETWEEN 1 AND 200),
  channel        text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'pdf', 'phone')),
  recipient      text NULL CHECK (recipient IS NULL OR char_length(recipient) <= 200),
  status         text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'confirmed')),
  email_message_id text NULL,
  sent_by        uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  confirmed_by   uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at   timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_order_dispatches_order ON public.order_dispatches (order_id, block_index, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_dispatches_restaurant ON public.order_dispatches (restaurant_id, sent_at DESC);

ALTER TABLE public.order_dispatches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_catalog_contacts' AND policyname = 'catalog contacts team read') THEN
    CREATE POLICY "catalog contacts team read" ON public.restaurant_catalog_contacts
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_catalog_contacts' AND policyname = 'catalog contacts team write') THEN
    CREATE POLICY "catalog contacts team write" ON public.restaurant_catalog_contacts
      FOR ALL
      USING (private.restaurant_can(restaurant_id, 'order.submit'))
      WITH CHECK (
        private.restaurant_can(restaurant_id, 'order.submit')
        AND EXISTS (
          SELECT 1 FROM public.restaurant_catalogs rc
          WHERE rc.id = catalog_id AND rc.restaurant_id = restaurant_catalog_contacts.restaurant_id
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'order_dispatches' AND policyname = 'order dispatches team read') THEN
    CREATE POLICY "order dispatches team read" ON public.order_dispatches
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'order_dispatches' AND policyname = 'order dispatches team send') THEN
    CREATE POLICY "order dispatches team send" ON public.order_dispatches
      FOR INSERT WITH CHECK (
        sent_by = auth.uid()
        AND private.restaurant_can(restaurant_id, 'order.submit')
        AND EXISTS (SELECT 1 FROM public.orders o
                    WHERE o.id = order_id AND o.restaurant_id = order_dispatches.restaurant_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'order_dispatches' AND policyname = 'order dispatches team confirm') THEN
    CREATE POLICY "order dispatches team confirm" ON public.order_dispatches
      FOR UPDATE
      USING (private.restaurant_can(restaurant_id, 'order.submit'))
      WITH CHECK (private.restaurant_can(restaurant_id, 'order.submit'));
  END IF;
END $$;
