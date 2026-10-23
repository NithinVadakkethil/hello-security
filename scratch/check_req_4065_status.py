import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''grep -E '"id": 4065|"statusCode":' /root/.pm2/logs/hello-security-api-out.log | grep -A 2 -B 2 '4065' '''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STATUS FOR 4065:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
