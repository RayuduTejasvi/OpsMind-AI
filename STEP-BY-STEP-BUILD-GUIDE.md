# OpsMind AI — Complete Step-by-Step Build Guide

**Status:** Building a production-grade Retrieval Augmented Generation (RAG) system for enterprise SOP queries.

**Current State:** Scaffolding complete with routes, models, and placeholder services. Main gaps are real embeddings, vector search, grounded LLM integration, and frontend polish.

---

## Phase 0: Environment & Prerequisites

### Step 0.1: Create `.env` File
**Location:** `c:\Users\PREETIMOHAN\Desktop\OpsMind-AI\.env`

**What to Add:**
```env
# MongoDB Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/opsmind?retryWrites=true&w=majority

# LLM & Embeddings
GEMINI_API_KEY=your-google-ai-studio-api-key
EMBEDDING_MODEL=text-embedding-004
LLM_MODEL=gemini-1.5-flash

# Fallback LLM (optional)
GROQ_API_KEY=your-groq-api-key

# JWT Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Server Config
PORT=5000
NODE_ENV=development

# Upload Config
MAX_FILE_SIZE_MB=50
UPLOAD_DIR=uploads

# Free Tier Limits
FREE_TIER_DAILY_LIMIT=20

# Feature Flags
USE_ATLAS_VECTOR_SEARCH=false  # Set to true when MongoDB Atlas Vector Search is enabled
```

**Why:** The backend and frontend depend on these variables for database connectivity, LLM calls, authentication, and feature toggles.

---

### Step 0.2: Verify Backend Boots
**Command:**
```bash
npm install
npm run dev
```

**Expected Output:**
```
OpsMind AI API running on port 5000
```

**Check:** Navigate to `http://localhost:5000/health` → you should see `{ "status": "ok" }`.

**Files Involved:**
- [src/server.js](src/server.js) - entry point
- [src/app.js](src/app.js) - Express app factory
- [src/config/database.js](src/config/database.js) - MongoDB connection

**What to Verify:**
- MongoDB is reachable and the connection string is valid
- No errors on startup
- `/health` endpoint responds

---

### Step 0.3: Install Frontend Dependencies
**Command:**
```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

**Expected Output:**
```
  VITE v5.4.12  ready in 512 ms

  ➜  Local:   http://localhost:5173/
```

**Check:** Open `http://localhost:5173` → you should see the OpsMind AI login screen with email/password fields and role selector.

**Files Involved:**
- [frontend/package.json](frontend/package.json)
- [frontend/src/main.jsx](frontend/src/main.jsx)
- [frontend/src/App.jsx](frontend/src/App.jsx)

**What to Verify:**
- React app loads without JS errors
- Auth UI renders
- Browser DevTools shows no CORS or fetch failures (expected, backend is separate)

---

## Phase 1: Authentication & Authorization

### Step 1.1: Implement Auth Routes (Backend)
**File:** [src/routes/auth.routes.js](src/routes/auth.routes.js)

**What Needs to Happen:**
- `POST /api/auth/register` → creates a new user with role (employee/admin)
- `POST /api/auth/login` → validates credentials and returns JWT + user
- `POST /api/auth/refresh` → uses refresh token to issue new access token
- `GET /api/auth/me` → returns current user profile

**Current State:** Routes are imported but the service layer is incomplete.

**What to Change:**
1. Create [src/services/auth.service.js](src/services/auth.service.js) with:
   - `registerUser(email, password, role)` → hash password, create user record
   - `loginUser(email, password)` → verify password, return JWT + refresh token
   - `refreshAccessToken(refreshToken)` → validate refresh token, issue new access token

2. Update [src/routes/auth.routes.js](src/routes/auth.routes.js) to call auth service:
   ```javascript
   import { registerUser, loginUser, refreshAccessToken } from '../services/auth.service.js';
   import { createHash } from 'crypto';

   authRouter.post('/register', async (request, response, next) => {
     try {
       const { email, password, role } = request.body;
       const user = await registerUser(email, password, role);
       response.status(201).json({
         message: 'User registered successfully',
         user: { id: user._id, email: user.email, role: user.role },
       });
     } catch (error) {
       next(error);
     }
   });

   authRouter.post('/login', async (request, response, next) => {
     try {
       const { email, password } = request.body;
       const { user, accessToken, refreshToken } = await loginUser(email, password);
       response.json({
         user: { id: user._id, email: user.email, role: user.role, planTier: user.planTier },
         accessToken,
         refreshToken,
       });
     } catch (error) {
       next(error);
     }
   });
   ```

