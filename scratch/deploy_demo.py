import subprocess

def run_cmd(cmd, cwd=None):
    print(f"Executing: {cmd} (cwd={cwd})")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    print("STDOUT:\n", res.stdout)
    if res.stderr:
        print("STDERR:\n", res.stderr)
    if res.returncode != 0:
        raise Exception(f"Command failed with exit code {res.returncode}")
    return res.stdout

DEMO_DIR = "/var/www/demoorbit/hello-security"

print("--- 1. GIT CONFIG & CLEAN CHECKOUT ---")
run_cmd("git config --global --add safe.directory /var/www/demoorbit/hello-security")
run_cmd("git fetch origin", cwd=DEMO_DIR)
run_cmd("git reset --hard", cwd=DEMO_DIR)
run_cmd("git checkout demo/kaizen-custom-features", cwd=DEMO_DIR)
run_cmd("git pull origin demo/kaizen-custom-features", cwd=DEMO_DIR)

print("--- 2. INSTALL DEPENDENCIES ---")
run_cmd("pnpm install --no-frozen-lockfile", cwd=DEMO_DIR)

print("--- 3. BUILD API ---")
run_cmd("pnpm nx build api", cwd=DEMO_DIR)

print("--- 4. BUILD WEB ---")
run_cmd("pnpm nx build web", cwd=DEMO_DIR)

print("--- 5. RESTART DEMO PM2 PROCESSES ONLY ---")
run_cmd("pm2 restart demoorbit-api --update-env")
run_cmd("pm2 restart demoorbit-web --update-env")

print("--- 6. CHECK PM2 STATUS ---")
run_cmd("pm2 status")
