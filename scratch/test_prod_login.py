import urllib.request
import urllib.error
import json

BASE_URL = "https://orbit.helloentry.com/api/v1"
UPDATED_PASS = "@.Pd4j4p0c@fgfgO0FE123"

accounts_to_test = [
    ("superadmin@orbit.com", UPDATED_PASS, "Super Admin"),
    ("superadmin@helloorbit.com", UPDATED_PASS, "Super Admin (helloorbit)"),
    ("varinder.k@kaizenams.com", UPDATED_PASS, "Varinder Centralized Manager"),
    ("kaizen.legend@helloorbit.com", UPDATED_PASS, "Kaizen Legend Client Admin"),
    ("admin@kaizen.com", UPDATED_PASS, "Admin Kaizen"),
    ("superadmin@kaizenams.com", UPDATED_PASS, "Super Admin Kaizen")
]

def test_login(email, password, label):
    url = f"{BASE_URL}/auth/login"
    payload = json.dumps({"email": email, "password": password}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            body = response.read().decode('utf-8')
            data = json.loads(body)
            user_data = data.get('user', {})
            role = user_data.get('role') or data.get('role')
            print(f"[{label}] {email}: Status {status}")
            print(f"  ✅ LOGIN SUCCESS! User: {user_data.get('email')}, Role: {role}")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"[{label}] {email}: Status {e.code}")
        print(f"  ❌ Failed: {body[:150]}")
    except Exception as e:
        print(f"[{label}] {email}: Exception {e}")

def main():
    print("Testing Updated Production Passwords...")
    for email, passw, label in accounts_to_test:
        test_login(email, passw, label)

if __name__ == "__main__":
    main()
