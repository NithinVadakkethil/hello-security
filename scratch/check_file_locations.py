import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        return stdout.channel.recv_exit_status(), out, err
    finally:
        client.close()

if __name__ == '__main__':
    script = """
set -e
echo "1. Checking where .env is located:"
ls -la /var/www/orbit/hello-security/.env || echo ".env not in /var/www/orbit/hello-security"
ls -la /var/www/orbit/hello-security/api/.env || echo ".env not in /var/www/orbit/hello-security/api"

echo "2. Content of /var/www/orbit/hello-security/.env:"
cat /var/www/orbit/hello-security/.env

echo "3. Content of /var/www/orbit/hello-security/api/.env (if exists):"
cat /var/www/orbit/hello-security/api/.env || true
"""

    code, out, err = run_ssh(script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
