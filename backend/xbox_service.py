import os
import requests
from fastapi import HTTPException

OPENXBL_API_KEY = os.environ.get('OPENXBL_API_KEY', '')
OPENXBL_API_BASE = 'https://xbl.io/api/v2'

def get_xbox_profile():
    """Fetch Xbox profile from OpenXBL API"""
    try:
        headers = {
            'X-Authorization': OPENXBL_API_KEY,
            'Accept': 'application/json'
        }
        response = requests.get(f'{OPENXBL_API_BASE}/account', headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
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
