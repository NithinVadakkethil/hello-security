import paramiko
import sys
import json

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    def run(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        return stdout.read().decode('utf-8')

    # 1. Login to get Super Admin token
    login_cmd = """curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@hellosecurity.com","password":"Password123!"}'"""
    login_res = json.loads(run(login_cmd))
    token = login_res['data']['accessToken']
    print("Super Admin Token acquired.")

    # 2. Test GET /api/v1/dashboard
    dash_cmd = f"""curl -s -X GET http://localhost:3001/api/v1/dashboard -H "Authorization: Bearer {token}" """
    dash_res = run(dash_cmd)
    print("\nGET /api/v1/dashboard response snippet:\n", dash_res[:500])

    # 3. Test GET /api/v1/clients (Super Admin clients endpoint)
    clients_cmd = f"""curl -s -X GET http://localhost:3001/api/v1/clients -H "Authorization: Bearer {token}" """
    clients_res = run(clients_cmd)
    print("\nGET /api/v1/clients response snippet:\n", clients_res[:500])

finally:
    ssh.close()