3. Update [src/models/User.js](src/models/User.js) schema:
   ```javascript
   import mongoose from 'mongoose';

   const chatSessionSchema = new mongoose.Schema({
     sessionId: { type: String, required: true },
     messages: [{
       role: { type: String, enum: ['user', 'assistant'], required: true },
       content: { type: String, required: true },
       citations: [Object],
       timestamp: { type: Date, default: Date.now },
     }],
   }, { _id: false });

   const userSchema = new mongoose.Schema({
     email: { type: String, required: true, unique: true },
     passwordHash: { type: String, required: true },
     role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
     planTier: { type: String, enum: ['free', 'pro'], default: 'free' },
     queryCountToday: { type: Number, default: 0 },
     queryResetAt: { type: Date },
     chatHistory: { type: [chatSessionSchema], default: [] },
     createdAt: { type: Date, default: Date.now },
   });

   export const User = mongoose.model('User', userSchema);
   ```

**Verification:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"testpass123","role":"admin"}'

# Expected: 201 with user object

curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"testpass123"}'

# Expected: 200 with accessToken and refreshToken
```

---

### Step 1.2: Implement Auth Middleware
**File:** [src/middleware/auth.middleware.js](src/middleware/auth.middleware.js)

**What Needs to Happen:**
- `requireAuth` middleware → checks for valid JWT in Authorization header
- `requireAdmin` middleware → checks that authenticated user has admin role

**Current State:** Empty or incomplete.

**What to Change:**
```javascript
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function requireAuth(request, response, next) {
  try {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : '';

    if (!token) {
      const error = new Error('Missing or invalid Authorization header');
      error.statusCode = 401;
      throw error;
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    request.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      error.statusCode = 401;
    }
    next(error);
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }
  next();
}
```

**Verification:**
- Access a protected route without token → 401
- Access with invalid token → 401
- Access admin route as employee → 403
- Access admin route as admin → success

---

## Phase 2: PDF Ingestion Pipeline

### Step 2.1: Complete PDF Parser Service
**File:** [src/services/pdfParser.service.js](src/services/pdfParser.service.js)

**Current State:**
```javascript
export async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return { text: parsed.text || '', pageCount: parsed.numpages || 0 };
}
```

**What to Change:**
- Add page-by-page tracking so we know which chunk came from which page
- Add section detection (e.g., "## Section Title" or "1.2 Heading")

**Updated Implementation:**
```javascript
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function extractPdfText(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);

    // Extract text with page markers
    const textWithPages = parsed.text || '';
    const pages = textWithPages.split(/\f/); // PDF form feed char separates pages

    return {
      text: textWithPages,
      pageCount: parsed.numpages || pages.length || 1,
      pages: pages.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText.trim(),
      })),
    };
  } catch (error) {
    const e = new Error(`Failed to parse PDF: ${error.message}`);
    e.statusCode = 400;
    throw e;
  }
}
```

**Verification:**
```bash
node -e "
import { extractPdfText } from './src/services/pdfParser.service.js';
const result = await extractPdfText('./sample.pdf');
console.log(result);
"
```

---

### Step 2.2: Complete Text Chunking Service
**File:** [src/services/chunker.service.js](src/services/chunker.service.js)

**Current State:** Already implemented correctly:
```javascript
export function chunkText(text, chunkSize = 1000, overlap = 100) {
  // Splits text into ~1000 char chunks with 100 char overlap
  // Respects sentence boundaries
}
```

**What to Verify:**
- Chunks are ~1000 characters
- Overlap is 100 characters to preserve context
- Chunks don't break mid-sentence when possible

**Test:**
```bash
npm run ingest  # Runs scripts/test-ingestion.js
```

**Expected Output:**
```json
{
  "chunkCount": 15,
  "chunks": [
    {
      "chunkIndex": 0,
      "text": "Sample SOP text...",
      "charStart": 0,
      "charEnd": 1000
    },
    ...
  ]
}
```

---

### Step 2.3: Implement Real Embedding Service
**File:** [src/services/embedding.service.js](src/services/embedding.service.js)

**Current State:** Uses deterministic hashing (placeholder):
```javascript
export async function generateEmbedding(text) {
  // Returns a 1536-dimensional vector via hash-based approach
  // Good for testing but not production
}
```

**What to Change:**
Replace the hash-based embedding with a real call to Google's Gemini Embedding API or OpenAI's text-embedding-ada-002.

**Updated Implementation (Using Gemini):**
```javascript
import fetch from 'node-fetch';

