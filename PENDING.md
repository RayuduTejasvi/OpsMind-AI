# OpsMind AI Pending Work

This file tracks what is still pending to reach full PRD-level completion.

## Current Snapshot

- Backend MVP is running (auth, admin upload/indexing, chat SSE, history, billing mock routes).
- Frontend MVP is running (auth screen, chat, admin panel, billing mock panel).
- Local deterministic embeddings are used (not production embedding APIs yet).

## Pending - High Priority (P0)

### 1) Real LLM Answer Generation

- Status: Completed (Phase 1)
- Implemented:
  - Gemini integration as primary provider.
  - Groq integration as fallback provider.
  - Strict grounded prompt with explicit no-hallucination rule.
  - Safe deterministic fallback if provider is unavailable or response is not grounded.
- Follow-up:
  - Add automated evaluation tests for grounding quality and hallucination resistance.

### 2) Production-Grade Retrieval

- Replace in-memory cosine ranking over all embedding rows with MongoDB Atlas `$vectorSearch`.
- Create and verify Atlas vector index (`vector_index`) with configured dimensions.
- Tune retrieval parameters (`numCandidates`, `limit`, thresholding).

### 3) Strong Citation Pipeline

- Improve citation extraction so answers consistently map to exact document/page/section.
- Add frontend citation click-to-view workflow (PDF snippet/highlight).

### 4) Admin Security Hardening

- Add stricter admin onboarding flow (avoid open self-registration as admin in production).
- Add audit logs for document upload, delete, and reindex actions.

### 5) Upload Security Hardening

- Add virus scanning step for uploaded PDFs.
- Add additional MIME and file signature checks.
- Move temp uploads to isolated secure path and apply lifecycle cleanup policy.

## Pending - Medium Priority (P1)

### 6) Stripe Real Integration

- Replace mock billing endpoints with live Stripe checkout and portal flows.
- Implement and verify webhook signature validation.
- Persist subscription state updates into `users.planTier`.

### 7) Auth Improvements

- Add refresh token rotation and invalidation strategy.
- Add logout endpoint and token revocation flow.
- Add rate limits for auth and chat endpoints.

### 8) Chat Experience Improvements

- Add pagination for chat history.
- Add start new conversation UX control and session naming.
- Add better stream error handling and retry UI.

### 9) Document Management UX

- Add document metadata filters/search in admin panel.
- Show upload progress and ingestion state updates (processing/indexed/error).

## Pending - Non-Functional and DevOps

### 10) Testing

- Add backend unit tests:
  - auth service
  - chat service
  - ingestion service
  - retrieval service
- Add API integration tests for auth/admin/chat flows.
- Add frontend component/integration tests.

### 11) Performance and Scale

- Add queue-based ingestion for large PDFs and batch embedding jobs.
- Measure and optimize first-token latency target (< 3s).
- Add retrieval latency instrumentation and dashboards.

### 12) Deployment

- Add Docker Compose production setup with separate frontend/backend/reverse-proxy services.
- Add Nginx config for TLS termination and routing.
- Add CI pipeline for lint/test/build/deploy.

### 13) Observability

- Add structured logging and request IDs.
- Add error monitoring and alerting.
- Add usage analytics for query quality and unanswered-question tracking.

### 14) Accessibility and UI Quality

- Validate WCAG 2.1 AA (contrast, keyboard navigation, screen reader labels).
- Improve empty/error states and responsive behavior polish.

## Pending - Data and Compliance

### 15) Data Lifecycle

- Define chat retention policy (for example, 90-day retention).
- Add data export/delete controls for compliance use cases.

### 16) Prompt Injection and Safety

- Add stronger input sanitization and prompt delimiting checks.
- Add automated safety tests for prompt injection attempts.

## Optional Nice-to-Have (P2)

- OCR support for scanned PDFs.
- Keyword fallback retrieval when vector score is too low.
- Admin dashboard analytics (top queries, unanswered queries, source coverage).

## Suggested Next Execution Order

1. Real LLM integration + Atlas vector search.
2. Stripe live integration.
3. Citation click-to-view implementation.
4. Test suite (backend first, then frontend).
5. Docker production deployment and CI/CD.
