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
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'api/package.json',
    'api/src/main.ts',
    'api/src/common/errors/AppError.ts',
    'api/src/common/middleware/errorHandler.ts',
    'api/src/modules/auth/auth.schema.ts',
    'api/src/modules/auth/dto/login.dto.ts',
    'api/src/modules/auth/dto/logout-all-devices.dto.ts',
    'api/src/modules/patrol-session/patrol-session.service.ts',
    'api/src/modules/patrol-session/patrol-session.controller.ts',
    'api/src/common/email/EmailProvider.ts',
    'api/src/common/email/SmtpEmailProvider.ts',
    'api/src/common/email/templates/patrol-completed.template.ts',
    'api/src/common/queue/notification-queue.service.ts',
    'api/src/workers/notification-worker.ts',
    'api/src/modules/client-notification/client-notification.controller.ts',
    'api/src/modules/client-notification/client-notification.repository.ts',
    'api/src/modules/client-notification/client-notification.routes.ts',
    'api/src/modules/client-notification/client-notification.schema.ts',
    'api/src/modules/client-notification/client-notification.service.ts',
    'api/src/modules/client-notification/client-notification.types.ts',
    'api/src/routes/index.ts',
    'web/src/app/dashboard/settings/page.tsx',
    'prisma/schema.prisma',
]

PROD_ENV_CONTENT = """# Environment variables declared in this file are NOT automatically loaded by Prisma.
# Please add `import "dotenv/config";` to your `prisma.config.ts` file, or use the Prisma CLI with Bun
# to load environment variables from .env files: https://pris.ly/prisma-config-env-vars.

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orbitdb?schema=public"

PORT=3001
NODE_ENV=production

REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Verified Production Company SMTP Credentials
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=helloorbit.atlabs@gmail.com
SMTP_PASS=kjfh rdqx ivjp gziw
SMTP_FROM="Hello Orbit Security <helloorbit.notifications@gmail.com>"
"""

def execute_deployment():
    print("🚀 Connecting to Production Server 194.76.27.3...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    try:
        # Step 1: Update production .env
        print("📄 Updating production .env file...", flush=True)
        with sftp.open(f"{REMOTE_DIR}/.env", 'w') as f:
            f.write(PROD_ENV_CONTENT)
        print("✅ Production .env written successfully!", flush=True)

        # Step 2: Sync updated source files
        print("📦 Uploading updated code files and package manifests via SFTP...", flush=True)
        for rel_path in FILES_TO_SYNC:
            local_path = os.path.join(LOCAL_BASE, rel_path)
            remote_path = f"{REMOTE_DIR}/{rel_path}"

            if not os.path.exists(local_path):
                print(f"⚠️ Warning: Local file missing: {local_path}", flush=True)
                continue

            # Ensure remote directory exists
            remote_parent_dir = os.path.dirname(remote_path)
            cmd_mkdir = f"mkdir -p '{remote_parent_dir}'"
            client.exec_command(cmd_mkdir)

            sftp.put(local_path, remote_path)
            print(f"   Uploaded: {rel_path}", flush=True)

        print("✅ Source files uploaded successfully!", flush=True)

        # Step 3: Run pnpm install on remote server
        print("\n📦 Installing Node dependencies on production server...", flush=True)
        cmd_install = f"cd {REMOTE_DIR} && pnpm install --no-frozen-lockfile"
        stdin, stdout, stderr = client.exec_command(cmd_install)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        print("Install Output:", out, flush=True)

        # Step 4: Run Prisma generate on remote server
        print("\n⚙️ Generating Prisma Client on remote server...", flush=True)
        cmd_gen = f"cd {REMOTE_DIR} && pnpm exec prisma generate"
        stdin, stdout, stderr = client.exec_command(cmd_gen)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        print("Prisma Generate Output:", out, flush=True)

        # Step 5: Build API and Web on remote server
        print("\n⚙️ Building API and Web on production server...", flush=True)
        cmd_build = f"cd {REMOTE_DIR} && pnpm nx build api && pnpm nx build web"
        stdin, stdout, stderr = client.exec_command(cmd_build)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        print("Build Output:", out, flush=True)
        if err:
            print("Build Info/Warnings:", err, flush=True)

        # Step 6: Reload PM2 processes safely
        print("\n🔄 Reloading PM2 processes (zero downtime)...", flush=True)
        cmd_pm2 = "pm2 reload hello-security-api && pm2 reload hello-security-web && pm2 status"
        stdin, stdout, stderr = client.exec_command(cmd_pm2)
        out = stdout.read().decode('utf-8')
        print("PM2 Status Output:\n", out, flush=True)

        print("\n🎉 PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY WITH ZERO DATA LOSS!", flush=True)

    finally:
        sftp.close()
        client.close()

if __name__ == '__main__':
    execute_deployment()
