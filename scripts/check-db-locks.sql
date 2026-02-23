-- Diagnostika lockova i dugih transakcija
-- Pokretanje: psql -h <host> -U <user> -d <db> -f scripts/check-db-locks.sql

\echo '=== LONG RUNNING / IDLE TRANSACTIONS (60s+) ==='
SELECT
  pid,
  usename,
  state,
  wait_event_type,
  wait_event,
  now() - xact_start AS xact_age,
  now() - query_start AS query_age,
  LEFT(query, 200) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND xact_start IS NOT NULL
  AND now() - xact_start > interval '60 seconds'
ORDER BY xact_age DESC;

\echo '=== BLOCKED <-> BLOCKING SESSIONS ==='
SELECT
  blocked.pid AS blocked_pid,
  blocked.usename AS blocked_user,
  now() - blocked.query_start AS blocked_for,
  LEFT(blocked.query, 120) AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.usename AS blocking_user,
  now() - blocking.query_start AS blocking_for,
  LEFT(blocking.query, 120) AS blocking_query
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
ORDER BY blocked_for DESC;

\echo '=== OPTIONAL: TERMINATE ONLY IDLE-IN-TRANSACTION 5m+ (MANUAL) ==='
\echo 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = ''idle in transaction'' AND now() - xact_start > interval ''5 minutes'';'
