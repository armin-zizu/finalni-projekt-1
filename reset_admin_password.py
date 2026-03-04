import requests
import json

url = "http://157.180.112.226:3000/api/admin/reset-password"
data = {
    "email": "gitara.zizu@gmail.com",
    "newPassword": "novasifra123",
    "adminSecret": "EmergencyAdminReset2024!"
}

print("Resetting admin password...")
print(f"URL: {url}")
print(f"Email: {data['email']}")
print("")

try:
    response = requests.post(url, json=data, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
