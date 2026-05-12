# OpsMind AI — Enterprise SOP Agent
### Context-Aware Corporate Knowledge Brain

> **Organization:** Zaalima Development Pvt. Ltd. — AI Engineering & Full Stack Division  
> **Track:** AI Solutions Track (Squadron Omega)  
> **Classification:** Confidential  
> **Roadmap Quarter:** Q4

---

## Overview

Large corporations typically maintain hundreds of pages of Standard Operating Procedures (SOPs) scattered across various PDF documents — making them difficult to search, reference, or act on quickly. **OpsMind AI** solves this by acting as an always-available, citation-grounded knowledge agent that employees can query in plain language.

The system must:
- Instantly answer employee questions (e.g., *"How do I process a refund?"*)
- Cite the **exact source document, page, and section** for every claim
- Refuse to speculate — explicitly stating *"I don't know"* when a query falls outside the knowledge base
- Eliminate hallucinations entirely through strict RAG-grounded response logic

> This is **not** a simple chatbot. It is a production-grade Agentic System built on Retrieval Augmented Generation (RAG) architecture.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **LLM** | Gemini 1.5 Flash (Google AI Studio) | Cognitive engine — reasoning and response generation |
| **Vector Database** | MongoDB Atlas Vector Search | Stores and retrieves semantic embeddings alongside app data |
| **Orchestrator** | LangChain.js / LlamaIndex.TS | Manages the full RAG Chain of Thought pipeline |
| **Backend** | Node.js + Express | API layer, file handling, orchestration logic |
| **Frontend** | React.js + SSE | Streaming chat interface with real-time token rendering |
| **File Upload** | Multer | Handles PDF ingestion from admin panel |
| **Containerization** | Docker | Mandatory for environment consistency across all stages |

---

## Architecture: The RAG Pipeline

```
User Query
    │
    ▼
Generate Query Embedding
    │
    ▼
MongoDB Atlas Vector Search
(Semantic similarity search over stored SOP chunks)
    │
    ▼
Retrieve Top 3–5 Most Relevant Chunks
    │
    ▼
Build Context Window
(User Query + Retrieved Chunks + System Prompt)
    │
    ▼
Send to Gemini 1.5 Flash
    │
    ▼
Stream Response via SSE (React Frontend)
(With Source Citations: Document Name, Page, Section)
```

### Why MongoDB Atlas Vector Search (Not a Separate Vector DB)?
Using a dedicated vector database (e.g., Pinecone, Weaviate) adds operational complexity and network latency. MongoDB Atlas Vector Search keeps **application data** (user profiles, chat history) and **AI memory** (semantic embeddings) in the same document database — drastically reducing round-trip latency for every RAG query.

---

## Core Product Features

### 1. RAG Pipeline (Retrieval Augmented Generation)
The heart of the system. The full ingestion and retrieval flow:

- **Ingestion:** Uploaded PDFs are parsed, split into text chunks (~1000 characters with 100-character overlap to preserve context across chunk boundaries), and converted to vector embeddings.
- **Storage:** Embeddings are stored directly in MongoDB Atlas with metadata (source filename, page number, section).
- **Retrieval:** On each user query, the query is embedded and a cosine similarity search retrieves the top 3–5 most semantically relevant chunks.
- **Generation:** The retrieved chunks are assembled into the LLM's context window alongside the user query and a strict system prompt.

### 2. Source Citation
Every AI response must explicitly cite its source. Format:

> *"According to the Refund Policy (Page 12, Section 3.1), refund requests must be submitted within 30 days of purchase..."*

The frontend renders citations as clickable links that open the relevant PDF snippet in a side panel.

### 3. Hallucination Prevention
The system prompt is engineered to strictly ground the LLM to the retrieved context only. If a user asks something not covered in the SOP knowledge base, the agent **must** respond:

> *"I don't know. This topic is not covered in the available documentation."*

No speculation. No general knowledge fallback.

### 4. Admin Knowledge Base
A dedicated admin interface for authorized users to:
- Upload new SOP PDF documents
- Delete outdated documents
- Trigger manual re-indexing
- Every upload **automatically** kicks off the full parsing → chunking → embedding → storage pipeline

### 5. Streaming Response (SSE)
Since LLM responses take time, the React.js frontend implements **Server-Sent Events (SSE)** to stream tokens one by one as they are generated. This "typing effect" is mandatory for maintaining perceived speed and user engagement.

### 6. Chat History Persistence
Full conversation history is stored in MongoDB, enabling users to return to previous sessions, review past answers, and trace citations from earlier queries.

---

## Week-Wise Implementation Plan

### Week 1 — The Knowledge Ingestion (Upload & Embed)

**Goal:** Build the pipeline that takes a raw PDF and produces searchable vector embeddings in MongoDB Atlas.

**Key Tasks:**
- Build a file upload service using **Multer** to accept PDF uploads from the admin panel
- Create a PDF parsing script to extract raw text from uploaded documents
- Implement **text chunking logic**: split text into ~1000-character chunks with 100-character overlaps
- Tag each chunk with metadata: `{ sourceFile, pageNumber, sectionTitle, chunkIndex }`
- Call the embedding model (Gemini embedding endpoint) to generate vectors for each chunk
- Store the embeddings + metadata as documents in MongoDB Atlas with a vector index configured

