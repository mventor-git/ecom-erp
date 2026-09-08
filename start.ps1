# Ecom-ERP launcher — replaces deleted start.py / start.exe control center.
# Starts all 3 services detached (hidden windows), logs to logs/.
# Usage: right-click > Run with PowerShell, or: powershell -NoProfile -ExecutionPolicy Bypass -File start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null

$services = @(
    @{ Name = "backend";    Dir = "server";        Exe = "node";     Args = "index.js"; Port = 5172 },
    @{ Name = "client";     Dir = "client";        Exe = "npm.cmd";  Args = "run dev";  Port = 5173 },
    @{ Name = "admin";      Dir = "client-admin";  Exe = "npm.cmd";  Args = "run dev";  Port = 5174 }
)

foreach ($svc in $services) {
    # Skip services whose port is already listening (idempotent restarts)
    if (Get-NetTCPConnection -LocalPort $svc.Port -State Listen -ErrorAction SilentlyContinue) {
        Write-Output ("{0}: already running on :{1}" -f $svc.Name, $svc.Port)
        continue
    }
    $dir = Join-Path $root $svc.Dir
    $out = Join-Path $logs ("{0}.log" -f $svc.Name)
    $err = Join-Path $logs ("{0}.err.log" -f $svc.Name)
    Start-Process -FilePath $svc.Exe -ArgumentList $svc.Args -WorkingDirectory $dir `
                  -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
    Write-Output ("launched {0}" -f $svc.Name)
}

Write-Output "Backend :5172 | Storefront :5173 | Admin Panel :5174"
