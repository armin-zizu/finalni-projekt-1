import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isAdminRequest(req: AuthRequest): boolean {
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'gitara.zizu@gmail.com')
    .toLowerCase()
    .trim();
  const userEmail = (req.user?.email || '').toLowerCase().trim();
  return !!userEmail && userEmail === adminEmail;
}

async function handler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const longRunning = await query(
      `SELECT
         pid,
         usename,
         state,
         wait_event_type,
         wait_event,
         now() - xact_start AS xact_age,
         now() - query_start AS query_age,
         LEFT(query, 400) AS query
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND xact_start IS NOT NULL
         AND now() - xact_start > interval '60 seconds'
       ORDER BY xact_age DESC`
    );

    const blockedBlocking = await query(
      `SELECT
         blocked.pid AS blocked_pid,
         blocked.usename AS blocked_user,
         now() - blocked.query_start AS blocked_for,
         LEFT(blocked.query, 200) AS blocked_query,
         blocking.pid AS blocking_pid,
         blocking.usename AS blocking_user,
         now() - blocking.query_start AS blocking_for,
         LEFT(blocking.query, 200) AS blocking_query
       FROM pg_stat_activity blocked
       JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
       JOIN pg_locks blocking_locks
         ON blocked_locks.locktype = blocking_locks.locktype
         AND blocked_locks.database IS NOT DISTINCT FROM blocking_locks.database
         AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
         AND blocked_locks.page IS NOT DISTINCT FROM blocking_locks.page
         AND blocked_locks.tuple IS NOT DISTINCT FROM blocking_locks.tuple
         AND blocked_locks.virtualxid IS NOT DISTINCT FROM blocking_locks.virtualxid
         AND blocked_locks.transactionid IS NOT DISTINCT FROM blocking_locks.transactionid
         AND blocked_locks.classid IS NOT DISTINCT FROM blocking_locks.classid
         AND blocked_locks.objid IS NOT DISTINCT FROM blocking_locks.objid
         AND blocked_locks.objsubid IS NOT DISTINCT FROM blocking_locks.objsubid
         AND blocked_locks.pid != blocking_locks.pid
       JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
       WHERE NOT blocked_locks.granted
       ORDER BY blocked_for DESC`
    );

     // Show granted locks on devices table (helps diagnose frequent SKIP LOCKED misses)
     const devicesLocks = await query(
      `SELECT
        l.pid,
        a.usename,
         a.client_addr,
         a.client_port,
         a.application_name,
        a.state,
        a.wait_event_type,
        a.wait_event,
         a.backend_start,
         a.xact_start,
         a.query_start,
        now() - a.xact_start AS xact_age,
        now() - a.query_start AS query_age,
        l.locktype,
        l.mode,
        l.granted,
        LEFT(a.query, 200) AS query
       FROM pg_locks l
       JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.relation = 'devices'::regclass
       ORDER BY l.granted DESC, xact_age DESC NULLS LAST, query_age DESC NULLS LAST`
     );

    return NextResponse.json({
      ok: true,
      longRunningTransactions: longRunning.rows,
      blockedAndBlocking: blockedBlocking.rows,
      devicesLocks: devicesLocks.rows,
      hint:
        'If you see state="idle in transaction" with a long xact_age, that session is likely holding locks. End it (COMMIT/ROLLBACK) or restart Postgres to release locks.',
    });
  } catch (error: any) {
    console.error('db-locks error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error', code: error?.code },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest) => {
  return withAuth((authReq: AuthRequest) => handler(authReq))(req);
};
