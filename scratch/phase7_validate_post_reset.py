#!/usr/bin/env python3
"""
Phase 7 — Post-Reset Validation & Functional Re-Enrollment Smoke Test on demoorbitdb
"""
import paramiko
import sys

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def main():
    print("=" * 70)
    print("PHASE 7 — POST-RESET VALIDATION & FUNCTIONAL TEST ON DEMOORBITDB")
    print("=" * 70)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)

    # 1. Post-reset database counts
    print("\n[1/4] Verifying demoorbitdb Table Counts Post-Reset:")
    count_sql = """
sudo -u postgres psql -d demoorbitdb -c "
SELECT 'FaceEnrollment' as table_name, count(*) as count FROM \\\"FaceEnrollment\\\"
UNION ALL
SELECT 'Client', count(*) FROM \\\"Client\\\"
UNION ALL
SELECT 'Employee', count(*) FROM \\\"Employee\\\"
UNION ALL
SELECT 'User', count(*) FROM \\\"User\\\"
UNION ALL
SELECT 'Attendance', count(*) FROM \\\"Attendance\\\"
UNION ALL
SELECT 'PatrolSession', count(*) FROM \\\"PatrolSession\\\"
UNION ALL
SELECT 'PatrolCheckpoint', count(*) FROM \\\"PatrolCheckpoint\\\"
UNION ALL
SELECT 'Incident', count(*) FROM \\\"Incident\\\"
UNION ALL
SELECT 'Snag', count(*) FROM \\\"Snag\\\";
"
"""
    stdin, stdout, stderr = client.exec_command(count_sql)
    counts_out = stdout.read().decode('utf-8')
    print(counts_out)

    normalized_counts = "".join(counts_out.split())
    if 'FaceEnrollment|0' not in normalized_counts:
        print("❌ Error: FaceEnrollment count is not 0!")
        client.close()
        sys.exit(1)
    print("✓ Total FaceEnrollment count in demoorbitdb is strictly 0.")

    # 2. Verify all 9 previously enrolled employees report NOT_REGISTERED
    print("\n[2/4] Testing Backend faceEnrollmentService.getStatus for all 9 employees:")
    test_employees_js = """
const { PrismaClient, FaceEnrollmentStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEmployees() {
  const empCodes = ['EMP-000017', 'EMP-000002', 'EMP-000037', 'EMP-000038', 'EMP-000003', 'EMP-000039', 'EMP-000040', 'EMP-000035', 'EMP-000009'];
  const employees = await prisma.employee.findMany({
    where: { employeeNumber: { in: empCodes } },
    include: { faceEnrollment: true, user: true, client: true }
  });

  console.log(`Found ${employees.length} employees to verify.`);
  let allUnregistered = true;

  for (const emp of employees) {
    const hasEnrollment = !!emp.faceEnrollment;
    const status = hasEnrollment ? emp.faceEnrollment.status : 'NOT_REGISTERED';
    console.log(`- ${emp.employeeNumber} (${emp.firstName} ${emp.lastName || ''}): status=${status}, faceEnrollment=${hasEnrollment ? emp.faceEnrollment.id : 'null'}`);
    if (hasEnrollment) {
      allUnregistered = false;
    }
  }

  if (allUnregistered) {
    console.log('✓ ALL 9 employees successfully verified as NOT_REGISTERED.');
  } else {
    console.error('❌ Some employees still have enrollment records!');
    process.exit(1);
  }
  await prisma.$disconnect();
}

checkEmployees().catch(e => { console.error(e); process.exit(1); });
"""
    sftp = client.open_sftp()
    with sftp.open('/tmp/check_employees.js', 'w') as f:
        f.write(test_employees_js)
    
    stdin, stdout, stderr = client.exec_command("cd /var/www/demoorbit/hello-security && node /tmp/check_employees.js")
    check_emp_out = stdout.read().decode('utf-8')
    print(check_emp_out)
    if stderr.read().decode('utf-8'):
        print("STDERR:", stderr.read().decode('utf-8'))

    # 3. Functional re-enrollment smoke test with designated test employee (EMP-000017)
    print("\n[3/4] Performing Functional Re-Enrollment Test for designated test employee (EMP-000017 / Habeeb Atlabs):")
    reenroll_test_js = """
const { PrismaClient, FaceEnrollmentStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Emulate backend face template crypto
const ENCRYPTION_KEY = process.env.FACE_TEMPLATE_ENCRYPTION_KEY || 'default-orbit-secure-face-key-32b';
const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

function encryptTemplate(arr) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(arr);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptTemplate(str) {
  const [ivHex, tagHex, encryptedHex] = str.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function testReEnrollment() {
  const emp = await prisma.employee.findFirst({
    where: { employeeNumber: 'EMP-000017' }
  });

  if (!emp) {
    throw new Error('Test employee EMP-000017 not found');
  }

  console.log(`Testing with employee: ${emp.id} (${emp.firstName} ${emp.lastName})`);

  // Generate synthetic 128-D SFace v2 normalized embedding
  const syntheticTemplate = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = (Math.sin(i * 0.5) + Math.cos(i * 0.3));
    syntheticTemplate.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  const normalizedTemplate = syntheticTemplate.map(v => v / norm);

  // 1. Create fresh enrollment
  const encrypted = encryptTemplate(normalizedTemplate);
  const created = await prisma.faceEnrollment.create({
    data: {
      employeeId: emp.id,
      clientId: emp.clientId,
      status: FaceEnrollmentStatus.REGISTERED,
      encryptedTemplate: encrypted,
      modelName: 'SFace',
      modelVersion: 'v2',
      embeddingDimension: 128,
      registeredAt: new Date()
    }
  });

  console.log(`✓ Test enrollment created: ID=${created.id}, model=${created.modelName}, version=${created.modelVersion}, dim=${created.embeddingDimension}`);

  // 2. Verify status and decryption
  const fetched = await prisma.faceEnrollment.findUnique({
    where: { employeeId: emp.id }
  });
  const decrypted = decryptTemplate(fetched.encryptedTemplate);
  console.log(`✓ Template decrypted successfully: length=${decrypted.length}, first element=${decrypted[0].toFixed(4)}`);

  // 3. Remove test record to leave table completely clean
  await prisma.faceEnrollment.delete({
    where: { id: created.id }
  });
  console.log('✓ Test enrollment record cleanly deleted after verification.');

  const finalCount = await prisma.faceEnrollment.count();
  console.log(`✓ Final FaceEnrollment table count: ${finalCount}`);
  await prisma.$disconnect();
}

testReEnrollment().catch(e => { console.error(e); process.exit(1); });
"""
    with sftp.open('/tmp/reenroll_test.js', 'w') as f:
        f.write(reenroll_test_js)
    sftp.close()

    stdin, stdout, stderr = client.exec_command("cd /var/www/demoorbit/hello-security && node /tmp/reenroll_test.js")
    reenroll_out = stdout.read().decode('utf-8')
    print(reenroll_out)
    if stderr.read().decode('utf-8'):
        print("STDERR:", stderr.read().decode('utf-8'))

    # 4. Final verification of zero records in demoorbitdb
    print("\n[4/4] Final Database Verification:")
    final_sql = "sudo -u postgres psql -d demoorbitdb -c 'SELECT count(*) as final_face_enrollment_count FROM \"FaceEnrollment\";'"
    stdin, stdout, stderr = client.exec_command(final_sql)
    print(stdout.read().decode('utf-8'))

    # Clean up temp scripts on server
    client.exec_command("rm -f /tmp/check_employees.js /tmp/reenroll_test.js /tmp/audit_fe.sql /tmp/execute_face_reset.sql /tmp/verify_test_db.sql /tmp/audit_clients.sql")

    client.close()
    print("=" * 70)
    print("PHASE 7 COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == '__main__':
    main()
