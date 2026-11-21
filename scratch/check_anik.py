import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)

    cmd = '''sudo -u postgres psql -d orbitdb -c "
        SELECT a.id, a.\\"attendanceDate\\", a.\\"checkInAt\\", a.status, a.\\"verificationMethod\\", a.\\"verificationStatus\\",
               e.id as emp_id, e.\\"firstName\\", e.\\"lastName\\", fe.id as fe_id
        FROM \\"Attendance\\" a
        JOIN \\"Employee\\" e ON e.id = a.\\"employeeId\\"
        LEFT JOIN \\"FaceEnrollment\\" fe ON fe.\\"employeeId\\" = e.id
        WHERE e.\\"firstName\\" ILIKE '%Anik%'
        ORDER BY a.\\"checkInAt\\" DESC;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("ANIK ATTENDANCE:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
