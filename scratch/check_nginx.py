#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    cmd = """
    echo "=== NGINX SITES CONFIG ==="
    cat /etc/nginx/sites-enabled/* || true

    echo "=== LOCAL LISTENING PORTS ==="
    netstat -tulpn | grep LISTEN || ss -tulpn | grep LISTEN

    echo "=== TEST DIRECT LOCAL PORT CURL ==="
    curl -sI http://localhost:3001/api/v1/health || true
    curl -sI http://localhost:3000 || true
    curl -sI http://localhost:3002 || true
    curl -sI http://127.0.0.1:3001/api/v1/health || true
    """
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
