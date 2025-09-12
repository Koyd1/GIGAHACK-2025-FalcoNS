import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER || 'parking'}:${process.env.POSTGRES_PASSWORD || 'parking'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'parking'}`
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
