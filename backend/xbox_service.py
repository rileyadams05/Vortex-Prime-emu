import os
import requests
from fastapi import HTTPException

OPENXBL_API_KEY = os.environ.get('OPENXBL_API_KEY', '')
OPENXBL_API_BASE = 'https://xbl.io/api/v2'

def get_xbox_profile(gamertag: str = None):
    """Fetch Xbox profile from OpenXBL API"""
    try:
        headers = {
            'X-Authorization': OPENXBL_API_KEY,
            'Accept': 'application/json'
        }
        
        if gamertag:
            # Fetch specific gamertag profile
            response = requests.get(
                f'{OPENXBL_API_BASE}/friends/search?gt={gamertag}',
                headers=headers,
                timeout=10
            )
        else:
            # Fetch authenticated user account
            response = requests.get(f'{OPENXBL_API_BASE}/account', headers=headers, timeout=10)
        
        response.raise_for_status()
        data = response.json()
        
        # If searching by gamertag, extract first result
        if gamertag and isinstance(data, list) and len(data) > 0:
            return data[0]
        
        return data
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Xbox profile: {str(e)}")

def get_xbox_achievements(gamertag: str):
    """Fetch achievements for a specific gamertag"""
    try:
        headers = {
            'X-Authorization': OPENXBL_API_KEY,
            'Accept': 'application/json'
        }
        response = requests.get(
            f'{OPENXBL_API_BASE}/{gamertag}/achievements',
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch achievements: {str(e)}")
