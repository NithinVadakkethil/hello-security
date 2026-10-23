import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    # 1. Inspect user and employee
    cmd = '''sudo -u postgres psql -d orbitdb -x -c "
        SELECT u.id as user_id, u.email, u.role, u.\\"employeeId\\", e.id as emp_id, e.\\"firstName\\", e.\\"lastName\\", e.status, e.\\"clientId\\", e.\\"siraCardExpiryDate\\"
        FROM \\"User\\" u
        LEFT JOIN \\"Employee\\" e ON e.id = u.\\"employeeId\\"
        WHERE u.email = 'ujjwal.peninsula1@helloorbit.com';
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("USER/EMP INFO:\n", out, "\nERR:", err)
    
    # 2. Inspect active or recent patrol sessions for this employee
    cmd2 = '''sudo -u postgres psql -d orbitdb -c "
        SELECT ps.id, ps.\\"patrolCode\\", ps.status, ps.\\"startedAt\\", ps.\\"endedAt\\", ps.\\"createdAt\\", ps.\\"assignmentId\\"
        FROM \\"PatrolSession\\" ps
        JOIN \\"GuardAssignment\\" ga ON ga.id = ps.\\"assignmentId\\"
        JOIN \\"Employee\\" e ON e.id = ga.\\"employeeId\\"
        JOIN \\"User\\" u ON u.\\"employeeId\\" = e.id
        WHERE u.email = 'ujjwal.peninsula1@helloorbit.com'
        ORDER BY ps.\\"createdAt\\" DESC
        LIMIT 10;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd2)
    print("RECENT PATROL SESSIONS:\n", stdout.read().decode('utf-8'))

    # 3. Check if there are any active/paused sessions
    cmd3 = '''sudo -u postgres psql -d orbitdb -c "
        SELECT ps.id, ps.\\"patrolCode\\", ps.status, ps.\\"startedAt\\", ps.\\"createdAt\\", ps.\\"assignmentId\\"
        FROM \\"PatrolSession\\" ps
        JOIN \\"GuardAssignment\\" ga ON ga.id = ps.\\"assignmentId\\"
        JOIN \\"Employee\\" e ON e.id = ga.\\"employeeId\\"
        JOIN \\"User\\" u ON u.\\"employeeId\\" = e.id
        WHERE u.email = 'ujjwal.peninsula1@helloorbit.com'
          AND ps.status IN ('IN_PROGRESS', 'PAUSED');
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd3)
    print("ACTIVE/PAUSED SESSIONS:\n", stdout.read().decode('utf-8'))

    # 4. Check recent checkpoints scanned by this employee
    cmd4 = '''sudo -u postgres psql -d orbitdb -c "
        SELECT pc.id, pc.\\"patrolSessionId\\", pc.\\"gateId\\", pc.status, pc.\\"scannedAt\\", pc.\\"createdAt\\"
        FROM \\"PatrolCheckpoint\\" pc
        JOIN \\"PatrolSession\\" ps ON ps.id = pc.\\"patrolSessionId\\"
        JOIN \\"GuardAssignment\\" ga ON ga.id = ps.\\"assignmentId\\"
        JOIN \\"Employee\\" e ON e.id = ga.\\"employeeId\\"
        JOIN \\"User\\" u ON u.\\"employeeId\\" = e.id
        WHERE u.email = 'ujjwal.peninsula1@helloorbit.com'
        ORDER BY pc.\\"createdAt\\" DESC
        LIMIT 15;
    "'''
    stdin, stdout, stderr = ssh.exec_command(cmd4)
    print("RECENT CHECKPOINTS:\n", stdout.read().decode('utf-8'))

finally:
    ssh.close()
