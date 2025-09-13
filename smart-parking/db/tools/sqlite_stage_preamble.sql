-- Create isolated schema and set search_path so the SQLite dump
-- (parking_sqlite.sql) is loaded into this staging area.
CREATE SCHEMA IF NOT EXISTS staging_sqlite;
SET search_path TO staging_sqlite;

