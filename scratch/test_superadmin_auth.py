import paramiko
import sys
import json

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, timeout=15)
    print("Connected successfully.")

    def run(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        return out

    # Test login with Password123!
    cmd1 = """curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@hellosecurity.com","password":"Password123!"}'"""
    res1 = run(cmd1)
    print("Login with 'Password123!':\n", res1)

    # Test login with Admin@123
    cmd2 = """curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@hellosecurity.com","password":"Admin@123"}'"""
    res2 = run(cmd2)
    print("\nLogin with 'Admin@123':\n", res2)

    # Check rawPassword in DB
    cmd3 = '''sudo -u postgres psql -d orbitdb -c "SELECT id, email, role, \\"rawPassword\\" FROM \\"User\\" WHERE email = 'admin@hellosecurity.com';"'''
    res3 = run(cmd3)
    print("\nDB User Info:\n", res3)

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    ssh.close()
