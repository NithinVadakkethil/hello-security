import subprocess
import os

DEMO_DIR = "/var/www/demoorbit/hello-security"

def run_cmd(cmd, cwd=None):
    print(f"\n[EXEC] {cmd} (cwd={cwd or DEMO_DIR})")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd or DEMO_DIR)
    print("STDOUT:\n", res.stdout)
    if res.stderr:
        print("STDERR:\n", res.stderr)
    if res.returncode != 0:
        raise Exception(f"Command failed with code {res.returncode}")
    return res.stdout

print("=== STEP 1: PRISMA GENERATE ===")
run_cmd("npx prisma generate")

print("\n=== STEP 2: BUILD API ===")
run_cmd("pnpm nx build api")

print("\n=== STEP 3: BUILD WEB ===")
run_cmd("pnpm nx build web")

print("\n=== STEP 4: RESTART DEMO PM2 PROCESSES ONLY ===")
run_cmd("pm2 restart demoorbit-api --update-env", cwd="/")
run_cmd("pm2 restart demoorbit-web --update-env", cwd="/")

print("\n=== STEP 5: PM2 STATUS & PORTS CHECK ===")
run_cmd("pm2 status", cwd="/")
run_cmd("ss -tulpn | grep -E ':3100|:3101|:3000|:3001'", cwd="/")

print("\n=== STEP 6: TEST DEMO API & WEB ENDPOINTS ===")
run_cmd("curl -I http://127.0.0.1:3101/api/v1/me/face-enrollment", cwd="/")
run_cmd("curl -I http://127.0.0.1:3100/", cwd="/")
run_cmd("curl -I https://demoorbit.helloentry.com/api/v1/me/face-enrollment", cwd="/")
run_cmd("curl -I https://demoorbit.helloentry.com/", cwd="/")

print("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY! ===")
