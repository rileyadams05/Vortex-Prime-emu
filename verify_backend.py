import requests
results = {}
try:
    r = requests.get('http://localhost:3001/api/config/core')
    results['config'] = r.status_code
except Exception as e: results['config'] = str(e)

try:
    r = requests.get('http://localhost:3001/assets/audio/focus.wav')
    results['audio'] = r.status_code
except Exception as e: results['audio'] = str(e)

try:
    r = requests.get('http://localhost:3001/assets/wallpapers/Play/default.png')
    results['wallpaper'] = r.status_code
except Exception as e: results['wallpaper'] = str(e)

print(results)