const CACHE = new Map();

async function callGeminiEmbeddingAPI(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-004';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Embedding API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Check cache to avoid duplicate API calls
  if (CACHE.has(text)) {
    return CACHE.get(text);
  }

  try {
    const embedding = await callGeminiEmbeddingAPI(text);
    CACHE.set(text, embedding);
    return embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw error;
  }
}
```

**Alternative (OpenAI):**
```javascript
import fetch from 'node-fetch';

export async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}
```

**Verification:**
```bash
node -e "
import { generateEmbedding } from './src/services/embedding.service.js';
const vec = await generateEmbedding('Sample SOP text');
console.log('Embedding dimension:', vec.length);
console.log('First 5 values:', vec.slice(0, 5));
"
```

**Expected Output:**
```
Embedding dimension: 768  (or 1536 for ada-002)
First 5 values: [-0.023, 0.145, -0.067, 0.234, -0.089]
```

---

### Step 2.4: Update Ingestion Service to Use Real Embeddings
**File:** [src/services/ingestion.service.js](src/services/ingestion.service.js)

**Current State:** Already calls `generateEmbedding()` but uses placeholder:
```javascript
const vector = await generateEmbedding(chunk.text);
```

**What to Change:**
After Step 2.3, this should automatically use real embeddings. Just verify:
1. Each chunk gets embedded with the real model
2. Embeddings are stored with metadata (page, section, filename)
3. Processing status updates correctly

**Test Upload:**
```bash
curl -X POST http://localhost:5000/api/admin/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "files=@sample.pdf"

# Expected: 201 with document indexed and chunk count
```

**Verification in MongoDB:**
```javascript
db.embeddings.findOne({})
// Should show: { vector: [...1536 values...], filename: "...", page: 1, ... }
```

---

## Phase 3: Vector Search & Retrieval

### Step 3.1: Set Up MongoDB Atlas Vector Search Index
**Location:** MongoDB Atlas UI

**Steps:**
1. Go to [Atlas UI](https://cloud.mongodb.com) → your cluster
2. Collections tab → select `opsmind` database → `embeddings` collection
3. Search Indexes → Create Search Index
4. Use JSON Editor and paste:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "vector",
      "similarity": "cosine",
      "dimensions": 768
    },
    {
      "type": "filter",
      "path": "filename"
    },
    {
      "type": "filter",
      "path": "page"
    }
  ]
}
```

5. Name it `vector_index` and create
6. Wait for index to build (usually 1-2 minutes)

**Verification:**
In MongoDB Compass or shell:
```javascript
db.embeddings.aggregate([
  {
    "$search": {
      "cosmosSearch": {
        "vector": [0.1, 0.2, ...], // dummy vector
        "k": 5
      },
      "returnStoredSource": true
    }
  }
])
```

---

### Step 3.2: Implement Real Vector Search Retrieval
**File:** [src/services/retrieval.service.js](src/services/retrieval.service.js)

**Current State:** Uses in-memory cosine similarity (full scan):
```javascript
export async function retrieveRelevantChunks(query, options = {}) {
  const queryVector = await generateEmbedding(query);
  const candidates = await Embedding.find({}, {...}).lean();
  // Scores each candidate in memory
  // Returns top 5
}
```

**What to Change:**
Replace with MongoDB Atlas Vector Search aggregation for production scalability.

**Updated Implementation:**
```javascript
import { Embedding } from '../models/Embedding.js';
import { generateEmbedding } from './embedding.service.js';

export async function retrieveRelevantChunks(query, options = {}) {
  const limit = Number(options.limit || 5);
  const scoreThreshold = Number(options.scoreThreshold || 0.2);
  const useAtlasSearch = process.env.USE_ATLAS_VECTOR_SEARCH === 'true';

  const queryVector = await generateEmbedding(query);

  if (!queryVector || queryVector.length === 0) {
    return [];
  }

  try {
    if (useAtlasSearch) {
      // Production: MongoDB Atlas Vector Search
      const results = await Embedding.collection.aggregate([
        {
          $search: {
            cosmosSearch: {
              vector: queryVector,
              k: limit,
            },
            returnStoredSource: true,
          },
        },
        {
          $project: {
            chunkText: 1,
            page: 1,
            section: 1,
            filename: 1,
            similarityScore: { $meta: 'searchScore' },
          },
        },
        {
          $match: {
            similarityScore: { $gte: scoreThreshold },
          },
        },
        {
          $limit: limit,
        },
      ]).toArray();

      return results.map((doc) => ({
        chunkText: doc.chunkText,
        page: doc.page || 1,
        section: doc.section || '',
        filename: doc.filename,
        score: doc.similarityScore || 0,
      }));
    } else {
      // Fallback: In-memory search (for development/testing)
      const candidates = await Embedding.find({}, {
        chunkText: 1,
        page: 1,
        section: 1,
        filename: 1,
        vector: 1,
      }).lean();

      const ranked = candidates
        .map((candidate) => ({
          chunkText: candidate.chunkText,
          page: candidate.page,
          section: candidate.section,
          filename: candidate.filename,
          score: cosineSimilarity(queryVector, candidate.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .filter((item) => item.score >= scoreThreshold);

      return ranked;
    }
  } catch (error) {
    console.error('Vector search failed:', error);
    // Graceful fallback to empty results rather than crash
    return [];
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Verification:**
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the refund policy?"}'

# Should retrieve relevant chunks with high similarity scores
```