**Review / Verification:**
- Open MongoDB Atlas UI → confirm vector index is created and active
- Run a manual similarity query against the Atlas cluster to verify chunks are indexed and searchable
- Check that metadata (filename, page, section) is correctly attached to each stored chunk

---

### Week 2 — The Retrieval Engine (Finding the Needle)

**Goal:** Wire up the full vector search pipeline so the right SOP chunk is retrieved for any given question.

**Key Tasks:**
- Implement the **MongoDB Atlas Vector Search aggregation pipeline** using `$vectorSearch` operator
- Embed the incoming user query using the same embedding model used during ingestion
- Run the aggregation to return the top 3–5 most relevant chunks with their similarity scores and metadata
- Build the **Context Window Logic**: merge the user query + retrieved chunks into a structured prompt block ready for the LLM
- Set up a `/query` API endpoint that accepts a user question and returns the assembled context

**Review / Verification:**
- Query the endpoint with specific policy-related questions (e.g., "What is the refund deadline?")
- Manually verify that the correct source PDF chunk is returned with accurate metadata
- Test edge cases: very broad queries, multi-topic queries, queries with typos

---

### Week 3 — The Chat Agent (Conversation & Streaming)

**Goal:** Connect the retrieval engine to the LLM and stream the response to the frontend in real time.

**Key Tasks:**
- Integrate **Gemini 1.5 Flash** via Google AI Studio API
- Feed the assembled context window (retrieved chunks + user query + system prompt) to the LLM
- Engineer the system prompt to:
  - Ground responses strictly to the provided context
  - Format all citations in the standard `(Document Name, Page X, Section Y.Z)` format
  - Respond with *"I don't know"* if no relevant context is found
- Implement **SSE (Server-Sent Events)** on the Node.js backend to stream the LLM's token output
- Build the React.js chat interface to render streaming tokens in real time
- Display citations as clickable references in the UI

**Review / Verification:**
- Rigorous **Hallucination Testing**:
  - Ask a question clearly **not** covered in any uploaded SOP
  - The agent **must** respond with "I don't know" — never fabricate an answer
- Verify citations are accurate and link to the correct section of the source PDF
- Test streaming — confirm tokens appear progressively, not as a single delayed block

---

### Week 4 — UI & Optimization (User Experience)

**Goal:** Polish the product to production quality, optimize performance, and verify end-to-end reliability.

**Key Tasks:**
- Finalize the **Citations UI**: clicking a cited source opens a side panel showing the exact extracted PDF snippet
- Complete the **Admin Knowledge Base UI**: upload, delete, re-index documents with status indicators
- Implement full **chat history persistence**: sessions saved to MongoDB, resumable from the sidebar
- Performance optimization: profile and reduce RAG pipeline latency (target: < 3s end-to-end)
- Docker containerization: finalize `Dockerfile` and `docker-compose.yml` for the full stack

**Review / Verification:**
- Full **end-to-end performance test**: measure time from user query submission to first streamed token
- **Stress test** the RAG pipeline with concurrent users and large SOP corpora
- Complete **admin workflow test**: upload a new PDF → verify it is correctly indexed → query the new content
- Confirm Docker containers spin up cleanly with a single `docker-compose up` command

---

## Data Models

### SOP Chunk Document (MongoDB)
```json
{
  "_id": "ObjectId",
  "sourceFile": "HR_Policy_v3.pdf",
  "pageNumber": 12,
  "sectionTitle": "Section 3.1 — Refund Policy",
  "chunkIndex": 4,
  "chunkText": "Refund requests must be submitted within 30 days of the original purchase date. To initiate a refund, employees must...",
  "embedding": [0.023, -0.118, 0.204, ...],
  "createdAt": "2025-12-01T10:00:00Z"
}
```

### Chat Session Document (MongoDB)
```json
{
  "_id": "ObjectId",
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "messages": [
    {
      "role": "user",
      "content": "How do I process a refund?",
      "timestamp": "2025-12-01T10:05:00Z"
    },
    {
      "role": "assistant",
      "content": "According to the Refund Policy (Page 12, Section 3.1), refund requests must be submitted within 30 days...",
      "citations": [
        { "sourceFile": "HR_Policy_v3.pdf", "pageNumber": 12, "sectionTitle": "Section 3.1" }
      ],
      "timestamp": "2025-12-01T10:05:03Z"
    }
  ]
}
```

---

## System Prompt Template

```
You are OpsMind AI, an enterprise knowledge assistant for [Company Name].
Your ONLY source of information is the context provided below, extracted from official company SOP documents.

RULES:
1. Answer ONLY based on the provided context. Do not use any external knowledge.
2. Every factual claim MUST be cited using the format: (Document Name, Page X, Section Y.Z).
3. If the context does not contain enough information to answer the question, respond EXACTLY with:
   "I don't know. This topic is not covered in the available documentation."
4. Do not speculate, infer, or extrapolate beyond what is explicitly stated in the context.
5. Be concise, professional, and direct.

--- CONTEXT START ---
{retrieved_chunks}
--- CONTEXT END ---

User Question: {user_query}
```

---

## Submission Requirements

| Requirement | Status |
|---|---|
| Live, working, deployable demo | ✅ **Mandatory** |
| Docker containerization | ✅ **Mandatory** |
| Hallucination safeguards | ✅ **Mandatory** |
| Source citation on every response | ✅ **Mandatory** |

---

> *"Intelligence is artificial. Competence is mandatory."*  
> — Zaalima Development Pvt. Ltd.
