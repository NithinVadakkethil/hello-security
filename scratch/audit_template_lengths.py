import paramiko

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)

    cmd = '''node -e '
const { PrismaClient } = require("/var/www/orbit/hello-security/node_modules/@prisma/client");
const { decryptFaceTemplate } = require("/var/www/orbit/hello-security/api/dist/api/src/common/security/face-template-crypto");
const prisma = new PrismaClient();

async function check() {
  const records = await prisma.faceEnrollment.findMany({
    select: {
      id: true,
      employeeId: true,
      modelName: true,
      modelVersion: true,
      embeddingDimension: true,
      encryptedTemplate: true,
      registeredAt: true,
      client: { select: { companyName: true } },
      employee: { select: { firstName: true, lastName: true } }
    }
  });

  console.log(`Found ${records.length} face enrollment records in orbitdb:`);
  for (const r of records) {
    try {
      const decrypted = decryptFaceTemplate(r.encryptedTemplate);
      const isArray = Array.isArray(decrypted);
      const len = isArray ? decrypted.length : 0;
      const allFinite = isArray && decrypted.every(n => Number.isFinite(n));
      let sumSq = 0;
      if (isArray) {
        for (const v of decrypted) sumSq += v * v;
      }
      const l2Norm = Math.sqrt(sumSq);

      console.log(`- ${r.employee.firstName} ${r.employee.lastName || ""} (${r.client.companyName}): Model=${r.modelName}, Ver=${r.modelVersion}, StoredDim=${r.embeddingDimension}, DecryptedLen=${len}, Finite=${allFinite}, L2Norm=${l2Norm.toFixed(4)}, Date=${r.registeredAt.toISOString()}`);
    } catch (err) {
      console.log(`- ${r.employee.firstName} ${r.employee.lastName || ""}: DECRYPT FAILED: ${err.message}`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
' '''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("OUTPUT:\n", stdout.read().decode('utf-8'))
    print("STDERR:\n", stderr.read().decode('utf-8'))

finally:
    ssh.close()
