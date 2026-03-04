import requests

url = "http://157.180.112.226/"
print(f"Testing: {url}")
print("")

try:
    response = requests.get(url, timeout=5)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✓ App is accessible on port 80 without :3000!")
    else:
        print(f"Response: {response.text[:100]}")
except Exception as e:
    print(f"Error: {e}")
