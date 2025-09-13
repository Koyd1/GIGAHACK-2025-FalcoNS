-- Reset staging schema to avoid conflicts from previous imports
DROP SCHEMA IF EXISTS staging_sqlite CASCADE;
CREATE SCHEMA staging_sqlite;
SET search_path TO staging_sqlite;
