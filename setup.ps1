# Ecom-ERP first-time setup — installs everything a new user needs.
# Usage: right-click > Run with PowerShell, or: powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
# Then launch with: .\start.ps1  (backend :5172 | storefront :5173 | admin :5174)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Step($name) { Write-Output ""; Write-Output "=== $name ===" }

# 1. Node.js present?
Step "Checking Node.js"
try { $nodeV = node --version } catch { $nodeV = $null }
if (-not $nodeV) {
  Write-Output "Node.js NOT found. Install Node 18+ from https://nodejs.org (LTS), then re-run this script."
  exit 1
}
Write-Output "node $nodeV | npm $(npm --version)"

# 2. Install dependencies (server + both frontends; mobile apps are separate)
foreach ($app in @("server", "client", "client-admin")) {
  Step "Installing $app"
  $dir = Join-Path $root $app
  if (-not (Test-Path $dir)) { Write-Output "SKIP: $app folder missing"; continue }
  Push-Location $dir
  try {
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed in $app" }
    Write-Output "$app: OK"
  } finally { Pop-Location }
}

# 3. Environment file (secrets live here, never committed)
Step "Environment file"
$envFile = Join-Path $root "server\.env"
$envExample = Join-Path $root "server\.env.example"
if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Output "Created server\.env from the example — OPEN IT and set ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET, JWT_SECRET."
  } else {
    Write-Output "WARNING: no .env.example found; create server\.env manually (see README Quick start)."
  }
} else {
  Write-Output "server\.env already exists — left untouched."
}

Write-Output ""
Write-Output "Done. Next:"
Write-Output "  1. Edit server\.env (admin credentials + secrets)"
Write-Output "  2. Run .\start.ps1"
Write-Output "  3. Open http://localhost:5174 -> Setup wizard (company -> manual -> checklist)"
