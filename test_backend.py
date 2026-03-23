import requests
try:
    r = requests.get('http://localhost:3001/api/config/core')
    print(f"Status: {r.status_code}")
    print(f"Content: {r.text[:100]}")
except Exception as e:
    print(f"Error: {e}")
