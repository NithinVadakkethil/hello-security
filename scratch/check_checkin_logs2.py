import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''grep -B 5 -A 15 "cmt6wruzv000qhpyprl8qelrd" /root/.pm2/logs/hello-security-api-out.log | grep -B 2 -A 10 "attendance"'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("EMP ATTENDANCE LOGS:\n", stdout.read().decode('utf-8'))

    # Also check around 08:51 UTC in the logs
    cmd2 = '''grep "2026-10-15 08:51" /root/.pm2/logs/hello-security-api-out.log | head -n 30'''
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print("08:51 UTC LOGS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
