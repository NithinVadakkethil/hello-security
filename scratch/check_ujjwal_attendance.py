import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    cmd = '''sudo -u postgres psql -d orbitdb -c "
        SELECT a.id, a.\\"date\\", a.\\"checkInTime\\", a.\\"checkOutTime\\", a.status, a.\\"verificationType\\"
        FROM \\"Attendance\\" a
        JOIN \\"Employee\\" e ON e.id = a.\\"employeeId\\"
        JOIN \\"User\\" u ON u.\\"employeeId\\" = e.id
        WHERE u.email = 'ujjwal.peninsula1@helloorbit.com'
        ORDER BY a.\\"date\\" DESC
        LIMIT 5;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("ATTENDANCE:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
