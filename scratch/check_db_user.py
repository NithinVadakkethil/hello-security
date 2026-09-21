#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
stdin, stdout, stderr = client.exec_command("cd /var/www/orbit/hello-security && cat .env")
out = stdout.read().decode('utf-8')
client.close()

for line in out.splitlines():
    if 'DATABASE_URL' in line:
        # print sanitized version
        proto, rest = line.split('://', 1)
        user_pass, host_db = rest.split('@', 1)
        db_user = user_pass.split(':', 1)[0]
        print(f"DB_USER={db_user}, HOST_DB={host_db}")
