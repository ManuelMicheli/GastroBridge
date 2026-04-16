-- Phase 2A — Meilisearch sync outbox
--
-- Transactional outbox so every INSERT/UPDATE/DELETE on products
-- enqueues a row in meilisearch_sync_queue. A worker route handler
-- (invoked by pg_cron or external cron) drains the queue in batches,
-- applies upsert/delete to the Meilisearch index, and marks rows as
-- processed. This decouples write path from Meilisearch availability
-- and avoids per-row HTTP calls inside PL/pgSQL.

CREATE TABLE IF NOT EXISTS meilisearch_sync_queue (
  id           bigserial   PRIMARY KEY,
  entity_type  text        NOT NULL,
  entity_id    uuid        NOT NULL,
  op           text        NOT NULL CHECK (op IN ('upsert', 'delete')),
  enqueued_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  attempts     int         NOT NULL DEFAULT 0,
  last_error   text        NULL
);

-- Hot-path index: unprocessed rows in FIFO order.
CREATE INDEX IF NOT EXISTS idx_meilisearch_sync_queue_pending
  ON meilisearch_sync_queue (enqueued_at)
  WHERE processed_at IS NULL;

-- Lookup by entity for dedup/coalesce.
CREATE INDEX IF NOT EXISTS idx_meilisearch_sync_queue_entity
  ON meilisearch_sync_queue (entity_type, entity_id);

-- ------------------------------------------------------------------
-- Enqueue function + trigger
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enqueue_product_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO meilisearch_sync_queue (entity_type, entity_id, op)
    VALUES ('product', OLD.id, 'delete');
    RETURN OLD;
  ELSE
    INSERT INTO meilisearch_sync_queue (entity_type, entity_id, op)
    VALUES ('product', NEW.id, 'upsert');
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_meilisearch_sync ON products;
CREATE TRIGGER trg_products_meilisearch_sync
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_product_sync();

-- ------------------------------------------------------------------
-- RLS — outbox is infrastructure, never exposed to clients
-- ------------------------------------------------------------------

ALTER TABLE meilisearch_sync_queue ENABLE ROW LEVEL SECURITY;

-- Deny-all for anon/authenticated. service_role bypasses RLS by default.
CREATE POLICY "meilisearch_sync_queue_deny_all"
  ON meilisearch_sync_queue
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
