#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    cmd = """
    cd /var/www/orbit/hello-security
    echo "=== FINDING ALL .env FILES ==="
    find . -maxdepth 3 -name ".env*"

    echo "=== CURRENT DATABASE_URL IN ROOT .env ==="
    grep DATABASE_URL .env || true

    echo "=== CURRENT DATABASE_URL IN OTHER .env FILES ==="
    grep -rn "DATABASE_URL" . || true

    echo "=== FIXING DATABASE_URL IN ALL .env FILES ==="
    find . -maxdepth 3 -name ".env*" -exec sed -i 's|hello_orbit_prod_clone|orbitdb|g' {} +
    find . -maxdepth 3 -name ".env*" -exec sed -i 's|hello_security|orbitdb|g' {} +

    echo "=== VERIFYING FIXED .env FILES ==="
    grep -rn "DATABASE_URL" . || true

    echo "=== RESTARTING PM2 SERVICES ==="
    pm2 restart hello-security-api --update-env
    pm2 restart hello-security-web --update-env
    sleep 3

    echo "=== CHECKING API PM2 LOGS AFTER FIX ==="
    pm2 logs hello-security-api --lines 20 --nostream
    """
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
