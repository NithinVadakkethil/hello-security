import paramiko
import json

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)

    def run_cmd(title, cmd):
        print(f"\n{'='*20} {title} {'='*20}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
        if out:
            print(out)
        if err:
            print(f"[STDERR]: {err}")
        return out

    # 1. System Resources
    run_cmd("UPTIME & LOAD AVERAGE", "uptime")
    run_cmd("MEMORY & SWAP UTILIZATION", "free -h")
    run_cmd("DISK UTILIZATION", "df -h /")
    run_cmd("CPU USAGE TOP PROCESSES", "ps aux --sort=-%cpu | head -n 10")
    run_cmd("MEMORY USAGE TOP PROCESSES", "ps aux --sort=-%mem | head -n 10")

    # 2. PM2 Status
    run_cmd("PM2 PROCESS STATUS", "pm2 jlist")

    # 3. PostgreSQL Database Connections & Locks
    run_cmd("POSTGRES MAX & ACTIVE CONNECTIONS", """sudo -u postgres psql -d orbitdb -c "
        SELECT count(*) as active_connections,
               (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max_connections
        FROM pg_stat_activity WHERE state != 'idle';
    " """)

    run_cmd("POSTGRES RUNNING / SLOW QUERIES", """sudo -u postgres psql -d orbitdb -c "
        SELECT pid, now() - query_start as duration, state, query
        FROM pg_stat_activity
        WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
        ORDER BY duration DESC
        LIMIT 5;
    " """)

    run_cmd("POSTGRES LOCK WAITS", """sudo -u postgres psql -d orbitdb -c "
        SELECT blocked_locks.pid AS blocked_pid,
               blocked_activity.usename AS blocked_user,
               blocking_locks.pid AS blocking_pid,
               blocking_activity.usename AS blocking_user,
               blocked_activity.query AS blocked_statement
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks 
            ON blocking_locks.locktype = blocked_locks.locktype
            AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
            AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
            AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
            AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
            AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
            AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
            AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
            AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
            AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
            AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.granted;
    " """)

    # 4. Nginx Error Log & PM2 Error Log
    run_cmd("NGINX ERROR LOG (LAST 25)", "tail -n 25 /var/log/nginx/error.log 2>/dev/null || echo 'No nginx error log'")
    run_cmd("PM2 API ERROR LOG (LAST 25)", "tail -n 25 /root/.pm2/logs/hello-security-api-error.log")

    # 5. Face Enrollment & Attendance API Latency in Recent Logs
    run_cmd("RECENT FACE ENROLLMENT API LOGS", """grep -E "face-enrollment" /root/.pm2/logs/hello-security-api-out.log | tail -n 20""")
    run_cmd("RECENT ATTENDANCE CHECK-IN API LOGS", """grep -A 8 -B 2 "attendance/check-in" /root/.pm2/logs/hello-security-api-out.log | tail -n 30""")

finally:
    ssh.close()
