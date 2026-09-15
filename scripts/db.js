import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'cactus.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

export function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}
