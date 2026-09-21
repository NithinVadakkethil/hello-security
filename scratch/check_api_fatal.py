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
    echo "=== PM2 STATUS ==="
    pm2 status

    echo "=== HELLO-SECURITY-API OUT LOG (LAST 40 LINES) ==="
    tail -n 40 /root/.pm2/logs/hello-security-api-out.log || true

    echo "=== HELLO-SECURITY-API ERR LOG (LAST 40 LINES) ==="
    tail -n 40 /root/.pm2/logs/hello-security-api-error.log || true
    """
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
