import requests
import json

url = "http://157.180.112.226:3000/api/auth/login"
data = {
    "email": "gitara.zizu@gmail.com",
    "password": "novasifra123"
}

print("Testing login with:")
print(f"URL: {url}")
print(f"Data: {json.dumps(data)}")
print("")

try:
    response = requests.post(url, json=data, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
