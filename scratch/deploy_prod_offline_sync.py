import paramiko
import os

def deploy():
    print("🚀 Starting Production Deployment for Offline Patrol Sync Fix...")
    
    host = '194.76.27.3'
    user = 'root'
    password = '@.Pd4j4p0c@O0FE123'
    remote_path = '/var/www/orbit/hello-security'

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, 22, user, password)

    sftp = client.open_sftp()

    # Files to upload
    files_to_sync = [
        ('api/src/modules/patrol-checkpoint/patrol-checkpoint.schema.ts', 'api/src/modules/patrol-checkpoint/patrol-checkpoint.schema.ts'),
        ('api/src/modules/patrol-checkpoint/patrol-checkpoint.types.ts', 'api/src/modules/patrol-checkpoint/patrol-checkpoint.types.ts'),
        ('api/src/modules/patrol-checkpoint/patrol-checkpoint.service.ts', 'api/src/modules/patrol-checkpoint/patrol-checkpoint.service.ts'),
        ('api/src/modules/patrol-session/patrol-session.service.ts', 'api/src/modules/patrol-session/patrol-session.service.ts'),
        ('apps/mobile/src/app/services/offline-sync-engine.ts', 'apps/mobile/src/app/services/offline-sync-engine.ts'),
        ('apps/mobile/src/modules/patrol/hooks/usePatrol.ts', 'apps/mobile/src/modules/patrol/hooks/usePatrol.ts'),
        ('apps/mobile/src/modules/patrol/api/patrol.api.ts', 'apps/mobile/src/modules/patrol/api/patrol.api.ts'),
    ]

    local_root = '/Users/zinfogcodelabs/Documents/Projects/hello-security'

    for local_rel, remote_rel in files_to_sync:
        local_full = os.path.join(local_root, local_rel)
        remote_full = os.path.join(remote_path, remote_rel)
        
        # Ensure remote dir exists
        remote_dir = os.path.dirname(remote_full)
        stdin, stdout, stderr = client.exec_command(f"mkdir -p {remote_dir}")
        stdout.read()
        
        print(f"Uploading {local_rel} -> {remote_full}")
        sftp.put(local_full, remote_full)

    sftp.close()

    # Build and reload PM2 processes
    print("\n📦 Building API on production server...")
    commands = [
        f"cd {remote_path} && pnpm nx build api",
        f"cd {remote_path} && pm2 reload hello-security-api",
    ]

    for cmd in commands:
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        if out: print(out)
        if err: print(err)

    client.close()
    print("\n✅ Production deployment completed successfully!")

if __name__ == '__main__':
    deploy()
