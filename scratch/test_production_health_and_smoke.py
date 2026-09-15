import paramiko
import sys
import json

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
        return out

    # 1. PM2 Status
    run("pm2 status")

    # 2. API Health Check on port 3001
    run("curl -s -i http://localhost:3001/api/v1/health")

    # 3. Web Health Check on port 3000
    web_res = run("curl -s -i http://localhost:3000/login")
    print("Web login response header snippet:\n", "\n".join(web_res.splitlines()[:10]))

    # 4. Web reverse proxy check via Nginx (port 80 or SSL)
    nginx_res = run("curl -s -i http://localhost/login")
    print("Nginx login response snippet:\n", "\n".join(nginx_res.splitlines()[:10]))

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    ssh.close()