---

## Phase 4: Grounded LLM Generation

### Step 4.1: Implement LLM Service
**File:** [src/services/llm.service.js](src/services/llm.service.js)

**What to Create:**
This file handles all LLM calls and ensures responses are grounded in retrieved context.

**Implementation:**
```javascript
import fetch from 'node-fetch';

export const FALLBACK_MESSAGE = 'I don\'t know. This topic is not covered in the available documentation.';

const SYSTEM_PROMPT = `You are OpsMind AI, an enterprise knowledge assistant.
Your ONLY source of information is the context provided below, extracted from official company SOP documents.

RULES:
1. Answer ONLY based on the provided context. Do not use any external knowledge.
2. Every factual claim MUST be cited using the format: (Document Name, Page X, Section Y.Z).
3. If the context does not contain enough information to answer the question, respond EXACTLY with:
   "${FALLBACK_MESSAGE}"
4. Do not speculate, infer, or extrapolate beyond what is explicitly stated in the context.
5. Be concise, professional, and direct.`;

export async function generateGroundedAnswer({ query, chunks }) {
  if (!chunks || chunks.length === 0) {
    return FALLBACK_MESSAGE;
  }

  const contextBlock = chunks
    .map((chunk, i) => {
      const citation = `(${chunk.filename}, Page ${chunk.page}, Section ${chunk.section || 'N/A'})`;
      return `Chunk ${i + 1}: ${citation}\n${chunk.chunkText}`;
    })
    .join('\n\n---\n\n');

  const prompt = `${SYSTEM_PROMPT}

--- CONTEXT START ---
${contextBlock}
--- CONTEXT END ---

User Question: ${query}

Provide your answer with proper citations.`;

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3, // Low temperature for consistent, factual responses
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_UNSPECIFIED',
              threshold: 'BLOCK_NONE',
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('LLM API error:', error);
      throw new Error(`LLM API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text || FALLBACK_MESSAGE;

    // Check if answer contains the fallback message
    if (answer.includes('I don\'t know') || answer.includes('not covered')) {
      return FALLBACK_MESSAGE;
    }

    return answer;
  } catch (error) {
    console.error('LLM generation failed:', error);
    return FALLBACK_MESSAGE;
  }
}

// Stream version for real-time token emission
export async function* generateGroundedAnswerStream({ query, chunks }) {
  if (!chunks || chunks.length === 0) {
    yield FALLBACK_MESSAGE;
    return;
  }

  const contextBlock = chunks
    .map((chunk, i) => {
      const citation = `(${chunk.filename}, Page ${chunk.page})`;
      return `Chunk ${i + 1}: ${citation}\n${chunk.chunkText}`;
    })
    .join('\n\n---\n\n');

  const prompt = `${SYSTEM_PROMPT}

--- CONTEXT START ---
${contextBlock}
--- CONTEXT END ---

User Question: ${query}`;

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('LLM stream error:', response.status);
      yield FALLBACK_MESSAGE;
      return;
    }

    // Parse SSE stream from Gemini API
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    console.error('LLM stream generation failed:', error);
    yield FALLBACK_MESSAGE;
  }
}
```

**Verification:**
```bash
node -e "
import { generateGroundedAnswer } from './src/services/llm.service.js';

const chunks = [{
  filename: 'HR_Policy.pdf',
  page: 5,
  section: '2.1',
  chunkText: 'Employees must submit vacation requests at least 30 days in advance.'
}];

const answer = await generateGroundedAnswer({
  query: 'How much advance notice for vacation?',
  chunks
});

