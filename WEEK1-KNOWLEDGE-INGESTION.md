# Week 1 Implementation Guide: Knowledge Ingestion

This document explains what needs to be built in Week 1 of OpsMind AI and how to approach it in a practical way.

## Week 1 Goal

Build the complete knowledge ingestion pipeline so an admin can upload PDF files, the system can extract and split the content into chunks, embeddings can be generated for each chunk, and the data can be stored in MongoDB Atlas with vector search support.

By the end of Week 1, the project should be able to answer this question:

- Can an admin upload a PDF and have its content become searchable in Atlas?

If the answer is yes, Week 1 is complete.

## What You Need To Build

The Week 1 scope from the PRD contains four main outcomes:

1. A file upload service using Multer
2. A PDF parsing and text chunking script
3. Embedding generation for each chunk
4. Storage of chunks and vectors in MongoDB Atlas

You also need to verify that the vectors are indexed and searchable in Atlas.

## What This Means In Simple Terms

You are building the ingestion side of the product.

The flow should look like this:

1. Admin uploads a PDF.
2. Backend receives the file.
3. PDF text is extracted page by page.
4. The text is split into overlapping chunks.
5. Each chunk is converted into a vector embedding.
6. The chunk text, metadata, and vector are stored in MongoDB Atlas.
7. Atlas Vector Search can later find the right chunk when a user asks a question.

## Suggested Output Of Week 1

At the end of this week, the repository should contain at least:

- An upload endpoint for PDFs
- A PDF parsing utility
- A chunking utility
- An embedding service
- MongoDB models or collections for documents and embeddings
- A script or endpoint to test ingestion end to end
- A verified Atlas vector index

## Recommended Build Order

### 1. Set Up The Upload Endpoint

Start with the admin upload API.

What it should do:

- Accept one or more PDF files
- Reject non-PDF files
- Limit file size to a safe value such as 50MB
- Save uploads into a temporary folder
- Pass the file path to the parsing pipeline

What to define:

- Route: `/api/admin/upload`
- Middleware: authentication and admin-only access
- Upload handler: Multer configuration

What to check:

- Can the backend receive a PDF file successfully?
- Does it reject invalid file types?
- Does it enforce file size limits?

### 2. Build The PDF Parsing Step

Once the file is accepted, extract its text.

What it should do:

- Read each page of the PDF
- Preserve page numbers if possible
- Extract raw text cleanly
- Detect empty or image-only PDFs if extraction fails

What to store temporarily in memory or in a script result:

- Filename
- Page number
- Extracted text
- Total page count

What to check:

- Does every page produce usable text?
- Are page numbers preserved?
- Do scanned PDFs fail gracefully?

### 3. Build The Chunking Logic

After parsing, split the text into chunks.

PRD target:

- About 1000 characters per chunk
- About 100 characters overlap between chunks

Why this matters:

- The model gets smaller, focused pieces of content
- Overlap prevents meaning from being lost at chunk boundaries
- Retrieval works better when chunks stay semantically coherent

Recommended behavior:

- Prefer splitting on sentence boundaries when possible
- Keep overlap consistent
- Attach metadata to every chunk

Chunk metadata should include:

- `chunk_id`
- `chunk_index`
- `page`
- `section` if available
- `char_start`
- `char_end`
- `filename`

What to check:

- Are chunks close to the target length?
- Does overlap actually exist between consecutive chunks?
- Is the chunking repeatable and predictable?

### 4. Generate Embeddings

Each chunk needs a vector embedding.

What it should do:

- Send the chunk text to the chosen embedding model
- Receive a numeric vector back
- Keep the embedding model consistent between ingestion and query time

Possible models mentioned in the PRD:

- Gemini text-embedding-004
- OpenAI ada-002

What to store with each embedding:

- Chunk text
- Vector array
- Chunk metadata
- Filename
- Document reference
- Embedding model name

What to check:

- Does every chunk produce one embedding?
- Are vectors the expected dimension?
- Does the embedding API handle failures cleanly?

### 5. Store Everything In MongoDB Atlas

The ingestion output should be written to MongoDB Atlas collections.

Suggested storage pattern from the PRD:

- `sop_documents` for document-level metadata and chunk lists
- `embeddings` for vector search records

What document-level data might include:

- Filename
- Original filename
- Upload date
- Page count
- Chunk count
- Processing status
- Uploaded by

What embedding-level data might include:

- `doc_id`
- `chunk_id`
- `chunk_text`
- `page`
- `section`
- `filename`
- `vector`
- `embedding_model`
- `created_at`

