BEGIN;

DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_reader'
  ) THEN
    EXECUTE 'CREATE ROLE proply_research_reader';
  END IF;
END
$role$;

DO $protected_attributes$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'proply_research_reader'
      AND (rolsuper OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION
      'proply_research_reader has a protected elevated attribute; refusing to continue';
  END IF;
END
$protected_attributes$;

ALTER ROLE proply_research_reader
  NOLOGIN
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  CONNECTION LIMIT 10;

DO $role_safety$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'proply_research_reader'
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
           OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'proply_research_reader role hardening failed';
  END IF;
END
$role_safety$;

ALTER ROLE proply_research_reader SET search_path = research, pg_catalog;
ALTER ROLE proply_research_reader SET default_transaction_read_only = on;
ALTER ROLE proply_research_reader SET statement_timeout = '3000ms';
ALTER ROLE proply_research_reader SET lock_timeout = '500ms';
ALTER ROLE proply_research_reader SET idle_in_transaction_session_timeout = '5000ms';

DO $database$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO proply_research_reader',
    current_database()
  );
END
$database$;

CREATE SCHEMA IF NOT EXISTS research;

REVOKE ALL ON SCHEMA research FROM PUBLIC;
REVOKE ALL ON SCHEMA research FROM proply_research_reader;
REVOKE ALL ON SCHEMA public FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA research FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA research FROM proply_research_reader;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA research FROM proply_research_reader;

CREATE OR REPLACE VIEW research.market_summary_source
WITH (security_barrier = true)
AS
SELECT
  split_part(upper(postcode), ' ', 1)::text AS area,
  extract(year FROM transfer_date)::integer AS sale_year,
  property_type::text AS property_type,
  price::bigint AS sold_price,
  max(imported_at) OVER () AS data_refreshed_at
FROM public.land_registry_transactions
WHERE split_part(upper(postcode), ' ', 1) IN ('E10', 'E11', 'E17')
  AND transfer_date >= DATE '1995-01-01'
  AND tenure = 'F'
  AND category_type = 'A'
  AND property_type IN ('D', 'S', 'T', 'F')
  AND market_price_outlier = false;

COMMENT ON VIEW research.market_summary_source IS
  'Reduced internal source for bounded aggregate market summaries; never expose as a raw public endpoint.';

REVOKE ALL PRIVILEGES ON research.market_summary_source FROM PUBLIC;
REVOKE ALL PRIVILEGES ON research.market_summary_source FROM proply_research_reader;
GRANT USAGE ON SCHEMA research TO proply_research_reader;
GRANT SELECT ON research.market_summary_source TO proply_research_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM proply_research_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM proply_research_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM proply_research_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON TABLES FROM proply_research_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM proply_research_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM proply_research_reader;

COMMIT;
