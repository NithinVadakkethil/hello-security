import paramiko
import time

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, timeout=30)
    
    print("Checking PM2 logs for hello-security-api...")
    stdin, stdout, stderr = ssh.exec_command("pm2 logs hello-security-api --lines 30 --nostream")
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    print("Waiting 5 seconds and checking health again...")
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command("curl -s -i http://127.0.0.1:4000/api/v1/health")
    print(stdout.read().decode('utf-8'))
    
    stdin, stdout, stderr = ssh.exec_command("curl -s -I https://orbit.helloentry.com/login")
    print(stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
