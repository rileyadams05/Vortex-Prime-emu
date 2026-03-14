# 🌐 Production Website Setup

## Your Setup Explained

### ✅ What You Have:
- **Domain**: `vortex-prime-emu.com` (Cloudflare-hosted)
- **Cloudflare Tunnel**: Exposes your local server to the internet
- **Local Development**: Backend on localhost:8000, Frontend on localhost:3005

### 🔄 How It Works:

```
Internet (vortex-prime-emu.com)
          ↓
   Cloudflare Tunnel
          ↓
   localhost:3005 (Frontend)
   localhost:8000 (Backend)
```

You're running the servers **locally on your computer**, and Cloudflare Tunnel makes them accessible at your public domain!

---

## 🚀 How to Start Your Production Website

### Quick Start (One Command):
```cmd
start-production.bat
```

This will:
1. ✅ Start backend server (localhost:8000)
2. ✅ Start frontend server (localhost:3005)
3. ✅ Start Cloudflare tunnel
4. ✅ Make your site live at https://vortex-prime-emu.com

---

## 📋 Manual Start (If Needed)

### Step 1: Start Local Servers
```cmd
node start-dev-servers.js
```

### Step 2: Start Cloudflare Tunnel (in a NEW terminal)
```cmd
cloudflared tunnel run vortex
```

---

## 🌍 Your URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Public Website** | https://vortex-prime-emu.com | Your main site (accessible to anyone) |
| **Discord Webhook** | https://discord.vortex-prime-emu.com | Backend API for Discord |
| **Local Frontend** | http://localhost:3005 | Local development only |
| **Local Backend** | http://localhost:8000 | Local API only |

---

## 🔧 Your Cloudflare Tunnel Configuration

**File**: `cloudflared.yml`

```yaml
tunnel: 1fad916c-1f3f-4e41-ac61-2b088b1c3c4c
credentials-file: C:\Users\Riley\.cloudflared\1fad916c-1f3f-4e41-ac61-2b088b1c3c4c.json

ingress:
  - hostname: discord.vortex-prime-emu.com
    service: http://localhost:8000     # Backend API
  - hostname: vortex-prime-emu.com
    service: http://localhost:3005     # Frontend React App
  - service: http_status:404
```

---

## ✅ Why You Need Localhost

**You asked**: "Why are we running on localhost?"

**Answer**: Your production website **IS** running on your local computer! 

Cloudflare Tunnel creates a secure connection from:
- Your local servers (localhost) → Cloudflare → Public internet (vortex-prime-emu.com)

This is a common setup for:
- ✅ Development/testing before deploying to cloud
- ✅ Home server hosting
- ✅ Personal projects without cloud hosting costs

---

## 🔄 Production vs Development

### Current Setup: **Development on Local Machine**
- Servers run on **your computer**
- Cloudflare Tunnel exposes them to the internet
- You pay only for **domain registration** (not server hosting)

### Alternative: **Cloud Hosting** (Not your current setup)
- Would involve deploying to:
  - Cloudflare Pages (frontend)
  - Cloudflare Workers (backend)
  - Or other cloud platforms (Vercel, AWS, etc.)

---

## 🚨 Important Notes

### ⚠️ Your Computer Must Stay On
- Your website only works when **your computer is running**
- When you shut down → Website goes offline

### 🔐 Security
- Cloudflare Tunnel is secure (encrypted connection)
- Your credentials are stored in: `C:\Users\Riley\.cloudflared\`
- Never commit credentials to Git!

### 📊 Monitoring
Check if your site is live:
- Visit: https://vortex-prime-emu.com
- Check tunnel status: `cloudflared tunnel info vortex`

---

## 🛠️ Troubleshooting

### Website Not Loading?
1. Check if local servers are running: `http://localhost:3005`
2. Check if tunnel is running: `Get-Process cloudflared`
3. Restart everything: `start-production.bat`

### Tunnel Won't Start?
```cmd
cloudflared tunnel login
cloudflared tunnel run vortex
```

### Update Cloudflared (Recommended)
```cmd
winget upgrade cloudflare.cloudflared
```

---

## 📱 Next Steps

1. **Start your site**: Run `start-production.bat`
2. **Test it**: Visit https://vortex-prime-emu.com
3. **Check API**: Visit https://discord.vortex-prime-emu.com/api/config/external-apis

---

## 💡 Want True Cloud Hosting?

If you want your site to stay online 24/7 without your computer:

1. **Cloudflare Pages** (Free tier available)
   - Deploy frontend to Pages
   - Deploy backend to Workers

2. **Vercel** (Free tier available)
   - Full-stack hosting
   - Automatic deployments from GitHub

3. **Keep Current Setup** (What you have now)
   - Free (except domain costs)
   - Full control
   - Requires your computer to stay on

---

**Your current setup is perfectly valid!** Many developers use this for personal projects. 🚀
