# Xnet Backend (Radius Pro)

Node/Express backend API for the Radius Pro system.

## Windows 11 quickstart (recommended)

Prereqs:
- Node.js 20+
- npm

Steps (PowerShell):

```powershell
Copy-Item env.example .env
npm ci
npm run dev
```

Single command helper:

```powershell
.\scripts\dev.ps1
```

## Docker (Windows 11 + Docker Desktop)

Development stack:

```powershell
.\scripts\docker-dev.ps1
```

Production-like stack:

```powershell
.\scripts\docker-prod.ps1
```

Stop:

```powershell
.\scripts\docker-down.ps1
```

## Notes

- `.env` is ignored by git; use `env.example` as your template.
- Do not commit credentials (Twilio/WhatsApp tokens, DB passwords, etc).

