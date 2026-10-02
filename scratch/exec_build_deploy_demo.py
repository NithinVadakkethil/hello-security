import subprocess
import json
import os
import sys

def run_cmd(cmd, cwd=None, check=True):
    print(f"[EXEC] {cmd} (cwd: {cwd or 'default'})")
    res = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"[ERROR] Command failed (code {res.returncode}):\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")
        sys.exit(1)
    return res.stdout.strip()

DEMO_DIR = "/var/www/demoorbit/hello-security"

print("============================================================")
print("STARTING DEMO FULL API + WEB BUILD & DEPLOYMENT")
print("============================================================")

# 1. Verify ENV & DB Mapping
print("\n[STEP 1] VERIFYING DEMO ENVIRONMENT MAPPING...")
with open(f"{DEMO_DIR}/.env") as f:
    env_content = f.read()

if "demoorbitdb" not in env_content:
    print("[FATAL ERROR] .env does not point to demoorbitdb! Aborting.")
    sys.exit(1)

print("Demo .env verified pointing to demoorbitdb.")

# 2. Prisma Generate
print("\n[STEP 2] RUNNING PRISMA GENERATE...")
run_cmd("npx prisma generate", cwd=DEMO_DIR)

# 3. Build API
print("\n[STEP 3] BUILDING API (pnpm nx build api)...")
run_cmd("pnpm nx build api", cwd=DEMO_DIR)

api_main = f"{DEMO_DIR}/api/dist/api/src/main.js"
if not os.path.exists(api_main):
    print(f"[FATAL ERROR] Built API file missing: {api_main}")
    sys.exit(1)

print(f"API build succeeded: {api_main}")

# 4. Restart demoorbit-api in PM2
print("\n[STEP 4] RESTARTING demoorbit-api IN PM2...")
run_cmd("pm2 restart demoorbit-api --update-env")

pm2_out = run_cmd("pm2 jlist")
pm2_data = json.loads(pm2_out)
pm2_status = {p["name"]: p["pm2_env"]["status"] for p in pm2_data}

print(f"PM2 Status after API restart:\n{json.dumps(pm2_status, indent=2)}")

if pm2_status.get("hello-security-api") != "online":
    print("[FATAL ERROR] hello-security-api was affected!")
    sys.exit(1)
if pm2_status.get("demoorbit-api") != "online":
    print("[FATAL ERROR] demoorbit-api is not online!")
    sys.exit(1)

# 5. Build WEB
print("\n[STEP 5] BUILDING WEB (pnpm nx build web)...")
run_cmd("pnpm nx build web", cwd=DEMO_DIR)

print("Web build succeeded!")

# 6. Restart demoorbit-web in PM2
print("\n[STEP 6] RESTARTING demoorbit-web IN PM2...")
run_cmd("pm2 restart demoorbit-web --update-env")

pm2_final_out = run_cmd("pm2 jlist")
pm2_final_data = json.loads(pm2_final_out)
pm2_final_status = {p["name"]: p["pm2_env"]["status"] for p in pm2_final_data}

print(f"Final PM2 Status:\n{json.dumps(pm2_final_status, indent=2)}")

# 7. Route & HTTP Verification
print("\n[STEP 7] VERIFYING DEMO API & FACE ENROLLMENT ROUTE...")
curl_face = run_cmd("curl -s -i https://demoorbit.helloentry.com/api/v1/me/face-enrollment", check=False)
curl_auth = run_cmd("curl -s -i https://demoorbit.helloentry.com/api/v1/auth/me", check=False)
curl_prod = run_cmd("curl -s -I https://orbit.helloentry.com/", check=False)

print("\n--- FACE ENROLLMENT ENDPOINT RESPONSE ---")
print(curl_face[:400])

print("\n--- AUTH ME ENDPOINT RESPONSE ---")
print(curl_auth[:400])

print("\n--- PROD WEB RESPONSE ---")
print(curl_prod[:200])

if "404 Not Found" in curl_face or "Cannot GET" in curl_face:
    print("[ERROR] Face Enrollment route still returned 404!")
else:
    print("[SUCCESS] Face Enrollment route registered successfully! (Returned non-404 code)")

print("\n============================================================")
print("DEMO FULL DEPLOYMENT COMPLETE!")
print("============================================================")
