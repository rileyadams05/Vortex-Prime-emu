import json
import urllib.request as r
try:
    data = r.urlopen('https://api.github.com/repos/BakasuraRCE/abgx360/contents').read().decode()
    with open('abgx360.json', 'w') as f:
        f.write(data)
except Exception as e:
    with open('abgx360.json', 'w') as f:
        f.write(str(e))