console.log(answer);
"
```

**Expected Output:**
```
According to HR_Policy.pdf (Page 5, Section 2.1), employees must submit vacation requests at least 30 days in advance.
```

---

### Step 4.2: Update Chat Service to Use Real LLM
**File:** [src/services/chat.service.js](src/services/chat.service.js)

**Current State:**
```javascript
import { generateGroundedAnswer } from './llm.service.js';
// ...
const answer = await generateGroundedAnswer({ query, chunks });
```

**What to Verify:**
- Calls `generateGroundedAnswer()` from Step 4.1
- Saves messages + citations to MongoDB
- Respects daily limits for free tier

**Current implementation is already mostly correct; just ensure LLM service exists.**

---

## Phase 5: Real-Time SSE Streaming

### Step 5.1: Update Chat Route for Streaming
**File:** [src/routes/chat.routes.js](src/routes/chat.routes.js)

**Current State:** Returns static answer split into words (fake streaming):
```javascript
const words = result.answer.split(/\s+/).filter(Boolean);
for (const word of words) {
  response.write(`event: token\n`);
  response.write(`data: ${JSON.stringify({ text: `${word} ` })}\n\n`);
}
```

**What to Change:**
Use the streaming generator from `llm.service.js` to emit tokens as they arrive.

**Updated Implementation:**
```javascript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { processChatQuery, getChatHistory, clearChatSession } from '../services/chat.service.js';
import { retrieveRelevantChunks } from '../services/retrieval.service.js';
import { generateGroundedAnswerStream } from '../services/llm.service.js';
import { User } from '../models/User.js';
import { randomUUID } from 'crypto';

export const chatRouter = Router();

chatRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const { query, session_id: sessionId } = request.body || {};

    // Validate query
    if (!query || typeof query !== 'string' || !query.trim()) {
      response.status(400).json({ message: 'Query is required' });
      return;
    }

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    const normalizedQuery = query.trim();
    const resolvedSessionId = sessionId || randomUUID();
    const user = request.user;

    // Retrieve relevant chunks
    const chunks = await retrieveRelevantChunks(normalizedQuery, {
      limit: 5,
      scoreThreshold: 0.2,
    });

    // Build citations
    const citations = chunks.map((chunk) => ({
      filename: chunk.filename,
      page: chunk.page || 1,
      section: chunk.section || '',
    }));

    // Save user message
    await User.findByIdAndUpdate(
      user._id,
      {
        $push: {
          'chatHistory.$[session].messages': {
            role: 'user',
            content: normalizedQuery,
            timestamp: new Date(),
          },
        },
      },
      { arrayFilters: [{ 'session.sessionId': resolvedSessionId }] }
    ).catch(() => {}); // Session may not exist yet

    // Stream answer tokens
    let fullAnswer = '';
    for await (const token of generateGroundedAnswerStream({ query: normalizedQuery, chunks })) {
      fullAnswer += token;
      response.write('event: token\n');
      response.write(`data: ${JSON.stringify({ text: token })}\n\n`);
    }

    // Emit citations
    for (const citation of citations) {
      response.write('event: citation\n');
      response.write(`data: ${JSON.stringify(citation)}\n\n`);
    }

    // Save assistant message
    await User.findByIdAndUpdate(
      user._id,
      {
        $push: {
          'chatHistory.$[session].messages': {
            role: 'assistant',
            content: fullAnswer,
            citations,
            timestamp: new Date(),
          },
        },
      },
      { arrayFilters: [{ 'session.sessionId': resolvedSessionId }] }
    ).catch(() => {}); // Session may not exist yet

    // Signal completion
    response.write('event: done\n');
    response.write(
      `data: ${JSON.stringify({
        session_id: resolvedSessionId,
        total_tokens: fullAnswer.split(/\s+/).filter(Boolean).length,
      })}\n\n`
    );
    response.end();
  } catch (error) {
    console.error('Chat error:', error);
    response.write(`event: error\n`);
    response.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
    response.end();
  }
});

chatRouter.get('/history', requireAuth, async (request, response, next) => {
  try {
    const user = await User.findById(request.user._id).lean();
    response.json({ sessions: user?.chatHistory || [] });
  } catch (error) {
    next(error);
  }
});

