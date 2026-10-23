import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''sudo -u postgres psql -d orbitdb -c "\\d \\"Attendance\\""'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("ATTENDANCE COLS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
