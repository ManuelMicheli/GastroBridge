-- GastroBridge: enums for restaurant-supplier relationships
CREATE TYPE relationship_status AS ENUM (
  'pending',    -- invito inviato dal ristoratore, in attesa risposta fornitore
  'active',     -- relazione accettata, operativa
  'paused',     -- sospesa temporaneamente (nessun ordine possibile)
  'rejected',   -- fornitore ha rifiutato l'invito
  'archived'    -- archiviata dal ristoratore (non eliminata)
);

CREATE TYPE catalog_source AS ENUM (
  'manual',           -- catalogo creato a mano dal ristoratore
  'supplier_managed', -- fornitore registrato gestisce i prezzi
  'imported'          -- importato da CSV/OCR
);