What to check:

- Are chunks stored correctly?
- Are vectors saved in the correct collection?
- Does the document status change from `processing` to `indexed` after success?
- Does failure update the status to `error`?

### 6. Create The Atlas Vector Search Index

The PRD requires searchable vectors in Atlas.

What this means:

- Create an Atlas Vector Search index on the vector field
- Use cosine similarity
- Confirm the vector dimension matches the embedding model output

The PRD mentions:

- Index name: `vector_index`
- Field: `vector`
- Similarity: `cosine`
- Dimensions: `1536`
- `numCandidates`: `100`
- `limit`: `5`

What to check:

- Is the vector index active?
- Does Atlas accept the stored vector field?
- Can a test query return the expected chunk?

## Suggested Project Structure For Week 1

You do not have to follow this exactly, but this structure will keep the code clean:

- `src/routes/admin.routes.js` for upload routes
- `src/middleware/upload.middleware.js` for Multer config
- `src/services/pdfParser.service.js` for extracting text
- `src/services/chunker.service.js` for splitting text
- `src/services/embedding.service.js` for generating vectors
- `src/models/SopDocument.js` for document metadata
- `src/models/Embedding.js` for vector records
- `scripts/test-ingestion.js` for a manual ingestion test

## Detailed Task Checklist

### A. Backend Setup

- Create or confirm a Node.js and Express backend
- Add environment variables for database and embedding API keys
- Connect the app to MongoDB Atlas
- Confirm the backend starts cleanly

### B. File Upload Handling

- Install and configure Multer
- Restrict uploads to PDF files only
- Enforce a file size limit
- Save files to a temporary upload directory
- Clean up uploaded files after processing

### C. PDF Processing

- Read the uploaded PDF file
- Extract text page by page
- Handle empty pages carefully
- Reject or flag scanned PDFs if they have no extractable text

### D. Chunking

- Split extracted text into roughly 1000-character chunks
- Include roughly 100 characters of overlap
- Keep chunk boundaries as clean as possible
- Preserve source metadata

### E. Embedding Generation

- Select and configure one embedding provider
- Generate a vector for every chunk
- Handle rate limits and API errors
- Retry failed embedding calls when appropriate

### F. Database Storage

- Create collections or models for documents and embeddings
- Store chunk data with metadata
- Store vector arrays with searchable fields
- Update processing status after completion

### G. Vector Search Setup

- Create the Atlas vector index
- Verify the vector dimensions match the embedding model
- Test a sample similarity query in Atlas

## Acceptance Criteria For Week 1

Week 1 should be considered done when all of the following are true:

- A PDF can be uploaded through the backend
- The PDF is parsed successfully
- The document is split into overlapping chunks
- Every chunk gets an embedding
- Chunks and vectors are stored in MongoDB Atlas
- The Atlas vector index is active
- A test query can retrieve a relevant stored chunk
- Failed uploads or failed embeddings are handled without crashing the app

## Practical Testing Checklist

Use these checks to verify your implementation:

- Upload a small 2 to 5 page PDF and confirm it is indexed
- Upload a larger 20 page PDF and confirm chunk counts look reasonable
- Try uploading a non-PDF file and confirm it is rejected
- Try an oversized file and confirm the limit is enforced
- Confirm the embedding vector length matches the Atlas index dimensions
- Confirm the document status becomes `indexed` after success
- Confirm the document status becomes `error` if parsing or embedding fails

## Common Mistakes To Avoid

- Storing only raw text without embeddings
- Forgetting chunk overlap
- Using different embedding models for ingestion and retrieval
- Not preserving page metadata
- Not validating file type or file size
- Not deleting temporary files after processing
- Creating a vector index with the wrong dimension
- Treating scanned PDFs as if they contain extractable text

## What You Should Not Build Yet

These items belong to later weeks and are not the main focus for Week 1:

- Chat UI
- SSE streaming responses
- Hallucination guard
- Chat history persistence
- Admin dashboard UI polish
- Stripe billing
- Full RAG generation flow

## Week 1 Deliverable Summary

If you want the shortest possible summary, Week 1 is about this:

Build the PDF ingestion pipeline that takes a PDF, extracts text, splits it into chunks, generates embeddings, stores everything in MongoDB Atlas, and confirms the data is searchable through Atlas Vector Search.

## Final Note

This week is the foundation for the rest of the project. If ingestion is unreliable, the chat system will not be reliable either. Focus on correctness, metadata quality, and searchable storage before moving to the chat experience.
