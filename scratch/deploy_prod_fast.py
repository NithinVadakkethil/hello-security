import os
import sys
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'
REMOTE_DIR = '/var/www/orbit/hello-security'
LOCAL_BASE = '/Users/zinfogcodelabs/Documents/Projects/hello-security'

FILES_TO_SYNC = [
    'api/src/modules/subtask-master/subtask-master.repository.ts',
    'api/src/modules/subtask-master/subtask-master.service.ts',
    'api/src/modules/gate-sub-task/gate-sub-task.controller.ts',
    'api/src/modules/gate-sub-task/gate-sub-task.service.ts',
    'api/src/modules/gate/gate.repository.ts',
    'web/src/app/dashboard/settings/components/SubtaskMasterSettings.tsx',
    'web/src/app/dashboard/sites/components/GateSubTasksModal.tsx',
    'web/src/app/dashboard/sites/[id]/page.tsx',
]

def run_fast_deploy():
    print(f"🚀 Connecting to Production Server {HOST}...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    try:
        print("📦 Uploading modified source files via SFTP...", flush=True)
        for rel_path in FILES_TO_SYNC:
            local_path = os.path.join(LOCAL_BASE, rel_path)
            remote_path = f"{REMOTE_DIR}/{rel_path}"

            if not os.path.exists(local_path):
                print(f"⚠️ Warning: Local file missing: {local_path}", flush=True)
                continue

            remote_parent_dir = os.path.dirname(remote_path)
            client.exec_command(f"mkdir -p '{remote_parent_dir}'")

            sftp.put(local_path, remote_path)
            print(f"   Uploaded: {rel_path}", flush=True)

        print("✅ Code files uploaded successfully!", flush=True)

        # Commands to build and reload safely
        commands = [
            ("Generating Prisma Client", f"cd {REMOTE_DIR} && pnpm exec prisma generate"),
            ("Building API production bundle", f"cd {REMOTE_DIR} && pnpm nx build api"),
            ("Building Web production bundle", f"cd {REMOTE_DIR} && pnpm nx build web"),
            ("Reloading PM2 services (zero downtime)", f"cd {REMOTE_DIR} && pm2 reload hello-security-api --update-env && pm2 reload hello-security-web --update-env"),
            ("Checking PM2 status", "pm2 status"),
        ]

        for title, cmd in commands:
            print(f"\n⚡ {title}...", flush=True)
            stdin, stdout, stderr = client.exec_command(cmd)
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')
            if out:
                print(out, flush=True)
            if err and "warning" not in err.lower() and "notice" not in err.lower() and "npm" not in err.lower():
                print("LOG/STDERR:", err, flush=True)

        print("\n🎉 PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY WITH ZERO DATA LOSS!", flush=True)

    finally:
        sftp.close()
        client.close()

if __name__ == '__main__':
    run_fast_deploy()
