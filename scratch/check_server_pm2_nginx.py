#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=60):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    cmd = """
echo "=== PM2 PROCESS DIRECTORIES ==="
pm2 jlist | python3 -c "import sys, json; procs = json.load(sys.stdin); print('\n'.join(f'{p[\"name\"]} (id {p[\"pm_id\"]}) -> cwd: {p[\"pm2_env\"].get(\"pm_cwd\")} | port: {p[\"pm2_env\"].get(\"env\", {}).get(\"PORT\")}' for p in procs))"

echo "=== NGINX CONFIGS ==="
cat /etc/nginx/sites-enabled/* | grep -E 'server_name|proxy_pass'
"""
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
