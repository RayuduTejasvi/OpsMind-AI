import { Router } from 'express';
import { uploadSinglePdf } from '../middleware/upload.middleware.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import {
  deleteDocumentAndEmbeddings,
  ingestPdfDocument,
  listIndexedDocuments,
  reindexDocument,
} from '../services/ingestion.service.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.post('/upload', uploadSinglePdf.any(), async (request, response, next) => {
  try {
    const files = request.files || [];
    if (!files.length) {
      return response.status(400).json({ message: 'At least one PDF file is required' });
    }

    const results = [];
    for (const file of files) {
      // Process sequentially to keep memory bounded for large uploads.
      // eslint-disable-next-line no-await-in-loop
      const result = await ingestPdfDocument(file);
      results.push(result);
    }

    return response.status(201).json({
      message: 'Upload and indexing completed',
      documents: results,
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/documents', async (_request, response, next) => {
  try {
    const documents = await listIndexedDocuments();
    return response.json({ documents });
  } catch (error) {
    return next(error);
  }
});

adminRouter.delete('/documents/:doc_id', async (request, response, next) => {
  try {
    const deleted = await deleteDocumentAndEmbeddings(request.params.doc_id);
    if (!deleted) {
      return response.status(404).json({ message: 'Document not found' });
    }

    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});

adminRouter.post('/documents/:doc_id/reindex', async (request, response, next) => {
  try {
    const result = await reindexDocument(request.params.doc_id);
    return response.json(result);
  } catch (error) {
    return next(error);
  }
});
