import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''grep -E "attendance/check-in" /root/.pm2/logs/hello-security-api-out.log | tail -n 30'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("CHECK-IN OUT LOGS:\n", stdout.read().decode('utf-8'))

    cmd2 = '''grep -i "check-in" /root/.pm2/logs/hello-security-api-error.log | tail -n 30'''
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print("CHECK-IN ERR LOGS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
