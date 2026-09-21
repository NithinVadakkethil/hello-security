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

    echo "=== RECENT PM2 LOGS FOR HELLO-SECURITY-API ==="
    pm2 logs hello-security-api --lines 50 --nostream

    echo "=== RECENT PM2 ERROR LOGS FOR HELLO-SECURITY-API ==="
    pm2 logs hello-security-api --err --lines 50 --nostream
    """
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
