-- supabase/migrations/20260420100000_fiscal_enums.sql
-- Cassetto Fiscale: enum types

CREATE TYPE fiscal_provider AS ENUM (
  'tilby',
  'cassa_in_cloud',
  'lightspeed',
  'scloby',
  'tcpos',
  'revo',
  'simphony',
  'hiopos',
  'generic_webhook',
  'csv_upload'
);

CREATE TYPE fiscal_integration_status AS ENUM (
  'pending_auth',
  'active',
  'paused',
  'error',
  'revoked'
);

CREATE TYPE fiscal_receipt_status AS ENUM (
  'issued',
  'voided',
  'refunded',
  'partial_refund'
);

CREATE TYPE reorder_urgency AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);
