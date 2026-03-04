import requests
import json

print("Testing login on port 80 reverse proxy...")
print("")

url = "http://157.180.112.226/api/auth/login"
data = {
    "email": "gitara.zizu@gmail.com",
    "password": "novasifra123"
}

try:
    response = requests.post(url, json=data, timeout=5)
    print(f"Status: {response.status_code}")
    result = response.json()
    
    if response.status_code == 200 and result.get('success'):
        print("✓ Login successful on port 80!")
        print(f"User: {result['user']['email']}")
        print(f"Role: {result['user']['role']}")
    else:
        print(f"Response: {json.dumps(result, indent=2)}")
except Exception as e:
    print(f"Error: {e}")
