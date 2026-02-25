import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

declare global {
  var __officeDbEnvLoggedOnce: boolean | undefined;
}

const shouldLogDbEnvBootstrap = process.env.DEBUG_DB_BOOTSTRAP === 'true' && globalThis.__officeDbEnvLoggedOnce !== true;
const shouldLogDbQueries = process.env.DEBUG_DB_QUERIES === 'true';

// Load .env.local file explicitly (for PM2 and production)
// Next.js loads it in dev, but PM2 doesn't in production
if (typeof window === 'undefined') {
  const envPath = resolve(process.cwd(), '.env.local');
  const envExists = existsSync(envPath);

  if (shouldLogDbEnvBootstrap) {
    console.log('[db.ts] Loading .env.local:', {
      path: envPath,
      exists: envExists,
      cwd: process.cwd(),
    });
  }
  
  if (envExists) {
    // Read file content first to debug
    const fs = require('fs');
    const fileContent = fs.readFileSync(envPath, 'utf8');
    const lines = fileContent.split('\n').filter((line: string) => line.trim() && !line.trim().startsWith('#'));
    if (shouldLogDbEnvBootstrap) {
      console.log('[db.ts] File has', lines.length, 'non-empty, non-comment lines');
    }
    
    // Try to load with dotenv first
    const result = dotenv.config({ path: envPath, override: false, quiet: true });
    
    // If dotenv didn't parse anything (injecting 0), manually parse the file
    if (!result.parsed || Object.keys(result.parsed).length === 0) {
      if (shouldLogDbEnvBootstrap) {
        console.warn('[db.ts] ⚠️ dotenv injected 0 variables, manually parsing file');
      }
      
      // Manually parse .env.local file
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            // Only set if not already in process.env
            if (!process.env[key]) {
              process.env[key] = value;
              if (shouldLogDbEnvBootstrap) {
                console.log('[db.ts] Manually set:', key, '=', value.substring(0, 20) + (value.length > 20 ? '...' : ''));
              }
            }
          }
        }
      });
    } else {
      if (shouldLogDbEnvBootstrap) {
        console.log('[db.ts] ✅ .env.local loaded successfully via dotenv');
        console.log('[db.ts] Parsed variables:', Object.keys(result.parsed || {}));
      }
    }

    if (shouldLogDbEnvBootstrap) {
      console.log('[db.ts] Final check - DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');
      console.log('[db.ts] Final check - JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET');
    }
  } else {
    if (shouldLogDbEnvBootstrap) {
      console.warn('[db.ts] ⚠️ .env.local file not found at:', envPath);
    }
  }

  if (shouldLogDbEnvBootstrap) {
    globalThis.__officeDbEnvLoggedOnce = true;
  }
}

// Database connection pool
let pool: Pool | null = null;

function resolveConnectionHost(connectionString: string): string {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return process.env.DB_HOST || 'localhost';
  }
}

function isLocalHost(host: string): boolean {
  const normalized = (host || '').toLowerCase().trim();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function getPool(): Pool {
  if (!pool) {
    // Log all environment variables (without sensitive data)
    console.log('Database environment check:', {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_length: process.env.DATABASE_URL?.length || 0,
      DB_USER: process.env.DB_USER || 'not set',
      DB_HOST: process.env.DB_HOST || 'not set',
      DB_PORT: process.env.DB_PORT || 'not set',
      DB_NAME: process.env.DB_NAME || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    });

    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'office_app'}`;
    const connectionHost = resolveConnectionHost(connectionString);

    if (process.env.NODE_ENV !== 'production' && !isLocalHost(connectionHost) && process.env.ALLOW_REMOTE_DB_IN_DEV !== 'true') {
      throw new Error(
        `Development mode requires local database. Current host: ${connectionHost}. ` +
        `Set DATABASE_URL/DB_HOST to localhost or set ALLOW_REMOTE_DB_IN_DEV=true to override.`
      );
    }
    
    // Determine if we should use SSL
    // Use SSL if: production mode OR remote host (not localhost/127.0.0.1)
    const isRemote = !isLocalHost(connectionHost);
    const useSSL = process.env.NODE_ENV === 'production' || isRemote || 
                   (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost'));
    
    // Log connection info (without password)
    const safeConnectionString = connectionString.replace(/:[^:@]+@/, ':****@');
    console.log('Initializing database pool:', {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      host: connectionHost,
      useSSL,
      safeConnectionString,
    });
    
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2000 to 10000 for remote connections
      query_timeout: 15000,
    });

    pool.on('connect', (client) => {
      client
        .query(`
          SET statement_timeout = '15s';
          SET lock_timeout = '5s';
          SET idle_in_transaction_session_timeout = '30s';
        `)
        .catch((err) => {
          console.error('Failed to apply PostgreSQL session timeouts:', err);
        });
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      // Don't exit in development, just log
      if (process.env.NODE_ENV === 'production') {
        process.exit(-1);
      }
    });
  }

  return pool;
}

// Helper function za izvršavanje queries
export async function query<T extends import('pg').QueryResultRow = import('pg').QueryResultRow>(text: string, params?: any[]): Promise<import('pg').QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn('Slow query detected', { text, duration, rows: res.rowCount });
    } else if (shouldLogDbQueries) {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error: any) {
    console.error('Database query error:', {
      text,
      params,
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
    });
    throw error;
  }
}

// Helper function za transakcije
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}


