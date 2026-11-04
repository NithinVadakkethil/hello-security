import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''grep -A 20 -B 10 "cmv9dspzv0acnhpduir3tu54c" /root/.pm2/logs/hello-security-api-out.log | tail -n 60'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("LOGS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
