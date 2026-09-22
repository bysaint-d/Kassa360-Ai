import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';

export interface DbTransaction {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ changes: number }>;
}

class DatabaseManager {
  private pgPool: pg.Pool | null = null;
  private sqliteDb: DatabaseSync | null = null;
  private isPostgres = false;
  private initialized = false;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.isPostgres = true;
      this.pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
      console.log('📦 [Database] Initialized PostgreSQL connection pool');
    } else {
      this.isPostgres = false;
      const dbDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = process.env.SQLITE_DB_PATH || path.join(dbDir, 'kassa360.db');
      this.sqliteDb = new DatabaseSync(dbPath);
      // Enable WAL mode & foreign keys for high-performance concurrent reads/writes
      this.sqliteDb.exec('PRAGMA journal_mode = WAL;');
      this.sqliteDb.exec('PRAGMA foreign_keys = ON;');
      console.log(`📦 [Database] Initialized SQLite database at ${dbPath}`);
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      if (this.isPostgres && this.pgPool) {
        // Adjust syntax for PostgreSQL if needed (INTEGER -> BIGINT/INT, REAL -> DOUBLE PRECISION)
        const pgSchema = schemaSql
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
          .replace(/CURRENT_TIMESTAMP/gi, 'NOW()');
        await this.pgPool.query(pgSchema);
      } else if (this.sqliteDb) {
        this.sqliteDb.exec(schemaSql);
      }
      console.log('✅ [Database] Schema applied successfully');
    }

    this.initialized = true;
  }

  // Convert ? placeholder to $1, $2, etc. for PostgreSQL if running in Postgres mode
  private formatQuery(sql: string, isPg: boolean): string {
    if (!isPg) return sql;
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const formattedSql = this.formatQuery(sql, true);
      const res = await this.pgPool.query(formattedSql, params);
      return res.rows as T[];
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      const rows = stmt.all(...params);
      return rows as T[];
    }
    return [];
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const formattedSql = this.formatQuery(sql, true);
      const res = await this.pgPool.query(formattedSql, params);
      return { changes: res.rowCount || 0 };
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      const info = stmt.run(...params);
      return { changes: Number(info.changes || 0) };
    }
    return { changes: 0 };
  }

  public async transaction<T>(callback: (trx: DbTransaction) => Promise<T>): Promise<T> {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const trx: DbTransaction = {
          query: async <R = any>(q: string, p: any[] = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return res.rows as R[];
          },
          queryOne: async <R = any>(q: string, p: any[] = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return res.rows.length > 0 ? (res.rows[0] as R) : null;
          },
          execute: async (q: string, p: any[] = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return { changes: res.rowCount || 0 };
          },
        };
        const result = await callback(trx);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else if (this.sqliteDb) {
      this.sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const trx: DbTransaction = {
          query: async <R = any>(q: string, p: any[] = []) => {
            const stmt = this.sqliteDb!.prepare(q);
            return stmt.all(...p) as R[];
          },
          queryOne: async <R = any>(q: string, p: any[] = []) => {
            const stmt = this.sqliteDb!.prepare(q);
            const rows = stmt.all(...p) as R[];
            return rows.length > 0 ? rows[0] : null;
          },
          execute: async (q: string, p: any[] = []) => {
            const stmt = this.sqliteDb!.prepare(q);
            const info = stmt.run(...p);
            return { changes: Number(info.changes || 0) };
          },
        };
        const result = await callback(trx);
        this.sqliteDb.exec('COMMIT;');
        return result;
      } catch (err) {
        this.sqliteDb.exec('ROLLBACK;');
        throw err;
      }
    }
    throw new Error('Database not initialized');
  }

  public isUsingPostgres(): boolean {
    return this.isPostgres;
  }
}

export const db = new DatabaseManager();
