import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=60)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        return stdout.channel.recv_exit_status(), out, err
    finally:
        client.close()

if __name__ == '__main__':
    diag_script = """
set -e
echo "=================================================="
echo "PRODUCTION RECENT PM2 LOGS & RUNTIME ENV DUMP"
echo "=================================================="

echo "\n--- 1. LAST 50 LINES OF PM2 OUT LOG ---"
tail -n 50 /root/.pm2/logs/hello-security-api-out.log || true

echo "\n--- 2. LAST 50 LINES OF PM2 ERROR LOG ---"
tail -n 50 /root/.pm2/logs/hello-security-api-error.log || true

echo "\n--- 3. TEST NODE.JS RUNTIME RESOLUTION FROM API DIR ---"
cd /var/www/orbit/hello-security
node -e "
  require('./api/dist/api/src/main.js');
" || true
"""

    code, out, err = run_ssh(diag_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
