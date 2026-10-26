#!/usr/bin/env python3
"""
Deploy Face Verification at Patrol Start changes to Demo Server (demoorbit)
Target: 194.76.27.3
Path: /var/www/demoorbit/hello-security
Services: demoorbit-api (PID / reload ONLY)
Does NOT touch production (/var/www/orbit/hello-security, hello-security-api, orbitdb)
"""
import paramiko
import os
import sys

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'
REMOTE_BASE = '/var/www/demoorbit/hello-security'
LOCAL_BASE = '/Users/zinfogcodelabs/Documents/Projects/hello-security'

FILES_TO_SYNC = [
    'api/src/common/auth/patrol-face-token.ts',
    'api/src/modules/patrol-session/patrol-session.routes.ts',
    'api/src/modules/patrol-session/patrol-session.controller.ts',
    'api/src/modules/patrol-session/patrol-session.service.ts',
    'api/src/modules/patrol-session/patrol-session.service.spec.ts',
]

def main():
    print("=" * 70)
    print("🚀 HELLO ORBIT — DEMO SERVER BACKEND DEPLOYMENT")
    print(f"Target: {HOST} | Directory: {REMOTE_BASE}")
    print("=" * 70)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"\n[1/6] Connecting to {HOST}...")
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
    sftp = client.open_sftp()
    print("✓ SSH and SFTP connected successfully.")

    # Step 1: Pre-deployment database backup of demoorbitdb
    print("\n[2/6] Backing up demoorbitdb database...")
    backup_cmd = "sudo -u postgres pg_dump -d demoorbitdb -F c -b -v -f /tmp/demoorbitdb_pre_face_deploy.dump"
    stdin, stdout, stderr = client.exec_command(backup_cmd, timeout=120)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    if stdout.channel.recv_exit_status() != 0:
        print("❌ Backup failed:", err)
        client.close()
        sys.exit(1)
    print("✓ demoorbitdb backup created: /tmp/demoorbitdb_pre_face_deploy.dump")

    # Step 2: Upload updated backend files
    print("\n[3/6] Uploading updated backend files via SFTP...")
    for rel_path in FILES_TO_SYNC:
        local_path = os.path.join(LOCAL_BASE, rel_path)
        remote_path = os.path.join(REMOTE_BASE, rel_path)
        
        # Ensure remote directory exists
        remote_dir = os.path.dirname(remote_path)
        client.exec_command(f"mkdir -p {remote_dir}")
        
        print(f"  Uploading {rel_path}...")
        sftp.put(local_path, remote_path)
    print("✓ All backend files uploaded.")

    # Step 3: Run nx build api on demo server
    print("\n[4/6] Building backend API on demo server...")
    build_cmd = f"cd {REMOTE_BASE} && npx nx build api"
    stdin, stdout, stderr = client.exec_command(build_cmd, timeout=180)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    status = stdout.channel.recv_exit_status()
    print(out)
    if status != 0:
        print("❌ API build failed:", err)
        client.close()
        sys.exit(1)
    print("✓ nx build api succeeded on demo server.")

    # Step 4: Reload ONLY demoorbit-api PM2 process
    print("\n[5/6] Reloading demoorbit-api process...")
    reload_cmd = "pm2 reload demoorbit-api"
    stdin, stdout, stderr = client.exec_command(reload_cmd, timeout=60)
    print(stdout.read().decode('utf-8'))
    
    # Wait 3 seconds
    client.exec_command("sleep 3")

    # Step 5: Verify health & PM2 status
    print("\n[6/6] Verifying demo services & health checks...")
    check_cmd = """
echo "=== PM2 STATUS ==="
pm2 list

echo "\n=== DEMO API LOCAL HEALTH CHECK (Port 3101) ==="
curl -s -i http://127.0.0.1:3101/api/v1/health

echo "\n=== DEMO API PUBLIC HEALTH CHECK ==="
curl -s -i https://demoorbit.helloentry.com/api/v1/health
"""
    stdin, stdout, stderr = client.exec_command(check_cmd, timeout=60)
    print(stdout.read().decode('utf-8'))

    sftp.close()
    client.close()
    print("\n" + "=" * 70)
    print("🎉 DEMO SERVER DEPLOYMENT COMPLETED SAFELY WITHOUT TOUCHING PRODUCTION")
    print("=" * 70)

if __name__ == '__main__':
    main()
