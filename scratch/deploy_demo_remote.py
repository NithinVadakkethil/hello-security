import paramiko
import sys
import time

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, timeout=20)
    print("Connected successfully.")

    def run(cmd, check=True):
        print(f"\n==========================================")
        print(f"Executing: {cmd}")
        print(f"==========================================")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        print(f"Exit code: {exit_code}")
        if out:
            print(f"STDOUT:\n{out.strip()}")
        if err:
            print(f"STDERR:\n{err.strip()}")
        if check and exit_code != 0:
            print(f"[FATAL] Command failed: {cmd}")
            sys.exit(exit_code)
        return out

    DEMO_DIR = "/var/www/demoorbit/hello-security"

    # Step 1: Verify Demo directory and environment
    run(f"git config --global --add safe.directory {DEMO_DIR}")
    run(f"cd {DEMO_DIR} && git status")

    # Step 2: Fetch and pull latest changes
    run(f"cd {DEMO_DIR} && git fetch origin")
    run(f"cd {DEMO_DIR} && git checkout demo/kaizen-custom-features")
    run(f"cd {DEMO_DIR} && git pull origin demo/kaizen-custom-features")

    # Step 3: Verify .env points to demoorbitdb
    out_env = run(f"cat {DEMO_DIR}/.env | grep DATABASE_URL")
    if "demoorbitdb" not in out_env:
        print("[FATAL ERROR] DEMO .env is not pointing to demoorbitdb!")
        sys.exit(1)

    # Step 4: Install dependencies
    run(f"cd {DEMO_DIR} && pnpm install --no-frozen-lockfile")

    # Step 5: Prisma generate & migration check
    run(f"cd {DEMO_DIR} && npx prisma generate")
    run(f"cd {DEMO_DIR} && npx prisma migrate deploy")

    # Step 6: Build API & Web
    run(f"cd {DEMO_DIR} && pnpm nx build api")
    run(f"cd {DEMO_DIR} && pnpm nx build web")

    # Step 7: Restart DEMO PM2 processes ONLY
    run("pm2 restart demoorbit-api --update-env")
    run("pm2 restart demoorbit-web --update-env")

    time.sleep(3)

    # Step 8: Verify PM2 status & port health
    run("pm2 status")
    run("curl -s -I http://127.0.0.1:3101/api/v1/auth/me || true")
    run("curl -s -I http://127.0.0.1:3100/ || true")
    run("curl -s -I https://demoorbit.helloentry.com/ || true")

    print("\n🎉 DEMO DEPLOYMENT COMPLETED SUCCESSFULLY!")

finally:
    ssh.close()
