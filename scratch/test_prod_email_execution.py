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
cd /var/www/orbit/hello-security
pnpm --filter api exec node -e '
  const dotenv = require("dotenv");
  const path = require("path");
  dotenv.config({ path: path.resolve(__dirname, ".env") });

  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("WEB_APP_URL:", process.env.WEB_APP_URL);
  console.log("PUBLIC_API_URL:", process.env.PUBLIC_API_URL);
  console.log("API_URL:", process.env.API_URL);

  const isProd = process.env.NODE_ENV === "production";
  const defaultPublicApi = isProd ? "https://orbit.helloentry.com/api/v1" : "http://localhost:3001/api/v1";
  const baseUrl = (process.env.PUBLIC_API_URL || process.env.API_URL || defaultPublicApi).replace(/\\/+$/, "");
  console.log("Calculated baseUrl:", baseUrl);

  const defaultWebApp = isProd ? "https://orbit.helloentry.com" : "http://localhost:3000";
  const webAppBaseUrl = (process.env.WEB_APP_URL || process.env.FRONTEND_URL || defaultWebApp).replace(/\\/+$/, "");
  console.log("Calculated webAppBaseUrl:", webAppBaseUrl);
'
"""

    code, out, err = run_ssh(script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
