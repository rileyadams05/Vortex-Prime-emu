import os
import requests
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

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

def exchange_msal_token_for_profile(access_token: str):
    """
    Exchange MSAL access token for XSTS token and fetch Xbox profile.
    """
    try:
        # 1. Authenticate with Xbox Live (RPS)
        rps_url = "https://user.auth.xboxlive.com/user/authenticate"
        rps_payload = {
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT",
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": f"d={access_token}"
            }
        }
        rps_response = requests.post(rps_url, json=rps_payload, headers={"Content-Type": "application/json", "Accept": "application/json"})
        rps_response.raise_for_status()
        rps_data = rps_response.json()
        xbl_token = rps_data["Token"]
        user_hash = rps_data["DisplayClaims"]["xui"][0]["uhs"]

        # 2. Authorize with XSTS
        xsts_url = "https://xsts.auth.xboxlive.com/xsts/authorize"
        xsts_payload = {
            "RelyingParty": "http://xboxlive.com",
            "TokenType": "JWT",
            "Properties": {
                "UserTokens": [xbl_token],
                "SandboxId": "RETAIL"
            }
        }
        xsts_response = requests.post(xsts_url, json=xsts_payload, headers={"Content-Type": "application/json", "Accept": "application/json"})
        
        if xsts_response.status_code == 401:
             detail = xsts_response.json().get('XErr', 'Unknown XSTS error')
             raise HTTPException(status_code=401, detail=f"XSTS Authorization failed: {detail}")

        xsts_response.raise_for_status()
        xsts_data = xsts_response.json()
        xsts_token = xsts_data["Token"]

        # 3. Get Profile
        profile_url = f"https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag,Gamerscore,GameDisplayPicRaw"
        headers = {
            "x-xbl-contract-version": "2",
            "Authorization": f"XBL3.0 x={user_hash};{xsts_token}",
            "Accept-Language": "en-US"
        }
        
        profile_response = requests.get(profile_url, headers=headers)
        profile_response.raise_for_status()
        profile_data = profile_response.json()
        
        # Parse profile data
        # profile_data["profileUsers"][0]["id"] is the XUID
        xuid = profile_data["profileUsers"][0]["id"]
        
        settings = {s["id"]: s["value"] for s in profile_data["profileUsers"][0]["settings"]}
        
        gamertag = settings.get("Gamertag")
        gamerscore = settings.get("Gamerscore")
        pfp_url = settings.get("GameDisplayPicRaw")
        
        return {
            "xuid": xuid,
            "gamertag": gamertag,
            "gamerscore": gamerscore,
            "profilePicture": pfp_url
        }

    except requests.exceptions.HTTPError as e:
        logger.error(f"Xbox Auth Error: {e.response.text if e.response else str(e)}")
        raise HTTPException(status_code=e.response.status_code if e.response else 500, detail=f"Xbox Authentication Failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected Xbox Auth Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error during Xbox Auth: {str(e)}")
