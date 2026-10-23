BEGIN;

DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_api'
  ) THEN
    EXECUTE 'CREATE ROLE proply_research_api';
  END IF;
END
$role$;

DO $protected_attributes$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'proply_research_api'
      AND (rolsuper OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION
      'proply_research_api has a protected elevated attribute; refusing to continue';
  END IF;
END
$protected_attributes$;

DO $ownership$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_api')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace
    WHERE nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_api')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datdba = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_api')
  ) THEN
    RAISE EXCEPTION 'proply_research_api owns database objects; refusing to reconfigure';
  END IF;
END
$ownership$;

DO $memberships$
DECLARE
  granted_role record;
BEGIN
  FOR granted_role IN
    SELECT role.rolname
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles role ON role.oid = membership.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'proply_research_api'
  LOOP
    EXECUTE format('REVOKE %I FROM proply_research_api', granted_role.rolname);
  END LOOP;
END
$memberships$;

ALTER ROLE proply_research_api
  NOLOGIN
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  CONNECTION LIMIT 4;

DO $role_safety$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'proply_research_api'
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
           OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'proply_research_api role hardening failed';
  END IF;
END
$role_safety$;

ALTER ROLE proply_research_api RESET ALL;
ALTER ROLE proply_research_api SET search_path = research, pg_catalog;
ALTER ROLE proply_research_api SET default_transaction_read_only = on;
ALTER ROLE proply_research_api SET statement_timeout = '3000ms';
ALTER ROLE proply_research_api SET lock_timeout = '500ms';
ALTER ROLE proply_research_api SET idle_in_transaction_session_timeout = '5000ms';

DO $database$
BEGIN
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM proply_research_api',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO proply_research_api',
    current_database()
  );
END
$database$;

REVOKE ALL ON SCHEMA public FROM proply_research_api;
REVOKE ALL ON SCHEMA research FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA research FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA research FROM proply_research_api;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA research FROM proply_research_api;

GRANT USAGE ON SCHEMA research TO proply_research_api;
GRANT SELECT ON research.market_summary_source TO proply_research_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM proply_research_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM proply_research_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM proply_research_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON TABLES FROM proply_research_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM proply_research_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM proply_research_api;

COMMIT;

-- This script deliberately leaves the role without login capability and does
-- not set a password. Credential issuance and ALTER ROLE ... LOGIN are separate
-- operator actions requiring explicit approval after effective grants pass.