chatRouter.delete('/history/:session_id', requireAuth, async (request, response, next) => {
  try {
    const result = await User.findByIdAndUpdate(
      request.user._id,
      { $pull: { chatHistory: { sessionId: request.params.session_id } } }
    );

    if (!result) {
      return response.status(404).json({ message: 'Session not found' });
    }

    return response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { chatRouter };
```

**Verification:**
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the refund policy?"}' \
  -N  # Disables buffering to see streaming output

# Should see: event: token, data: {"text":"word"}
```

---

## Phase 6: Frontend Chat Interface

### Step 6.1: Update React App Component
**File:** [frontend/src/App.jsx](frontend/src/App.jsx)

**Current State:** Has auth, chat form, and SSE parsing. Needs polish for:
- Citation rendering
- Session sidebar
- Admin document management
- Loading states

**What to Update:**

1. **Add Citation Panel:**
```jsx
function CitationPanel({ citation, isOpen }) {
  if (!isOpen || !citation) return null;

  return (
    <div className="citation-panel">
      <h3>{citation.filename}</h3>
      <p>Page {citation.page} | Section {citation.section}</p>
      <button onClick={() => {}} className="close-btn">×</button>
    </div>
  );
}
```

2. **Render Citations as Clickable Links in Messages:**
```jsx
function MessageWithCitations({ message }) {
  const [selectedCitation, setSelectedCitation] = useState(null);

  return (
    <div className="message">
      <p className="content">{message.content}</p>
      {message.citations?.length > 0 && (
        <div className="citations">
          {message.citations.map((citation, i) => (
            <button
              key={i}
              className="citation-link"
              onClick={() => setSelectedCitation(citation)}
            >
              📄 {citation.filename} (p. {citation.page})
            </button>
          ))}
        </div>
      )}
      <CitationPanel citation={selectedCitation} isOpen={!!selectedCitation} />
    </div>
  );
}
```

3. **Add Session Sidebar:**
```jsx
function SessionSidebar({ sessions, currentSessionId, onSelectSession, onDeleteSession }) {
  return (
    <aside className="sidebar">
      <h2>Sessions</h2>
      <button className="new-session-btn" onClick={() => onSelectSession('')}>
        + New Session
      </button>
      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.sessionId} className={currentSessionId === session.sessionId ? 'active' : ''}>
            <button onClick={() => onSelectSession(session.sessionId)}>
              {session.messages?.[0]?.content?.slice(0, 30)}...
            </button>
            <button className="delete-btn" onClick={() => onDeleteSession(session.sessionId)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

4. **Update Main Chat Area with Better Layout:**
```jsx
return (
  <div className="app">
    {!auth ? (
      // Auth screens (login/register)
      <AuthScreen onAuth={setAuth} />
    ) : (
      <div className="main-layout">
        <SessionSidebar
          sessions={sessions}
          currentSessionId={sessionId}
          onSelectSession={setSessionId}
          onDeleteSession={deleteSession}
        />
        <div className="chat-container">
          <div className="messages">
            {messages.map((msg, i) => (
              <MessageWithCitations key={i} message={msg} />
            ))}
            {streaming && <div className="typing-indicator">Thinking...</div>}
          </div>
          <form onSubmit={askQuestion} className="input-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about company procedures..."
              disabled={streaming}
            />
            <button type="submit" disabled={streaming}>Send</button>
          </form>
        </div>
        {isAdmin && <AdminPanel documents={documents} onUpload={uploadDocuments} />}
      </div>
    )}
  </div>
);
```

---

### Step 6.2: Style the Frontend
**File:** [frontend/src/styles.css](frontend/src/styles.css)

**What to Add:**
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app {
  display: flex;
  height: 100vh;
}

/* Auth Screen */
.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-form {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
}

.auth-form h1 {
  margin-bottom: 24px;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Main Layout */
.main-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: white;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.sidebar h2 {
  font-size: 16px;
  margin-bottom: 12px;
}

.new-session-btn {
  width: 100%;
  padding: 10px;
  margin-bottom: 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.session-list {
  list-style: none;
  flex: 1;
}

.session-list li {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  background: #f9f9f9;
}

.session-list li.active {
  background: #e8eaf6;
  border-left: 3px solid #667eea;
}

.session-list button {
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  padding: 0;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  float: right;
  color: #e74c3c;
  font-size: 12px;
}

/* Chat Container */
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message .content {
  background: #f0f0f0;
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 70%;
  word-wrap: break-word;
}

.message.user .content {
  background: #667eea;
  color: white;
}

.citations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  margin-left: 12px;
}

.citation-link {
  background: #e8eaf6;
  border: 1px solid #667eea;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  color: #667eea;
  transition: all 0.2s;
}

.citation-link:hover {
  background: #667eea;
  color: white;
}

/* Citation Panel */
.citation-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.citation-panel h3 {
  margin-bottom: 8px;
  color: #667eea;
}

.citation-panel p {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

/* Input Form */
.input-form {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.input-form input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-form button {
  padding: 12px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.input-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Typing Indicator */
.typing-indicator {
  padding: 12px 16px;
  color: #999;
  font-style: italic;
}

/* Admin Panel */
.admin-panel {
  width: 300px;
  background: #f9f9f9;
  border-left: 1px solid #e0e0e0;
  padding: 16px;
  overflow-y: auto;
}

.admin-panel h2 {
  font-size: 16px;
  margin-bottom: 12px;
}

.upload-area {
  border: 2px dashed #667eea;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.upload-area:hover {
  background: #f0f0ff;
}

.upload-area input[type="file"] {
  display: none;
}

.document-list {
  list-style: none;
}

.document-item {
  background: white;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #e0e0e0;
}

.document-item-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.document-item-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.document-item-actions {
  display: flex;
  gap: 8px;
}

.document-item-actions button {
  flex: 1;
  padding: 6px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  background: #f0f0f0;
  transition: all 0.2s;
}

.document-item-actions button.delete {
  background: #e74c3c;
  color: white;
}

.document-item-actions button:hover {
  opacity: 0.8;
}
```

---

## Phase 7: Admin Features

### Step 7.1: Complete Admin Routes
**File:** [src/routes/admin.routes.js](src/routes/admin.routes.js)

**Current State:** Already has upload, list, delete, reindex endpoints.

**What to Verify:**
- `POST /api/admin/upload` → Multer middleware → ingestPdfDocument
- `GET /api/admin/documents` → listIndexedDocuments
- `DELETE /api/admin/documents/:doc_id` → deleteDocumentAndEmbeddings
- `POST /api/admin/documents/:doc_id/reindex` → reindexDocument

**All should already be implemented. Just test:**
```bash
# Login as admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"testpass123"}'

# List documents
curl -X GET http://localhost:5000/api/admin/documents \
  -H "Authorization: Bearer <admin-token>"

# Upload PDF
curl -X POST http://localhost:5000/api/admin/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "files=@sample.pdf"

# Delete document
curl -X DELETE http://localhost:5000/api/admin/documents/<doc_id> \
  -H "Authorization: Bearer <admin-token>"
```

---

### Step 7.2: Add Admin UI to Frontend
**File:** [frontend/src/App.jsx](frontend/src/App.jsx)

**What to Add:**
Admin panel component that appears when user role is `admin`.

```jsx
function AdminPanel({ documents, onRefresh }) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.accessToken}` },
        body: formData,
      });

      if (response.ok) {
        alert('PDF uploaded and indexed');
        onRefresh();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.message}`);
      }
    } catch (error) {
      alert(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Delete this document?')) return;

    try {
      const response = await fetch(`/api/admin/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.accessToken}` },
      });

      if (response.ok) {
        alert('Document deleted');
        onRefresh();
      }
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  }

  return (
    <div className="admin-panel">
      <h2>📚 SOP Knowledge Base</h2>

      <div className="upload-area">
        <label>
          📤 Drop PDF or click to upload
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        {uploading && <p>Uploading...</p>}
      </div>

      <h3>Indexed Documents ({documents.length})</h3>
      <ul className="document-list">
        {documents.map((doc) => (
          <li key={doc._id} className="document-item">
            <div className="document-item-name">{doc.originalName}</div>
            <div className="document-item-meta">
              {doc.chunkCount} chunks | {doc.pageCount} pages | {doc.status}
            </div>
            <div className="document-item-actions">
              <button onClick={() => deleteDocument(doc._id)} className="delete">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Phase 8: Testing & Validation

### Step 8.1: Hallucination Testing
**Objective:** Verify system refuses to answer out-of-scope questions.

**Test Case:**
1. Upload a PDF about "HR Policies" only (no mention of "IT Infrastructure")
2. Ask: "What is our IT infrastructure policy?"
3. Expected response: "I don't know. This topic is not covered in the available documentation."

**Verification Script:**
```bash
# Ask an out-of-scope question
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is quantum computing?"}'

