#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)

cmd = """
echo "=== TESTING PG DUMP AS USER POSTGRES ==="
mkdir -p /var/backups
sudo -u postgres pg_dump -d orbitdb -F c -b -f /var/backups/test_orbit.dump
ls -lh /var/backups/test_orbit.dump
sudo -u postgres psql -d orbitdb -c "SELECT current_database(), COUNT(*) FROM \\"User\\";"
rm -f /var/backups/test_orbit.dump
"""

stdin, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
client.close()

print(out)
if err:
    print("--- STDERR ---")
    print(err)
