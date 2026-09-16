#!/usr/bin/env python3
import paramiko
import urllib.request
import ssl

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def check_pm2():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=10)
        stdin, stdout, stderr = client.exec_command('pm2 jlist')
        import json
        processes = json.loads(stdout.read().decode('utf-8'))
        print("=== PM2 PROCESS STATUS ===")
        for proc in processes:
            name = proc.get('name')
            status = proc.get('pm2_env', {}).get('status')
            uptime = proc.get('pm2_env', {}).get('pm_uptime')
            print(f"- {name}: {status}")
    finally:
        client.close()

def check_http():
    print("\n=== HTTP HEALTH CHECKS ===")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    urls = [
        "https://orbit.helloentry.com",
    ]
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(req, context=ctx, timeout=10)
            print(f"[SUCCESS] {url} -> Status {res.status}")
        except Exception as e:
            print(f"[FAILURE] {url} -> Error: {e}")

if __name__ == '__main__':
    check_pm2()
    check_http()