# Should NOT hallucinate; should respond with "I don'"'"'t know"
```

---

### Step 8.2: Citation Accuracy Testing
**Objective:** Ensure every answer cites the correct source.

**Test Case:**
1. Upload PDF with a clear policy: "Refunds: 30 days from purchase (Section 2.1, Page 5)"
2. Ask: "What is the refund deadline?"
3. Expected: Response includes citation `(filename, Page 5, Section 2.1)`

**Verification:**
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the refund deadline?"}' \
  -N

# Check for: "event: citation"
# Check for: "filename", "page", "section"
```

---

### Step 8.3: Performance Testing
**Objective:** End-to-end latency < 3 seconds.

**Test:**
```bash
time curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"How do I request leave?"}' \
  -N

# Real: Should complete in 2-3 seconds
```

---

### Step 8.4: Free Tier Limit Testing
**Objective:** Verify daily query limits are enforced.

**Test:**
```bash
# Create free tier user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"free@test.com","password":"test123","role":"employee"}'

# Send queries until limit is hit (default: 20/day)
# After 20 queries, should get 429 error
```

---

## Phase 9: Deployment & Containerization

### Step 9.1: Create Dockerfile
**File:** `Dockerfile`

```dockerfile
# Multi-stage build for smaller image

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source
COPY src ./src
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine
WORKDIR /app

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/frontend/dist ./frontend/dist
COPY package*.json ./

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode);})"

# Start server
CMD ["npm", "start"]
```

