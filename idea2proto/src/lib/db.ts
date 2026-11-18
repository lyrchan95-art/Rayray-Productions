import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const g = globalThis as unknown as { __db?: DatabaseSync };

function open(): DatabaseSync {
  const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      email_verified INTEGER,
      image TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      register TEXT NOT NULL DEFAULT 'yue',
      pics_accepted_at INTEGER,
      training_opt_in INTEGER NOT NULL DEFAULT 0,
      stripe_customer_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      PRIMARY KEY (provider, provider_account_id)
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      one_liner TEXT NOT NULL DEFAULT '',
      spec_json TEXT NOT NULL,
      skill TEXT NOT NULL,
      raw_input TEXT NOT NULL DEFAULT '',
      input_mode TEXT NOT NULL DEFAULT 'text',
      current_version INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ideas_user ON ideas(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      skill TEXT,
      version_n INTEGER,
      feedback INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_idea ON messages(idea_id, created_at);
    CREATE TABLE IF NOT EXISTS versions (
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      n INTEGER NOT NULL,
      html TEXT NOT NULL,
      skill TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (idea_id, n)
    );
    CREATE TABLE IF NOT EXISTS publications (
      slug TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      version_n INTEGER NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    );
  `);
  return db;
}

export const db: DatabaseSync = g.__db ?? (g.__db = open());

export const newId = () => randomUUID();
export const now = () => Date.now();

type Row = Record<string, unknown>;
export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}
export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}
