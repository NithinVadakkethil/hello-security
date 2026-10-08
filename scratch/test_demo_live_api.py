#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=30):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    cmd = """
python3 -c "
import urllib.request, json

API_URL = 'http://127.0.0.1:3101/api/v1'

def make_request(url, method='GET', headers=None, data=None):
    if headers is None:
        headers = {}
    body = None
    if data:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

status, body = make_request(f'{API_URL}/health')
print('1. Health check:', status, body)

login_payload = {'email': 'kaizen.legend@helloorbit.com', 'password': 'Password@123'}
status, body = make_request(f'{API_URL}/auth/login', method='POST', data=login_payload)
print('2. Login status:', status)
if status == 200:
    token = body['data']['accessToken']
    print('3. Token acquired successfully.')
    headers = {'Authorization': f'Bearer {token}'}
    status, cat_body = make_request(f'{API_URL}/checkpoint-categories', headers=headers)
    print('4. Checkpoint categories status:', status, 'Total categories found:', len(cat_body.get('data', [])))

    status, att_body = make_request(f'{API_URL}/attendance', headers=headers)
    print('5. Attendance status:', status)
    if status == 200:
        metrics = att_body.get('metrics') or att_body.get('data', {}).get('metrics')
        print('6. Attendance metrics:', metrics)
"
"""
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
