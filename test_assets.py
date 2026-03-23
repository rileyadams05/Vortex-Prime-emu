import requests
try:
    r = requests.get('http://localhost:3001/assets/audio/select.wav')
    print(f"Status: {r.status_code}")
    print(f"Content-Type: {r.headers.get('Content-Type')}")
except Exception as e:
    print(f"Error: {e}")
