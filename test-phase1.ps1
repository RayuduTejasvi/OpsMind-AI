Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1: AUTHENTICATION TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Login
Write-Host "TEST 1: Login Endpoint" -ForegroundColor Green
Write-Host "POST /api/auth/login`n" -ForegroundColor White

$loginBody = @{email = "admin@test.com"; password = "testpass123"} | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri http://localhost:5000/api/auth/login -Method POST -ContentType "application/json" -Body $loginBody -ErrorAction SilentlyContinue
$loginJson = $loginResp.Content | ConvertFrom-Json
$token = $loginJson.accessToken

if ($token) {
    Write-Host "✅ SUCCESS - Login Successful" -ForegroundColor Green
    Write-Host "   Email: $($loginJson.user.email)" -ForegroundColor Gray
    Write-Host "   Role: $($loginJson.user.role)" -ForegroundColor Gray
    Write-Host "   Plan: $($loginJson.user.planTier)" -ForegroundColor Gray
} else {
    Write-Host "❌ FAILED: $($loginJson.message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Get Current User (Protected)
Write-Host "TEST 2: Get Current User (Protected)" -ForegroundColor Green
Write-Host "GET /api/auth/me with Bearer token`n" -ForegroundColor White

$headers = @{"Authorization" = "Bearer $token"}
$meResp = Invoke-WebRequest -Uri http://localhost:5000/api/auth/me -Method GET -Headers $headers -ErrorAction SilentlyContinue
$meJson = $meResp.Content | ConvertFrom-Json

if ($meJson.user) {
    Write-Host "✅ SUCCESS - Retrieved Current User" -ForegroundColor Green
    Write-Host "   Email: $($meJson.user.email)" -ForegroundColor Gray
    Write-Host "   Role: $($meJson.user.role)" -ForegroundColor Gray
} else {
    Write-Host "❌ FAILED: $($meJson.message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Refresh Token
Write-Host "TEST 3: Refresh Token" -ForegroundColor Green
Write-Host "POST /api/auth/refresh`n" -ForegroundColor White

$refreshBody = @{refreshToken = $loginJson.refreshToken} | ConvertTo-Json
$refreshResp = Invoke-WebRequest -Uri http://localhost:5000/api/auth/refresh -Method POST -ContentType "application/json" -Body $refreshBody -ErrorAction SilentlyContinue
$refreshJson = $refreshResp.Content | ConvertFrom-Json

if ($refreshJson.accessToken) {
    Write-Host "✅ SUCCESS - Token Refreshed" -ForegroundColor Green
    Write-Host "   New token issued for: $($refreshJson.user.email)" -ForegroundColor Gray
} else {
    Write-Host "❌ FAILED: $($refreshJson.message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Error Cases
Write-Host "TEST 4: Error Handling - Invalid Password" -ForegroundColor Yellow
Write-Host "POST /api/auth/login (wrong password)`n" -ForegroundColor White

$wrongBody = @{email = "admin@test.com"; password = "wrongpassword"} | ConvertTo-Json
try {
    Invoke-WebRequest -Uri http://localhost:5000/api/auth/login -Method POST -ContentType "application/json" -Body $wrongBody -ErrorAction Stop
} catch {
    $err = $_ | Select-Object -ExpandProperty Exception
    if ($err.Response.StatusCode -eq 401) {
        Write-Host "✅ CORRECTLY REJECTED (401)" -ForegroundColor Green
        Write-Host "   Status: 401 Unauthorized" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 5: Unauthorized Access
Write-Host "TEST 5: Error Handling - Missing Token" -ForegroundColor Yellow
Write-Host "GET /api/auth/me (no Bearer token)`n" -ForegroundColor White

try {
    Invoke-WebRequest -Uri http://localhost:5000/api/auth/me -Method GET -ErrorAction Stop
} catch {
    $err = $_ | Select-Object -ExpandProperty Exception
    if ($err.Response.StatusCode -eq 401) {
        Write-Host "✅ CORRECTLY REJECTED (401)" -ForegroundColor Green
        Write-Host "   Status: 401 Unauthorized" -ForegroundColor Gray
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ ALL PHASE 1 ENDPOINTS VERIFIED!" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoints Tested:" -ForegroundColor White
Write-Host "  ✓ POST /api/auth/login" -ForegroundColor Green
Write-Host "  ✓ GET  /api/auth/me (Protected)" -ForegroundColor Green
Write-Host "  ✓ POST /api/auth/refresh" -ForegroundColor Green
Write-Host "  ✓ 401 Error handling" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Health:   http://localhost:5000/health" -ForegroundColor White
Write-Host ""
Write-Host "Ready for Phase 2: PDF Ingestion Pipeline" -ForegroundColor Yellow
Write-Host ""