---

### Step 9.2: Create Docker Compose
**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      MONGO_URI: mongodb://mongo:27017/opsmind
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      PORT: 5000
      NODE_ENV: production
    depends_on:
      mongo:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
    networks:
      - opsmind

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: opsmind
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - opsmind

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
    networks:
      - opsmind

volumes:
  mongo_data:

networks:
  opsmind:
    driver: bridge
```

---

### Step 9.3: Create Nginx Config
**File:** `nginx.conf`

```nginx
events {
  worker_connections 1024;
}

http {
  upstream api {
    server api:5000;
  }

  server {
    listen 80;
    server_name localhost;

    client_max_body_size 50M;

    # API routes
    location /api {
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_read_timeout 60s;
      proxy_connect_timeout 60s;
    }

    # Health check
    location /health {
      proxy_pass http://api;
    }

    # Frontend (if serving from backend)
    location / {
      try_files $uri /index.html;
      proxy_pass http://api;
    }
  }
}
```

---

### Step 9.4: Deploy Locally
**Command:**
```bash
docker-compose up --build
```

**Expected Output:**
```
mongo_1  | Waiting for connections on port 27017
api_1    | OpsMind AI API running on port 5000
nginx_1  | Listening on port 80
```

**Verify:**
```bash
curl http://localhost/health
# Should return: { "status": "ok" }

# Open http://localhost in browser
# Should see OpsMind AI login screen
```

---

## Completion Checklist

- [ ] Phase 0: Environment setup, backend boots, frontend loads
- [ ] Phase 1: Auth register/login, middleware validation
- [ ] Phase 2: PDF upload, parse, chunk, embed (real embeddings, not placeholder)
- [ ] Phase 3: Vector search retrieval (Atlas or fallback)
- [ ] Phase 4: LLM grounding + system prompt + hallucination guard
- [ ] Phase 5: SSE streaming in chat route
- [ ] Phase 6: React UI with citations, sessions, admin panel
- [ ] Phase 7: Admin upload/delete/reindex flows
- [ ] Phase 8: Hallucination test, citation test, performance test, tier limits
- [ ] Phase 9: Docker & docker-compose deployment

---

## Success Criteria

| Requirement | Check |
|---|---|
| **Live Demo** | Upload PDF → ask question → get grounded answer with citation |
| **Hallucination Guard** | Ask out-of-scope question → receive "I don't know" |
| **Source Citation** | Every answer includes document name, page, section |
| **Streaming** | Tokens appear one-by-one in UI, not as block |
| **Admin Autonomy** | Admin can upload/delete documents without dev involvement |
| **Docker** | `docker-compose up` → full stack running |

---

## Key Decisions Made

| Point | Decision | Why |
|---|---|---|
| **Vector DB** | MongoDB Atlas (not separate) | Reduces latency, single database |
| **Embedding Model** | Gemini text-embedding-004 | Free tier, no separate service needed |
| **LLM** | Gemini 1.5 Flash | Fast, low cost, streaming support |
| **Chunking** | 1000 chars + 100 overlap | Preserves context across boundaries |
| **Retrieval** | Top 5 chunks, 0.2 threshold | Balances precision and recall |
| **SSE Streaming** | Token-by-token from LLM | Improves perceived speed |
| **Auth** | JWT + Refresh tokens | Stateless, scalable |
| **Frontend** | React Vite | Fast dev experience, easy to deploy |

---

**Next Step:** Start with Phase 0 (environment setup), then proceed sequentially. Test after each phase before moving forward.
