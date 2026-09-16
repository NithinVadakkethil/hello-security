#!/usr/bin/env python3
import sys
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=60)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    dump_script = """
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/var/www/orbit/backups/orbitdb_backup_${TIMESTAMP}.sql"
pg_dump "postgresql://postgres:postgres@localhost:5432/orbitdb" > "${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
"""
    code, out, err = run_ssh(dump_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
