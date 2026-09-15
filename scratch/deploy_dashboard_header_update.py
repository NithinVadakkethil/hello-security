import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, timeout=15)
    print("Connected successfully.")

    def run(cmd):
        print(f"\n---> Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        print(f"Exit code: {exit_code}")
        if out:
            print(f"STDOUT:\n{out.strip()}")
        if err:
            print(f"STDERR:\n{err.strip()}")
        if exit_code != 0:
            raise Exception(f"Command failed with exit code {exit_code}: {cmd}")
        return out

    # 1. Fetch Release & Checkout
    run("cd /var/www/orbit/hello-security && git fetch origin manager/centralized")
    run("cd /var/www/orbit/hello-security && git checkout origin/manager/centralized")
    head_sha = run("cd /var/www/orbit/hello-security && git rev-parse HEAD").strip()
    print(f"Checked out HEAD SHA: {head_sha}")

    # 2. Build Web
    run("cd /var/www/orbit/hello-security && pnpm nx build web")

    # 3. Restart Web PM2 Process
    run("pm2 restart hello-security-web --update-env")

    # 4. Check PM2 Status
    pm2_status = run("pm2 status")
    print("PM2 Status:\n", pm2_status)

    # 5. Check HTTP Health
    web_health = run("curl -s -i http://localhost:3000/login")
    print("Web Health snippet:\n", "\n".join(web_health.splitlines()[:5]))

except Exception as e:
    print(f"ERROR DURING DEPLOYMENT: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    ssh.close()
