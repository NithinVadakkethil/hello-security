import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    # Check logs for Ujjwal around 10:45 UTC today
    cmd = '''grep -E "cmv9dspzv0acnhpduir3tu54c|ujjwal" /root/.pm2/logs/hello-security-api-out.log | tail -n 50'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("MATCHING OUT LOGS:\n", stdout.read().decode('utf-8'))

    # Check error logs
    cmd2 = '''tail -n 100 /root/.pm2/logs/hello-security-api-error.log'''
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print("ERROR LOGS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
