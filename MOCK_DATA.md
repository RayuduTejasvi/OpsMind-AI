# OpsMind AI - Mock Data and Placeholders Directory

This file documents all the mock data, dummy integrations, and scaffolding placeholders present within the current **OpsMind AI** codebase.

---

## 1. Stripe Billing Integration Mocking
To facilitate local development without direct external dependencies on Stripe APIs, all billing behaviors are mocked.

- **Mock Billing Services**: [billing.service.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/services/billing.service.js)
  - `createMockCheckout({ userId, plan })`: Returns a dummy Stripe checkout URL:
    `https://example.com/mock-checkout?user=${userId}&plan=${plan || 'pro'}`
  - `createMockPortal({ userId })`: Returns a dummy customer billing portal URL:
    `https://example.com/mock-billing-portal?user=${userId}`
- **Mock Billing Routes**: [billing.routes.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/routes/billing.routes.js)
  - `POST /api/billing/create-checkout`: Exposes and triggers `createMockCheckout`.
  - `GET /api/billing/portal`: Exposes and triggers `createMockPortal`.
  - `POST /api/billing/webhook`: Returns a mocked success confirmation response: `{ received: true, mode: 'mock' }`.
- **Frontend Panel**: [App.jsx](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/frontend/src/App.jsx)
  - Includes a dedicated **Billing** tab displaying action buttons for "Create Checkout" and "Open Portal". When clicked, the returned mock JSON payloads are rendered on screen in a `<pre>` block.

---

## 2. Vector Embedding Mocking & Model Placeholders
For Phase 1 / Week 1 scaffolding, real embedding generation is mocked.

- **Mock Vector Generator**: [embedding.service.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/services/embedding.service.js)
  - `generateEmbedding(text)`: Generates a deterministic static 1536-dimensional mock numeric array where each value is calculated as `(index % 10) / 10`.
- **Placeholder Model Labels**:
  - **Schema Default**: [Embedding.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/models/Embedding.js) defaults the `embeddingModel` database property to `'placeholder-1536'`.
  - **Ingestion Hardcoding**: [ingestion.service.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/services/ingestion.service.js) maps `'placeholder-1536'` when processing PDFs.
  - **Env Configuration**: [.env.example](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/.env.example) uses `EMBEDDING_MODEL=placeholder-1536`.

---

## 3. Local Similarity In-Memory Engine
Rather than relying on live MongoDB Atlas `$vectorSearch` indexes:

- **Local Cosine Search**: [retrieval.service.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/src/services/retrieval.service.js)
  - Calculates cosine similarity programmatically directly inside the Node process (`cosineSimilarity(a, b)`) across all documents fetched from MongoDB, serving as a functional retrieval mock.

---

## 4. Ingestion In-Memory Pipeline Test Fallback
When executing the parsing test harness without files:

- **Test Script Fallback**: [test-ingestion.js](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/scripts/test-ingestion.js)
  - Falls back to a predefined hardcoded text when `scripts/sample.txt` does not exist:
    `'Sample SOP text. This is only a placeholder for the Week 1 ingestion pipeline test.'`

---

## 5. UI Elements & Authentication Scaffolding
Several client-side components act as interactive visual mockups.

- **Third-Party Auth Buttons**: [App.jsx](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/frontend/src/App.jsx)
  - **Google Login** & **SSO** buttons are styled and rendered but contain no backend action logic.
- **Client Auth Fallback**: [App.jsx](file:///c:/Users/PREETIMOHAN/Desktop/OpsMind-AI/frontend/src/App.jsx)
  - Automatically loads and dumps dummy session keys in localStorage (`opsmind_auth`) to preserve session simulation in the browser sandbox.
