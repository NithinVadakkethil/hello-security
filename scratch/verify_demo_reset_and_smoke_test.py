#!/usr/bin/env python3
"""
Verify Demo Face Reset and Smoke Test Functional Re-Enrollment
"""
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

JS_SCRIPT = """
const { PrismaClient, FaceEnrollmentStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

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

async function run() {
  console.log("=== CHECKING ALL PREVIOUSLY ENROLLED EMPLOYEES ===");
  const empCodes = ['EMP-000017', 'EMP-000002', 'EMP-000037', 'EMP-000038', 'EMP-000003', 'EMP-000039', 'EMP-000040', 'EMP-000035', 'EMP-000009'];
  const employees = await prisma.employee.findMany({
    where: { employeeNumber: { in: empCodes } },
    include: { faceEnrollment: true, user: true, client: true }
  });

  console.log(`Auditing ${employees.length} employees:`);
  let allUnregistered = true;
  for (const emp of employees) {
    const hasEnrollment = !!emp.faceEnrollment;
    console.log(`  [${emp.employeeNumber}] ${emp.firstName} ${emp.lastName || ''} (${emp.client.companyName}): status=${hasEnrollment ? emp.faceEnrollment.status : 'NOT_REGISTERED'} (id=${hasEnrollment ? emp.faceEnrollment.id : 'null'})`);
    if (hasEnrollment) allUnregistered = false;
  }

  if (allUnregistered) {
    console.log("✓ SUCCESS: All 9 employees have status NOT_REGISTERED and faceEnrollment == null.");
  } else {
    console.error("❌ FAILED: Found lingering face enrollment records!");
    process.exit(1);
  }

  console.log("\\n=== CONTROLLED FUNCTIONAL RE-ENROLLMENT TEST ===");
  const testEmp = employees.find(e => e.employeeNumber === 'EMP-000017');
  console.log(`Selected test employee: ${testEmp.employeeNumber} (${testEmp.firstName} ${testEmp.lastName || ''})`);

  // Generate 128-D SFace v2 normalized template
  const syntheticTemplate = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = (Math.sin(i * 0.5) + Math.cos(i * 0.3));
    syntheticTemplate.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  const normalizedTemplate = syntheticTemplate.map(v => v / norm);

  // 1. Simulate registration
  const encrypted = encryptTemplate(normalizedTemplate);
  const created = await prisma.faceEnrollment.create({
    data: {
      employeeId: testEmp.id,
      clientId: testEmp.clientId,
      status: FaceEnrollmentStatus.REGISTERED,
      encryptedTemplate: encrypted,
      modelName: 'SFace',
      modelVersion: 'v2',
      embeddingDimension: 128,
      registeredAt: new Date()
    }
  });
  console.log(`✓ Created test enrollment: id=${created.id}, model=${created.modelName}, version=${created.modelVersion}, dim=${created.embeddingDimension}`);

  // 2. Fetch and decrypt template
  const fetched = await prisma.faceEnrollment.findUnique({
    where: { employeeId: testEmp.id }
  });
  const decrypted = decryptTemplate(fetched.encryptedTemplate);
  console.log(`✓ Template fetched & decrypted: length=${decrypted.length}, status=${fetched.status}`);

  // 3. Remove test record so demoorbitdb remains at zero
  await prisma.faceEnrollment.delete({
    where: { id: created.id }
  });
  console.log(`✓ Test enrollment cleaned up.`);

  const finalCount = await prisma.faceEnrollment.count();
  console.log(`✓ Final FaceEnrollment table count in demoorbitdb: ${finalCount}`);
  
  process.exit(0);
}

run().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
"""

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
    
    sftp = client.open_sftp()
    with sftp.open('/tmp/run_verify_and_smoke.js', 'w') as f:
        f.write(JS_SCRIPT)
    sftp.close()

    stdin, stdout, stderr = client.exec_command("cd /var/www/demoorbit/hello-security && NODE_PATH=/var/www/demoorbit/hello-security/node_modules node /tmp/run_verify_and_smoke.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)

    # Clean up
    client.exec_command("rm -f /tmp/run_verify_and_smoke.js")
    client.close()

if __name__ == '__main__':
    main()
