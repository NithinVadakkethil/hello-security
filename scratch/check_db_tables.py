#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=30):
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
echo "=== POSTGRES DATABASES ==="
sudo -u postgres psql -c "\l"

echo "=== DEMOORBITDB TABLES ==="
sudo -u postgres psql -d demoorbitdb -c '\dt'

echo "=== DEMOORBITDB USERS ==="
sudo -u postgres psql -d demoorbitdb -c 'SELECT id, email, role FROM "User";'

echo "=== ORBITDB USERS ==="
sudo -u postgres psql -d orbitdb -c 'SELECT id, email, role FROM "User" WHERE email LIKE '\''%kaizen%'\'' OR email LIKE '\''%admin%'\'' LIMIT 10;'
"""
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
