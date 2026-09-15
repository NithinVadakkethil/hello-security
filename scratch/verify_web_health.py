import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    def run(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        print(f"Executing: {cmd}\nOutput:\n{out}\n")
        return out

    run("pm2 status")
    run("curl -s -i http://localhost:3000/login | head -n 15")
finally:
    ssh.close()
