import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    
    sql_script = """
    SELECT '--- OLD USER REFS ---' as section;
    SELECT 'AuditLog' as tbl, count(*) FROM "AuditLog" WHERE "userId" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'RefreshToken', count(*) FROM "RefreshToken" WHERE "userId" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'SnagComment', count(*) FROM "SnagComment" WHERE "userId" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'SnagHistory', count(*) FROM "SnagHistory" WHERE "userId" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'PatrolSession (verifiedBy)', count(*) FROM "PatrolSession" WHERE "verifiedById" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'PatrolSession (managerUser)', count(*) FROM "PatrolSession" WHERE "managerUserId" = 'cmspzj3m20056hp181h2sld3g'
    UNION ALL SELECT 'ManagerClientMembership', count(*) FROM "ManagerClientMembership" WHERE "managerUserId" = 'cmspzj3m20056hp181h2sld3g';

    SELECT '--- NEW USER REFS ---' as section;
    SELECT 'AuditLog' as tbl, count(*) FROM "AuditLog" WHERE "userId" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'RefreshToken', count(*) FROM "RefreshToken" WHERE "userId" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'SnagComment', count(*) FROM "SnagComment" WHERE "userId" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'SnagHistory', count(*) FROM "SnagHistory" WHERE "userId" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'PatrolSession (verifiedBy)', count(*) FROM "PatrolSession" WHERE "verifiedById" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'PatrolSession (managerUser)', count(*) FROM "PatrolSession" WHERE "managerUserId" = 'cmtve82rw001hhpr8zrjum69q'
    UNION ALL SELECT 'ManagerClientMembership', count(*) FROM "ManagerClientMembership" WHERE "managerUserId" = 'cmtve82rw001hhpr8zrjum69q';

    SELECT '--- KAIZEN LEGENDS CLIENT RECORD ---' as section;
    SELECT id, "clientCode", "companyName", email FROM "Client" WHERE id = 'cmspzj3lz0054hp189gaym6ky';
    """

    sftp = ssh.open_sftp()
    with sftp.open('/tmp/check.sql', 'w') as f:
        f.write(sql_script)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command('sudo -u postgres psql -d orbitdb -f /tmp/check.sql')
    print("STDOUT:\n", stdout.read().decode('utf-8'))
    print("STDERR:\n", stderr.read().decode('utf-8'))

    ssh.exec_command('rm -f /tmp/check.sql')

finally:
    ssh.close()
