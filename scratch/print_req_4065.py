import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''python3 -c '
with open("/root/.pm2/logs/hello-security-api-out.log", "r") as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "4065" in line and "req" in line:
        for j in range(max(0, i-5), min(len(lines), i+25)):
            print(lines[j], end="")
        print("="*40)
' '''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("OUTPUT:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
