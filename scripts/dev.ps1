Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing required command: $Name"
    exit 1
  }
}

Require-Command node
Require-Command npm

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".env") -and (Test-Path "env.example")) {
  Copy-Item "env.example" ".env" -Force
  Write-Host "Created .env from env.example"
}

try {
  npm ci
} catch {
  Write-Host "npm ci failed; falling back to npm install"
  npm install
}

npm run dev

