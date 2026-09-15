import paramiko

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, timeout=30)

    print("Checking API Health:")
    stdin, stdout, stderr = ssh.exec_command("curl -s -i http://127.0.0.1:4000/api/v1/health")
    print(stdout.read().decode('utf-8'))

    print("Checking Post-Deploy Row Counts:")
    stdin, stdout, stderr = ssh.exec_command("node /tmp/get_counts.js", cwd="/var/www/orbit/hello-security")
    print(stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
