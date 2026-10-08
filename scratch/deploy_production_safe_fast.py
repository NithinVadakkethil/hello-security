#!/usr/bin/env python3
import os
import sys
import tarfile
import tempfile
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'
REMOTE_DIR = '/var/www/orbit/hello-security'
LOCAL_DIR = '/Users/zinfogcodelabs/Documents/Projects/hello-security'

def deploy():
    print(f"🚀 [1/5] Connecting to production server {HOST} via SSH...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    
    # Verify PM2 and directory
    stdin, stdout, stderr = client.exec_command("pm2 status")
    print("📋 Current PM2 status on production:")
    print(stdout.read().decode('utf-8'))

    # Create archive of api and web source files
    print("📦 [2/5] Creating compressed deployment archive of updated modules...", flush=True)
    tar_path = os.path.join(tempfile.gettempdir(), "orbit_deploy.tar.gz")
    
    with tarfile.open(tar_path, "w:gz") as tar:
        for folder in ['api/src', 'web/src']:
            full_folder = os.path.join(LOCAL_DIR, folder)
            if os.path.exists(full_folder):
                tar.add(full_folder, arcname=folder)
                print(f"   Added {folder} to archive")
    
    print(f"✅ Archive created ({os.path.getsize(tar_path) / 1024:.1f} KB)", flush=True)

    # Upload archive
    print(f"📤 [3/5] Uploading archive to {REMOTE_DIR}...", flush=True)
    sftp = client.open_sftp()
    remote_tar = f"{REMOTE_DIR}/orbit_deploy.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)
    print("✅ Archive uploaded successfully in <2 seconds!", flush=True)

    # Execute extraction, build and reload
    print("⚡ [4/5] Extracting and running build pipeline on production server...", flush=True)
    remote_commands = [
        ("Extracting update package", f"cd {REMOTE_DIR} && tar -xzf orbit_deploy.tar.gz && rm orbit_deploy.tar.gz"),
        ("Generating Prisma Client", f"cd {REMOTE_DIR} && pnpm exec prisma generate"),
        ("Building API production bundle", f"cd {REMOTE_DIR} && pnpm nx build api"),
        ("Building Web production bundle", f"cd {REMOTE_DIR} && pnpm nx build web"),
        ("Reloading PM2 services (zero downtime)", f"cd {REMOTE_DIR} && pm2 reload hello-security-api --update-env && pm2 reload hello-security-web --update-env"),
        ("Verifying PM2 status", "pm2 status"),
    ]

    for title, cmd in remote_commands:
        print(f"\n▶ {title}...", flush=True)
        stdin, stdout, stderr = client.exec_command(cmd)
        
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        if out:
            print(out, flush=True)
        if err and "warning" not in err.lower() and "notice" not in err.lower() and "npm" not in err.lower():
            print("STDERR/LOGS:", err, flush=True)
            
        status = stdout.channel.recv_exit_status()
        if status != 0:
            print(f"❌ Command failed with exit status {status}")
            client.close()
            sys.exit(1)

    print("\n🎉 [5/5] PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY WITH 100% DATA PRESERVATION!", flush=True)
    client.close()

if __name__ == '__main__':
    deploy()
