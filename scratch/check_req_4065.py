import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''grep -A 15 -B 5 "4065" /root/.pm2/logs/hello-security-api-out.log'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("START PATROL LOGS (REQ 4065):\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
