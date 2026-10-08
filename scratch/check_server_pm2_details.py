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
echo "=== PM2 PRETTIFIED ==="
pm2 list

echo "=== DEMOORBIT PATHS ==="
pm2 show demoorbit-api | grep -E 'script path|mode|exec cwd'
pm2 show demoorbit-web | grep -E 'script path|mode|exec cwd'
pm2 show hello-security-api | grep -E 'script path|mode|exec cwd'
pm2 show hello-security-web | grep -E 'script path|mode|exec cwd'

echo "=== NGINX SITES ==="
ls -la /etc/nginx/sites-enabled/
cat /etc/nginx/sites-enabled/demoorbit* 2>/dev/null || true
"""
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
