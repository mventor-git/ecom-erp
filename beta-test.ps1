# Beta Test Script for Comfort-Sign ERP Platform
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMFORT-SIGN BETA TEST" -ForegroundColor Cyan
Write-Host "  mventor-ticket-024-Beta-Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# ============================================
# TEST 1: Backend Server
# ============================================
Write-Host "[1/6] Starting Backend Server..." -ForegroundColor Yellow
Set-Location "D:\Projects\On-Dev\comfort-sign\server"
Start-Process -FilePath "node" -ArgumentList "index.js" -WindowStyle Hidden
Start-Sleep -Seconds 4

# Test health check
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5172/api/health" -Method GET -TimeoutSec 5
    Write-Host "  [PASS] Health check: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Health check: $_" -ForegroundColor Red
}

# ============================================
# TEST 2: Automated Tests
# ============================================
Write-Host ""
Write-Host "[2/6] Running Automated Tests..." -ForegroundColor Yellow

# Unit tests
$unitResult = & npm test 2>&1
$unitPass = $unitResult -match "28 passed"
if ($unitPass) {
    Write-Host "  [PASS] Unit tests: 28/28 passed" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Unit tests failed" -ForegroundColor Red
}

# Integration tests
$intResult = & npm run test:integration 2>&1
$intPass = $intResult -match "21 passed"
if ($intPass) {
    Write-Host "  [PASS] Integration tests: 21/21 passed" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Integration tests failed" -ForegroundColor Red
}

# ============================================
# TEST 3: Database Integrity
# ============================================
Write-Host ""
Write-Host "[3/6] Checking Database Integrity..." -ForegroundColor Yellow

$dbCheck = @"
const db = require('./db');
db.initPromise.then(() => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  const brands = db.prepare('SELECT COUNT(*) as count FROM brands').get();
  const warehouses = db.prepare('SELECT COUNT(*) as count FROM warehouses').get();
  const inventory = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
  const movements = db.prepare('SELECT COUNT(*) as count FROM inventory_movements').get();
  const events = db.prepare('SELECT COUNT(*) as count FROM events').get();
  const roles = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  const permissions = db.prepare('SELECT COUNT(*) as count FROM permissions').get();
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  console.log(JSON.stringify({
    tables: tables.map(t => t.name),
    products: products.count,
    categories: categories.count,
    brands: brands.count,
    warehouses: warehouses.count,
    inventory: inventory.count,
    movements: movements.count,
    events: events.count,
    roles: roles.count,
    permissions: permissions.count,
    users: users.count
  }));
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
"@

$dbCheck | Out-File -FilePath "D:\Projects\On-Dev\comfort-sign\server\temp-db-check.js" -Encoding UTF8
$dbResult = & node "D:\Projects\On-Dev\comfort-sign\server\temp-db-check.js" 2>&1
Remove-Item "D:\Projects\On-Dev\comfort-sign\server\temp-db-check.js" -Force -ErrorAction SilentlyContinue

try {
    $dbData = $dbResult | Select-String -Pattern "^\{" | ForEach-Object { $_.Line } | ConvertFrom-Json
    
    # Check tables
    $expectedTables = @('brands', 'categories', 'customers', 'events', 'inventory', 'inventory_movements', 'locations', 'orders', 'permissions', 'product_images', 'product_variants', 'products', 'role_permissions', 'roles', 'sessions', 'users', 'warehouses')
    $missingTables = $expectedTables | Where-Object { $_ -notin $dbData.tables }
    
    if ($missingTables.Count -eq 0) {
        Write-Host "  [PASS] All ERP tables exist ($($dbData.tables.Count) tables)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Missing tables: $($missingTables -join ', ')" -ForegroundColor Red
    }
    
    # Check data counts
    if ($dbData.products -eq 51) {
        Write-Host "  [PASS] Products: $($dbData.products)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Products: $($dbData.products) (expected 51)" -ForegroundColor Red
    }
    
    if ($dbData.categories -eq 6) {
        Write-Host "  [PASS] Categories: $($dbData.categories)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Categories: $($dbData.categories) (expected 6)" -ForegroundColor Red
    }
    
    if ($dbData.warehouses -ge 1) {
        Write-Host "  [PASS] Warehouses: $($dbData.warehouses)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Warehouses: $($dbData.warehouses) (expected >= 1)" -ForegroundColor Red
    }
    
    if ($dbData.inventory -ge 1) {
        Write-Host "  [PASS] Inventory records: $($dbData.inventory)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Inventory records: $($dbData.inventory) (expected >= 1)" -ForegroundColor Red
    }
    
    if ($dbData.movements -ge 1) {
        Write-Host "  [PASS] Inventory movements: $($dbData.movements)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Inventory movements: $($dbData.movements) (expected >= 1)" -ForegroundColor Red
    }
    
    if ($dbData.events -ge 1) {
        Write-Host "  [PASS] Events: $($dbData.events)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Events: $($dbData.events) (expected >= 1)" -ForegroundColor Red
    }
    
    if ($dbData.roles -eq 6) {
        Write-Host "  [PASS] Roles: $($dbData.roles)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Roles: $($dbData.roles) (expected 6)" -ForegroundColor Red
    }
    
    if ($dbData.permissions -eq 26) {
        Write-Host "  [PASS] Permissions: $($dbData.permissions)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Permissions: $($dbData.permissions) (expected 26)" -ForegroundColor Red
    }
    
    if ($dbData.users -ge 1) {
        Write-Host "  [PASS] Users: $($dbData.users)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Users: $($dbData.users) (expected >= 1)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "  [FAIL] Database check failed: $_" -ForegroundColor Red
}

# ============================================
# TEST 4: Backend API Endpoints
# ============================================
Write-Host ""
Write-Host "[4/6] Testing Backend API Endpoints..." -ForegroundColor Yellow

# Test products API
try {
    $products = Invoke-RestMethod -Uri "http://localhost:5172/api/products" -Method GET -TimeoutSec 5
    if ($products.Count -eq 51) {
        Write-Host "  [PASS] GET /api/products: $($products.Count) products" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/products: $($products.Count) products (expected 51)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] GET /api/products: $_" -ForegroundColor Red
}

# Test categories API
try {
    $categories = Invoke-RestMethod -Uri "http://localhost:5172/api/products/categories/list" -Method GET -TimeoutSec 5
    if ($categories.Count -eq 6) {
        Write-Host "  [PASS] GET /api/products/categories/list: $($categories.Count) categories" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/products/categories/list: $($categories.Count) categories (expected 6)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] GET /api/products/categories/list: $_" -ForegroundColor Red
}

# Test brands API
try {
    $brands = Invoke-RestMethod -Uri "http://localhost:5172/api/products/brands/list" -Method GET -TimeoutSec 5
    Write-Host "  [PASS] GET /api/products/brands/list: $($brands.Count) brands" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] GET /api/products/brands/list: $_" -ForegroundColor Red
}

# Test admin login
try {
    $loginBody = @{ username = "configingtheworld@gmail.com"; password = "admin123" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/login" -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 5 -SessionVariable session
    if ($loginResponse.success) {
        Write-Host "  [PASS] POST /api/admin/login: Success" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] POST /api/admin/login: Failed" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] POST /api/admin/login: $_" -ForegroundColor Red
}

# Test admin products (authenticated)
try {
    $adminProducts = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/products" -Method GET -WebSession $session -TimeoutSec 5
    if ($adminProducts.Count -eq 51) {
        Write-Host "  [PASS] GET /api/admin/products: $($adminProducts.Count) products" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/admin/products: $($adminProducts.Count) products (expected 51)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] GET /api/admin/products: $_" -ForegroundColor Red
}

# Test events API (authenticated)
try {
    $events = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/events" -Method GET -WebSession $session -TimeoutSec 5
    Write-Host "  [PASS] GET /api/admin/events: $($events.Count) events" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] GET /api/admin/events: $_" -ForegroundColor Red
}

# Test users API (authenticated)
try {
    $users = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/users" -Method GET -WebSession $session -TimeoutSec 5
    Write-Host "  [PASS] GET /api/admin/users: $($users.Count) users" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] GET /api/admin/users: $_" -ForegroundColor Red
}

