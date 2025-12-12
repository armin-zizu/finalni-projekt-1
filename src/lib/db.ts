import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local file explicitly (for PM2 and production)
// Next.js loads it in dev, but PM2 doesn't in production
if (typeof window === 'undefined') {
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
}

// Database connection pool
let pool: Pool | null = null;

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
    
    // Determine if we should use SSL
    // Use SSL if: production mode OR remote host (not localhost/127.0.0.1)
    const isRemote = process.env.DB_HOST && 
                     !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);
    const useSSL = process.env.NODE_ENV === 'production' || isRemote || 
                   (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost'));
    
    // Log connection info (without password)
    const safeConnectionString = connectionString.replace(/:[^:@]+@/, ':****@');
    console.log('Initializing database pool:', {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      useSSL,
      safeConnectionString,
    });
    
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2000 to 10000 for remote connections
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
export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    console.error('Database query error:', {
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


