import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    cmd = '''sudo -u postgres psql -d orbitdb -c "SELECT email, role, \\"rawPassword\\" FROM \\"User\\" WHERE role IN ('SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER');"'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    print("STDOUT:", out)
finally:
    ssh.close()
