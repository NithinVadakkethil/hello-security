import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)

    cmd = '''sudo -u postgres psql -d orbitdb -c "
        SELECT fe.id, fe.\\"clientId\\", c.\\"companyName\\", fe.\\"employeeId\\", e.\\"firstName\\", e.\\"lastName\\",
               fe.status, fe.\\"modelName\\", fe.\\"modelVersion\\", fe.\\"embeddingDimension\\",
               fe.\\"registeredAt\\", fe.\\"updatedAt\\"
        FROM \\"FaceEnrollment\\" fe
        JOIN \\"Client\\" c ON c.id = fe.\\"clientId\\"
        JOIN \\"Employee\\" e ON e.id = fe.\\"employeeId\\"
        ORDER BY fe.\\"registeredAt\\" DESC;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("ENROLLMENTS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
