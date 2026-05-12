# Phase 1 Quick Start — MongoDB Setup & Testing

## Step 1: Ensure MongoDB is Running

### Option A: Local MongoDB (if installed)
```powershell
mongod
# MongoDB should start on port 27017
```

### Option B: Use Docker
```powershell
docker pull mongo:7
docker run -d -p 27017:27017 --name opsmind-mongo mongo:7

# Verify it's running
docker ps | findstr opsmind-mongo
```

### Option C: Use MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/opsmind`
4. Update `.env`:
   ```
   MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/opsmind?retryWrites=true&w=majority
   ```

---

## Step 2: Restart Backend (to load .env)

If backend is still running from Phase 0:
1. Press `Ctrl+C` in the backend terminal
2. Run: `npm run dev`

**Expected Output:**
```
OpsMind AI API running on port 5000
```

If you see any MongoDB connection errors, ensure MongoDB is running on the URI in `.env`.

---

## Step 3: Test Authentication Endpoints

Use the test commands below. Save as `auth-tests.ps1` and run:

```powershell
# Test 1: Register Admin
Write-Host "=== Test 1: Register Admin ===" -ForegroundColor Green
$registerResponse = curl -s -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@test.com",
    "password": "testpass123",
    "role": "admin"
  }' | ConvertFrom-Json

$adminToken = $registerResponse.accessToken
$adminRefresh = $registerResponse.refreshToken

Write-Host "Admin registered. Access Token (first 50 chars): $($adminToken.Substring(0, 50))..."
Write-Host ""

# Test 2: Register Employee
Write-Host "=== Test 2: Register Employee ===" -ForegroundColor Green
$empResponse = curl -s -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "employee@test.com",
    "password": "testpass123",
    "role": "employee"
  }' | ConvertFrom-Json

Write-Host "Employee registered: $($empResponse.user.email)"
Write-Host ""

# Test 3: Login
Write-Host "=== Test 3: Login ===" -ForegroundColor Green
$loginResponse = curl -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@test.com",
    "password": "testpass123"
  }' | ConvertFrom-Json

Write-Host "Login successful. User: $($loginResponse.user.email) | Role: $($loginResponse.user.role)"
Write-Host ""

# Test 4: Get Me (requires auth)
Write-Host "=== Test 4: Get Current User (Protected) ===" -ForegroundColor Green
$meResponse = curl -s -X GET http://localhost:5000/api/auth/me `
  -H "Authorization: Bearer $adminToken" | ConvertFrom-Json

Write-Host "Current user: $($meResponse.user.email) | Plan: $($meResponse.user.planTier)"
Write-Host ""

# Test 5: Refresh Token
Write-Host "=== Test 5: Refresh Token ===" -ForegroundColor Green
$refreshResponse = curl -s -X POST http://localhost:5000/api/auth/refresh `
  -H "Content-Type: application/json" `
  -d "{`"refreshToken`": `"$adminRefresh`"}" | ConvertFrom-Json

Write-Host "New access token issued (first 50 chars): $($refreshResponse.accessToken.Substring(0, 50))..."
Write-Host ""

# Test 6: Error Cases
Write-Host "=== Test 6: Error Cases ===" -ForegroundColor Yellow

# Duplicate email
Write-Host "Testing duplicate email registration..."
$dupResponse = curl -s -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@test.com",
    "password": "testpass123"
  }' | ConvertFrom-Json

Write-Host "Expected 409 error: $($dupResponse.message)"

# Wrong password
Write-Host "Testing wrong password..."
$wrongResponse = curl -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@test.com",
    "password": "wrongpassword"
  }' | ConvertFrom-Json

Write-Host "Expected 401 error: $($wrongResponse.message)"

# Missing auth header
Write-Host "Testing missing auth header..."
$noAuthResponse = curl -s -X GET http://localhost:5000/api/auth/me | ConvertFrom-Json
Write-Host "Expected 401 error: $($noAuthResponse.message)"

Write-Host ""
Write-Host "=== All Tests Complete ===" -ForegroundColor Green
```

**Save as:** `auth-tests.ps1` in project root  
**Run:** `./auth-tests.ps1`

---

## Step 4: Test in Browser

1. Open `http://localhost:5173`
2. You should see **OpsMind AI Login Screen**
3. Click on "Register" tab
4. Enter:
   - Email: `testuser@test.com`
   - Password: `testpass123`
   - Role: `employee`
5. Click "Register"
6. Should see: `"Logged in as testuser@test.com (employee, free)"`
7. Click "Logout" and then "Login" with the same credentials
8. Should be able to login successfully

---

## Troubleshooting

### Error: "MONGO_URI is not set"
- Backend didn't reload .env after Phase 0
- **Fix:** Restart backend with `npm run dev`

### Error: "connect ECONNREFUSED"
- MongoDB isn't running on the URI specified in `.env`
- **Fix:** Start MongoDB with `mongod` or Docker command above

### Error: "Invalid credentials"
- Email or password was wrong
- **Fix:** Check .env has correct email/password test values

### Frontend shows "Authentication failed"
- Backend isn't running or network error
- **Fix:** Ensure backend is on `http://localhost:5000` and test `/health` endpoint

---

## Success Criteria ✅

After Phase 1:
- [ ] `npm run dev` starts without errors
- [ ] `/health` endpoint returns `{ "status": "ok" }`
- [ ] Can register user with email, password, role
- [ ] Can login and get accessToken
- [ ] Can call `/api/auth/me` with Bearer token
- [ ] Can refresh token
- [ ] Frontend shows login/register forms
- [ ] Frontend shows user greeting after login

---

**Phase 1 is complete! Ready for Phase 2 (PDF Ingestion)?** 🚀
