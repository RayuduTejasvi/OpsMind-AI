# OpsMind AI

OpsMind AI is an enterprise SOP agent that helps employees ask natural-language questions and get grounded answers from company documentation. It is designed to search live SOP content, return cited responses, and refuse to invent information when the knowledge base does not contain an answer.

## What It Solves

Large organizations often keep SOPs in scattered PDFs and shared drives. OpsMind AI centralizes that knowledge into a conversational interface so teams can find the right procedure faster, reduce repetitive questions, and improve compliance with documented processes.

## Core Capabilities

- Conversational chat interface for employee SOP questions
- Retrieval-Augmented Generation (RAG) for grounded answers
- Source citations with document name, page number, and section reference
- Hallucination guard that returns a safe fallback when context is missing
- Admin dashboard for uploading, indexing, deleting, and reindexing SOP PDFs
- JWT-based authentication with role-based access control
- Subscription support for Free and Pro tiers
- Server-Sent Events streaming for token-by-token responses

## Product Goals

| Goal | Target |
|---|---|
| Accurate retrieval | At least 90% correct chunk retrieval for employee queries |
| Zero hallucination | No fabricated answers; return "I don't have information" when needed |
| Source citation | Every answer includes document, page, and section metadata |
| Fast response | First token streamed in under 3 seconds |
| Admin autonomy | Admins can manage SOPs without developer intervention |

## Key Users

- Employee: asks procedural questions and expects quick, trustworthy answers
- Admin: uploads and manages SOP knowledge documents
- Executive: reviews usage, accuracy, and ROI reports

## System Overview

OpsMind AI uses a three-layer architecture:

- Frontend: React.js chat UI, admin panel, and auth screens
- Backend: Node.js + Express API, PDF ingestion, LangChain orchestration, citation formatting, and SSE streaming
- Data layer: MongoDB Atlas for documents, embeddings, and vector search

The LLM layer can use Gemini 1.5 Flash or Groq with Llama 3 as a low-latency fallback.

## High-Level Workflow

### Employee Query Flow

1. User submits a question in the chat UI.
2. The backend generates a query embedding.
3. MongoDB Atlas Vector Search retrieves the most relevant SOP chunks.
4. The retrieved context is passed to the LLM with citation metadata.
5. The answer streams back to the UI through SSE.
6. If no grounded answer exists, the system returns a safe fallback response.

### Admin Upload Flow

1. Admin uploads one or more PDF files.
2. The backend parses and chunks the document text.
3. Each chunk is embedded and stored in MongoDB.
4. The document becomes searchable once indexing completes.

## Functional Requirements Summary

### Employee Chat

- Ask questions in natural language
- Receive grounded answers with citations
- Stream responses token-by-token
- Preserve chat history per session
- Open or highlight relevant PDF snippets from citations

### Admin Knowledge Base Management

- Upload one or multiple PDFs
- Automatically parse, chunk, embed, and index documents
- View indexed document metadata
- Delete documents and their embeddings
- Trigger manual reindexing
- Restrict admin access with RBAC

### RAG Pipeline

- Chunk PDFs at about 1000 characters with 100-character overlap
- Generate embeddings for every chunk
- Retrieve the top 3 to 5 relevant chunks
- Rank chunks by relevance before generation
- Pass query, context, and citations into the LLM prompt

### Authentication and Subscription

- JWT-based email/password authentication
- Free and Pro subscription tiers through Stripe
- Configurable daily query limits for Free users
- Unlimited queries and history export for Pro users

## Non-Functional Requirements

- Vector search latency: 1.5 seconds or less
- First token to UI: 3 seconds or less
- PDF upload to searchable index: 60 seconds or less
- Concurrent users supported: at least 100 active sessions
- Availability target: 99.5% uptime
- Accessibility: WCAG 2.1 AA compliant
- Security: JWT protection, RBAC, file validation, and secret management via environment variables

## Tech Stack

### Frontend

- React.js 18
- Redux Toolkit or React Context
- Server-Sent Events
- Axios
- Tailwind CSS
- react-pdf

### Backend

- Node.js 20 LTS
- Express.js
- LangChain.js
- Multer
- pdf-parse or LangChain PDFLoader
- jsonwebtoken and bcrypt
- Stripe Node SDK
- Zod

### Data Layer

- MongoDB Atlas
- MongoDB Atlas Vector Search
- Mongoose

### LLM and Embeddings

- Gemini 1.5 Flash
- Groq API with Llama 3 70B fallback
- Gemini text-embedding-004 or OpenAI ada-002

### Infrastructure

- Docker and docker-compose
- Nginx
- PM2
- GitHub Actions

## Data Model Overview

### users

Stores authentication, role, subscription, query limits, and chat history.

### sop_documents

Stores uploaded document metadata, processing status, and chunk metadata.

### embeddings

Stores chunk vectors and retrieval metadata for semantic search.

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Chat

- `POST /api/chat`
- `GET /api/chat/history`
- `DELETE /api/chat/history/:session_id`

### Admin

- `POST /api/admin/upload`
- `GET /api/admin/documents`
- `DELETE /api/admin/documents/:doc_id`
- `POST /api/admin/documents/:doc_id/reindex`

### Billing

- `POST /api/billing/create-checkout`
- `POST /api/billing/webhook`
- `GET /api/billing/portal`

## RAG Pipeline

### Ingestion

PDFs are parsed, split into overlapping chunks, embedded, and stored in MongoDB Atlas with page and section metadata.

### Retrieval

User queries are embedded and matched against the vector index to return the most relevant SOP chunks.

### Generation

The LLM receives the user question, retrieved chunks, and citation metadata and returns a grounded answer.

### Hallucination Guard

If the response is not supported by retrieved context, the system returns a safe fallback message instead of fabricating an answer.

## Implementation Plan

### Week 1: Knowledge Ingestion

Build the PDF upload, parsing, chunking, embedding, and storage pipeline.

### Week 2: Retrieval Engine

Implement vector search, query embedding, context building, and RAG chain orchestration.

### Week 3: Chat Agent

Deliver SSE streaming, grounded answers, citation events, and chat history persistence.

### Week 4: UI Polish and Optimization

Add citation viewing, admin dashboard features, authentication, subscription handling, and performance hardening.

## Security and Compliance

- JWT tokens expire after 24 hours
- Refresh tokens expire after 30 days
- Passwords are hashed with bcrypt
- Admin routes require role checks
- Public endpoints and chat routes are rate limited
- PDF-only uploads are enforced with a 50MB size limit
- Files are stored in isolated temporary upload directories and removed after processing
- Prompt injection is mitigated through strict prompt separation and input constraints

## Deployment

The target deployment uses Docker Compose with separate API, frontend, and Nginx reverse proxy services. Production requires environment variables for MongoDB, LLM providers, embeddings, JWT secrets, Stripe, and application configuration.

## Open Questions And Risks

- Gemini rate limits may require a fallback LLM
- Chunking must avoid splitting critical policy text mid-sentence
- Large PDFs may need batch-based async embedding jobs
- Atlas vector search may need tuning for recall
- Scanned PDFs may need OCR support later
- Chat history retention should eventually be capped

## Submission Requirements

A working demo should include:

- PDF upload
- Live RAG query with citation
- Hallucination fallback case
- Admin panel walkthrough

---

*Zaalima Development Pvt. Ltd. - Confidential*
