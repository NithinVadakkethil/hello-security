#!/usr/bin/env python3
import sys
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    verify_script = r"""
set -e
cd /var/www/orbit/hello-security

echo "1. Fetching a sample production route with checkpoints:"
node -e '
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("\x27") && val.endsWith("\x27"))) {
      val = val.slice(1, -1);
    }
    process.env[match[1]] = val;
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const route = await prisma.patrolRoute.findFirst({
    where: { routeGates: { some: {} } },
    include: { routeGates: { include: { gate: true }, orderBy: { sequence: "asc" } } }
  });
  if (!route) {
    console.log("No route found with checkpoints.");
    return;
  }
  console.log("Sample Route ID:", route.id);
  console.log("Sample Route Name:", route.name);
  console.log("Configured Checkpoints Count:", route.routeGates.length);
  for (const rg of route.routeGates) {
    console.log("  - Seq " + rg.sequence + ": " + rg.gate.name + " (" + rg.gate.gateCode + ")");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
'

echo "2. PM2 Statuses:"
pm2 status
"""

    code, out, err = run_ssh(verify_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
