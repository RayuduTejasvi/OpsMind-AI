# Phase 1: Authentication & Authorization — Implementation Complete ✅

## Status
**All Phase 1 components are fully implemented and ready to test.**

---

## What's Implemented

### 1. User Model [src/models/User.js](src/models/User.js)
```javascript
- email: String (unique, lowercase, indexed)
- passwordHash: String (bcrypt hashed)
- role: Enum ['employee', 'admin']
- planTier: Enum ['free', 'pro']
- queryCountToday: Number (for rate limiting)
- queryResetAt: Date (daily reset)
- chatHistory: Array of sessions with messages + citations
- timestamps: createdAt, updatedAt
```

### 2. Auth Service [src/services/auth.service.js](src/services/auth.service.js)

#### `registerUser({ email, password, role })`
- Validates email and password (min 8 chars)
- Checks if email already exists (409 error if yes)
- Hashes password with bcrypt
- Creates user document in MongoDB
- Returns: `{ user, accessToken, refreshToken }`

#### `loginUser({ email, password })`
- Finds user by normalized email
- Verifies password hash against input
- Returns JWT access token (24h expiry) + refresh token (30d expiry)
- Returns: `{ user, accessToken, refreshToken }`

#### `refreshAccessToken(refreshToken)`
- Verifies refresh token signature
- Issues new access token without new refresh token
- Returns: `{ accessToken, user }`

#### `toPublicUser(user)`
- Sanitizes user object (removes sensitive fields)
- Returns: `{ id, email, role, planTier }`

### 3. Auth Routes [src/routes/auth.routes.js](src/routes/auth.routes.js)

| Method | Route | Auth Required | Response |
|--------|-------|---|---|
| POST | `/api/auth/register` | No | `{ user, accessToken, refreshToken }` |
| POST | `/api/auth/login` | No | `{ user, accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | No | `{ user, accessToken }` |
| GET | `/api/auth/me` | **Yes** | `{ user: { id, email, role, planTier } }` |

### 4. Auth Middleware [src/middleware/auth.middleware.js](src/middleware/auth.middleware.js)

#### `requireAuth`
- Extracts JWT from `Authorization: Bearer <token>` header
- Verifies signature using `JWT_SECRET`
- Loads user from MongoDB using token's `sub` (user ID)
- Attaches `request.user` for downstream handlers
- Returns 401 if token missing or invalid

#### `requireAdmin`
- Checks `request.user.role === 'admin'`
- Returns 403 if user is not admin
- Used on `/api/admin/*` routes

---

## Configuration

### Environment Variables (in `.env`)
```
JWT_SECRET=local-dev-jwt-secret-change-me
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-me
MONGO_URI=mongodb://127.0.0.1:27017/opsmind
```

### Access Token Expiry
- Expires in: **24 hours**
- Algorithm: **HS256**
- Payload: `{ sub: userId, role: userRole }`

### Refresh Token Expiry
- Expires in: **30 days**
- Algorithm: **HS256**
- Payload: `{ sub: userId }`

---

## How to Test Phase 1

### Prerequisites
1. **MongoDB must be running** on `localhost:27017`
   - Local: `mongod`
   - Or Docker: `docker run -d -p 27017:27017 mongo:7`

2. **Backend must be restarted** (to reload .env)
   - Stop current `npm run dev`
   - Run `npm run dev` again

3. **Frontend must be running** on `localhost:5173`
   - Already running from Phase 0

---

### Test Workflow

#### Step 1: Register Admin User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "testpass123",
    "role": "admin"
  }'
```

**Expected Response (201):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@test.com",
    "role": "admin",
    "planTier": "free"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Step 2: Register Employee User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@test.com",
    "password": "testpass123",
    "role": "employee"
  }'
```

#### Step 3: Login (Get New Tokens)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "testpass123"
  }'
```

**Expected Response (200):**
```json
{
  "user": { "id": "...", "email": "admin@test.com", "role": "admin", "planTier": "free" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

#### Step 4: Get Current User (Requires Auth)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

**Expected Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@test.com",
    "role": "admin",
    "planTier": "free"
  }
}
```

#### Step 5: Refresh Token (Get New Access Token)
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'
```

**Expected Response (200):**
```json
{
  "user": { "id": "...", "email": "admin@test.com", "role": "admin", "planTier": "free" },
  "accessToken": "..."
}
```

---

## Error Cases (Test These!)

### Invalid Email/Password
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bad",
    "password": "short"
  }'
```
**Expected: 400** — "Email and password (min 8 chars) are required"

### Duplicate Email
```bash
# Register same email twice
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "testpass123"
  }'
```
**Expected: 409** — "Email already registered"

### Wrong Password
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "wrongpassword"
  }'
```
**Expected: 401** — "Invalid credentials"

### Missing Auth Header
```bash
curl -X GET http://localhost:5000/api/auth/me
```
**Expected: 401** — "Unauthorized"

### Invalid Token
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer invalid.token.here"
```
**Expected: 401** — "Unauthorized"

---

## Frontend Integration

The React app in [frontend/src/App.jsx](frontend/src/App.jsx) already has:

✅ **Login form** — email + password  
✅ **Register form** — email + password + role selector  
✅ **Auth state management** — localStorage persistence  
✅ **API integration** — calls `/api/auth/register`, `/api/auth/login`  
✅ **Token storage** — saves accessToken & refreshToken  
✅ **Auth header** — sends `Authorization: Bearer <token>` on protected requests  

**You can test the full flow in the browser:**
1. Open `http://localhost:5173`
2. Register with email/password
3. Login
4. See greeting: `"Logged in as admin@test.com (admin, free)"`

---

## Files Modified/Created

| File | Status | Changes |
|---|---|---|
| [src/models/User.js](src/models/User.js) | ✅ Ready | Complete schema with chat history |
| [src/services/auth.service.js](src/services/auth.service.js) | ✅ Ready | All auth logic (register, login, refresh) |
| [src/routes/auth.routes.js](src/routes/auth.routes.js) | ✅ Ready | All 4 endpoints |
| [src/middleware/auth.middleware.js](src/middleware/auth.middleware.js) | ✅ Ready | requireAuth, requireAdmin |
| [src/app.js](src/app.js) | ✅ Ready | Routes already imported |
| `.env` | ✅ Ready | JWT secrets, MONGO_URI configured |

---

## Phase 1 Completion Checklist

- [x] User schema with all required fields
- [x] Password hashing with bcrypt
- [x] JWT access + refresh token generation
- [x] Register endpoint (POST /api/auth/register)
- [x] Login endpoint (POST /api/auth/login)
- [x] Refresh token endpoint (POST /api/auth/refresh)
- [x] Current user endpoint (GET /api/auth/me)
- [x] Auth middleware (requireAuth, requireAdmin)
- [x] Error handling (409, 401, 403, 400)
- [x] .env configuration
- [x] Frontend integration ready

---

## Next Steps: Phase 2 (PDF Ingestion)

Phase 2 will build the knowledge ingestion pipeline:
- PDF upload via Multer
- PDF text extraction
- Text chunking (1000 chars + 100 overlap)
- Real embedding generation (Gemini API)
- Storage in MongoDB with metadata

Ready to proceed? 🚀