# Test roles API (authenticated)
try {
    $roles = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/users/roles/list" -Method GET -WebSession $session -TimeoutSec 5
    if ($roles.Count -eq 6) {
        Write-Host "  [PASS] GET /api/admin/users/roles/list: $($roles.Count) roles" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/admin/users/roles/list: $($roles.Count) roles (expected 6)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] GET /api/admin/users/roles/list: $_" -ForegroundColor Red
}

# Test permissions API (authenticated)
try {
    $permissions = Invoke-RestMethod -Uri "http://localhost:5172/api/admin/users/permissions/list" -Method GET -WebSession $session -TimeoutSec 5
    if ($permissions.Count -eq 26) {
        Write-Host "  [PASS] GET /api/admin/users/permissions/list: $($permissions.Count) permissions" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/admin/users/permissions/list: $($permissions.Count) permissions (expected 26)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] GET /api/admin/users/permissions/list: $_" -ForegroundColor Red
}

# ============================================
# TEST 5: Customer Frontend
# ============================================
Write-Host ""
Write-Host "[5/6] Testing Customer Frontend..." -ForegroundColor Yellow

Set-Location "D:\Projects\On-Dev\comfort-sign\client"
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WindowStyle Hidden
Start-Sleep -Seconds 5

try {
    $customerResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($customerResponse.StatusCode -eq 200) {
        Write-Host "  [PASS] Customer frontend (port 5173): Running" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Customer frontend (port 5173): Status $($customerResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Customer frontend (port 5173): $_" -ForegroundColor Red
}

# ============================================
# TEST 6: Admin Frontend
# ============================================
Write-Host ""
Write-Host "[6/6] Testing Admin Frontend..." -ForegroundColor Yellow

Set-Location "D:\Projects\On-Dev\comfort-sign\client-admin"
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WindowStyle Hidden
Start-Sleep -Seconds 5

try {
    $adminResponse = Invoke-WebRequest -Uri "http://localhost:5174" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($adminResponse.StatusCode -eq 200) {
        Write-Host "  [PASS] Admin frontend (port 5174): Running" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Admin frontend (port 5174): Status $($adminResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Admin frontend (port 5174): $_" -ForegroundColor Red
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BETA TEST COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All systems tested. Check results above." -ForegroundColor White
Write-Host ""

# Keep window open
Read-Host "Press Enter to exit"
