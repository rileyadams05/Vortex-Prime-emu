# API Configuration Guide

This guide explains how to configure external API integrations for Vortex Prime Emu.

## Required API Keys

### 1. RetroAchievements (for older console achievements)
- **Website**: https://retroachievements.org
- **Purpose**: Achievement tracking for retro consoles
- **How to get**:
  1. Create an account at https://retroachievements.org
  2. Go to your settings page
  3. Generate an API key
  4. Note your username

### 2. TheMovieDB (TMDB)
- **Website**: https://www.themoviedb.org
- **Purpose**: Game metadata, covers, and media assets
- **How to get**:
  1. Create an account at https://www.themoviedb.org
  2. Go to Settings → API
  3. Request an API key (it's free for personal use)
  4. Copy your API Key (v3 auth)

## Configuration Steps

### Backend Configuration

Edit `backend/.env` and add your API credentials:

```env
DISCORD_PUBLIC_KEY="your_discord_key"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000"
FRONTEND_URL="https://vortex-prime-emu.com"

# RetroAchievements API
RETROACHIEVEMENTS_API_KEY="your_retroachievements_api_key"
RETROACHIEVEMENTS_USERNAME="your_retroachievements_username"

# TheMovieDB API
TMDB_API_KEY="your_tmdb_api_key"
```

### Current Configuration

Based on your provided credentials:

**RetroAchievements:**
- Username: `Budm4n`
- API Key: `kPlV07kCeSlUZmIaRN5US4OdL01zO5Z8`

**TMDB:**
- API Key: `3b8df06dd26ade9055cc8aa9aee03ec5`

These are already configured in your `backend/.env` file.

## How It Works

1. **Backend** (`backend/server.py`):
   - Loads API credentials from `.env` file
   - Exposes them via `/api/config/external-apis` endpoint
   - Keeps credentials secure on the server side

2. **Frontend** (`frontend/src/pages/XeniaDashboard.jsx`):
   - Fetches credentials from backend API
   - Uses them to call RetroAchievements API
   - Displays achievement data in the dashboard

## Security Notes

- ✅ API keys are stored in `.env` files (excluded from git)
- ✅ Frontend fetches keys from backend (not exposed in client code)
- ✅ `.env` files should NEVER be committed to version control
- ⚠️ Keep your `.env` files backed up safely

## Troubleshooting

### 422 Errors from RetroAchievements
- **Cause**: Invalid username or API key
- **Solution**: Verify credentials at https://retroachievements.org/controlpanel.php

### "Credentials not configured" message
- **Cause**: Missing or empty values in `backend/.env`
- **Solution**: Add the required environment variables and restart the backend server

### TMDB API not working
- **Cause**: Invalid or expired API key
- **Solution**: Verify your API key at https://www.themoviedb.org/settings/api

## Supported Platforms

### RetroAchievements Supported Consoles:
- Sega Genesis / Mega Drive
- SNES
- Nintendo 64
- Game Boy / Game Boy Color / Game Boy Advance
- PlayStation 1
- And many more retro systems

### For Modern Consoles:
- Xbox 360: Uses x360db database
- PS3: Uses RPCS3 trophy system
- Modern systems: Integrated through other achievement systems

## Testing Your Setup

After configuring your API keys:

1. Restart the backend server: `python -m uvicorn server:app --reload` (from `backend/` directory)
2. Restart the frontend: `npm start` (from `frontend/` directory)
3. Check the browser console for success messages
4. Look for "RetroAchievements data loaded successfully" in the console

## API Endpoints Used

### RetroAchievements
- `GET https://retroachievements.org/API/API_GetUserSummary.php?y={api_key}&u={username}`
- Returns user profile, recent achievements, and statistics

### TMDB (Future Integration)
- `GET https://api.themoviedb.org/3/search/game?api_key={api_key}&query={game_name}`
- Returns game metadata, covers, and media assets
