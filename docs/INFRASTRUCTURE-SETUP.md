# Vortex Prime - Infrastructure Setup Guide

This document provides complete setup instructions for deploying Vortex Prime's website infrastructure using GitHub Pages and Cloudflare DNS, along with the custom protocol handler for launching the desktop application from the browser.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Cloudflare & GitHub Configuration](#cloudflare--github-configuration)
3. [Website Deployment](#website-deployment)
4. [Windows Protocol Handler Setup](#windows-protocol-handler-setup)
5. [Testing Checklist](#testing-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   User Browser                                                    │
│       │                                                           │
│       ▼                                                           │
│   vortex-prime-emu.com ──► Cloudflare DNS ──► GitHub Pages       │
│       │                    (Full Strict SSL)  (Static Files)      │
│       │                                                           │
│       ▼                                                           │
│   Click "Launch" button                                           │
│       │                                                           │
│       ▼                                                           │
│   vortexprime://launch ──► Windows Registry ──► Vortex Prime UI  │
│   (Custom Protocol)        (Protocol Handler)   (Tauri App)       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- No local web server or tunnel required
- Cloudflare handles DNS only (not proxying)
- GitHub Pages serves the static landing page from `/docs` folder
- Deep link plugin in Tauri automatically registers the protocol on install

---

## Cloudflare & GitHub Configuration

### Step 1: GitHub Repository Setup

1. Your landing page is already in the `docs/` folder
2. Push your changes to the repository

3. **Enable GitHub Pages:**
   - Go to **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` / `/docs`
   - Click **Save**

4. **Configure Custom Domain:**
   - In the same Pages settings, under "Custom domain"
   - Enter: `vortex-prime-emu.com`
   - Click **Save**
   - Check "Enforce HTTPS" (after DNS propagates)

### Step 2: Cloudflare DNS Configuration

Navigate to your Cloudflare dashboard → **vortex-prime-emu.com** → **DNS** → **Records**

**Delete any existing A/AAAA/CNAME records** for the root domain and www subdomain, then add:

#### For Root Domain (@)

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | 185.199.108.153 | DNS only (gray cloud) | Auto |
| A | @ | 185.199.109.153 | DNS only (gray cloud) | Auto |
| A | @ | 185.199.110.153 | DNS only (gray cloud) | Auto |
| A | @ | 185.199.111.153 | DNS only (gray cloud) | Auto |

#### For WWW Subdomain

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| CNAME | www | vortex-prime-emu.com | DNS only (gray cloud) | Auto |

**⚠️ IMPORTANT:** Set Proxy Status to **"DNS only"** (gray cloud icon, not orange). This is critical because GitHub Pages handles SSL, not Cloudflare.

### Step 3: Cloudflare SSL Settings

Go to **SSL/TLS** → **Overview**:
- Set encryption mode to: **Full (strict)**

Go to **SSL/TLS** → **Edge Certificates**:
- Ensure "Always Use HTTPS" is **ON**
- "Automatic HTTPS Rewrites" can be **ON**

---

## Website Deployment

### File Structure (Already Set Up)

```
docs/
├── index.html          # Landing page
├── favicon.svg         # Site favicon
└── CNAME               # GitHub Pages custom domain
```

### Deployment

Just commit and push:
```bash
git add .
git commit -m "Deploy Vortex Prime landing page"
git push origin main
```

---

## Windows Protocol Handler Setup

### Automatic (Built into Tauri)

The `vortexprime://` protocol is **automatically registered** when users install your app via the MSI or NSIS installer. This is configured in:

- `src-tauri/tauri.conf.json` - deep-link plugin config
- `src-tauri/Cargo.toml` - tauri-plugin-deep-link dependency
- `src-tauri/src/main.rs` - plugin initialization

No manual registry editing required for end users!

### Manual (For Development/Testing)

If you need to register manually during development:

**Option 1: Registry File**
```bash
# Run the .reg file
regedit /s installer/vortexprime-protocol.reg
```

**Option 2: PowerShell (Run as Admin)**
```powershell
.\installer\Register-VortexPrimeProtocol.ps1
```

---

## Testing Checklist

### DNS Propagation Testing

```powershell
# Check DNS records
nslookup vortex-prime-emu.com

# Should return GitHub Pages IPs: 185.199.108-111.153
```

### Protocol Handler Testing

```powershell
# Test from Run dialog (Win + R)
vortexprime://launch

# Check registry entry exists
reg query HKEY_CLASSES_ROOT\vortexprime /s
```

### Full Integration Test

1. Build and install your Tauri app
2. Visit `https://vortex-prime-emu.com`
3. Click "Launch Vortex Prime"
4. App should open

---

## Troubleshooting

### DNS Issues

**Website shows Cloudflare error:**
- Ensure proxy status is "DNS only" (gray cloud)

**SSL certificate warning:**
- Wait for DNS propagation (up to 48 hours)
- Enable "Enforce HTTPS" in GitHub Pages

### Protocol Handler Issues

**"Windows cannot find 'vortexprime://launch'":**
- Build and install the app first (MSI/NSIS)
- Or run the manual registration script

**Wrong application opens:**
- Check registry path in `HKEY_CLASSES_ROOT\vortexprime\shell\open\command`

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/index.html` | Landing page for GitHub Pages |
| `docs/CNAME` | Custom domain config |
| `src-tauri/tauri.conf.json` | Deep link plugin config |
| `src-tauri/Cargo.toml` | Deep link dependency |
| `installer/*.reg` | Manual protocol registration |
| `installer/*.ps1` | PowerShell registration script |
