CREATE TABLE IF NOT EXISTS species_master (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  scientific_name  TEXT NOT NULL UNIQUE,
  genus            TEXT NOT NULL,
  species          TEXT,
  subspecies       TEXT,
  family           TEXT DEFAULT 'Cactaceae',
  rank             TEXT NOT NULL CHECK (rank IN ('GENUS','SPECIES','SUBSPECIES')),
  cites_appendix   TEXT,
  iucn_category    TEXT,
  iucn_taxon_id    INTEGER,
  source           TEXT NOT NULL CHECK (source IN ('CITES','IUCN','BOTH')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS species_synonym (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  species_id  INTEGER NOT NULL REFERENCES species_master(id) ON DELETE CASCADE,
  synonym     TEXT NOT NULL,
  UNIQUE(species_id, synonym)
);

CREATE INDEX IF NOT EXISTS idx_species_master_genus   ON species_master(genus);
CREATE INDEX IF NOT EXISTS idx_species_synonym_species ON species_synonym(species_id);

CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id          TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  scientific_name  TEXT,
  price            REAL,
  currency         TEXT,
  in_stock         INTEGER,
  product_url      TEXT NOT NULL,
  image_url        TEXT,
  species_id       INTEGER REFERENCES species_master(id),
  cites_appendix   TEXT,
  match_status     TEXT CHECK (match_status IN ('confirmed','needs_review','none')),
  last_checked_at  TEXT,
  raw_data         TEXT,
  UNIQUE(site_id, product_url)
);

CREATE INDEX IF NOT EXISTS idx_products_species ON products(species_id);
