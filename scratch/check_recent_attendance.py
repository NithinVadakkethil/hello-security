import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)

    cmd = '''sudo -u postgres psql -d orbitdb -c "
        SELECT a.id, a.\\"attendanceDate\\", a.\\"checkInAt\\", a.\\"checkOutAt\\", a.status, a.\\"verificationMethod\\",
               e.\\"firstName\\", e.\\"lastName\\", c.\\"companyName\\"
        FROM \\"Attendance\\" a
        JOIN \\"Employee\\" e ON e.id = a.\\"employeeId\\"
        JOIN \\"Client\\" c ON c.id = a.\\"clientId\\"
        WHERE a.\\"attendanceDate\\" >= '2026-10-20'
        ORDER BY a.\\"checkInAt\\" DESC;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("RECENT ATTENDANCE:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
