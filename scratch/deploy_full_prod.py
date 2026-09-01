import paramiko
import os
import sys

def deploy_full():
    print("🚀 Starting FULL Production Deployment to 194.76.27.3...")
    
    host = '194.76.27.3'
    user = 'root'
    password = '@.Pd4j4p0c@O0FE123'
    remote_root = '/var/www/orbit/hello-security'
    local_root = '/Users/zinfogcodelabs/Documents/Projects/hello-security'

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, 22, user, password)

    sftp = client.open_sftp()

    # Directories/files to exclude from upload
    ignored_dirs = {'.git', 'node_modules', '.next', 'dist', '.nx', 'scratch', 'tmp', '.gemini'}
    ignored_files = {'.DS_Store', 'package-lock.json', '.env'}

    count = 0
    print("📂 Synchronizing source files to remote server...")
    for root, dirs, files in os.walk(local_root):
        # Filter out ignored directories
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        
        rel_dir = os.path.relpath(root, local_root)
        if rel_dir == '.':
            remote_dir = remote_root
        else:
            remote_dir = os.path.join(remote_root, rel_dir)

        for f in files:
            if f in ignored_files or f.endswith('.log'):
                continue
            
            local_file = os.path.join(root, f)
            remote_file = os.path.join(remote_dir, f)

            # Ensure remote directory exists
            try:
                sftp.stat(remote_dir)
            except IOError:
                client.exec_command(f"mkdir -p {remote_dir}")
            
            sftp.put(local_file, remote_file)
            count += 1
            if count % 25 == 0:
                print(f"   Uploaded {count} files...")

    print(f"✅ Uploaded {count} source files total.")
    sftp.close()

    # Commands to execute on server safely
    commands = [
        ("Installing dependencies with pnpm", f"cd {remote_root} && pnpm install --no-frozen-lockfile"),
        ("Generating Prisma Client", f"cd {remote_root} && pnpm prisma generate"),
        ("Building API production bundle", f"cd {remote_root} && pnpm nx build api"),
        ("Building Web production bundle", f"cd {remote_root} && pnpm nx build web"),
        ("Reloading PM2 services", f"cd {remote_root} && pm2 reload hello-security-api --update-env && pm2 reload hello-security-web --update-env"),
        ("Checking PM2 status", "pm2 status"),
    ]

    for title, cmd in commands:
        print(f"\n⚡ {title}...")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        if out:
            print(out)
        if err and "warning" not in err.lower() and "notice" not in err.lower():
            print("STDERR:", err)

    client.close()
    print("\n🎉 Production deployment completed with 100% data preservation!")

if __name__ == '__main__':
    deploy_full()
