import { Router } from 'express';
import { uploadSinglePdf } from '../middleware/upload.middleware.js';
import { ingestPdfDocument } from '../services/ingestion.service.js';

export const adminRouter = Router();

adminRouter.post('/upload', uploadSinglePdf.single('file'), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ message: 'A PDF file is required' });
    }

    const result = await ingestPdfDocument(request.file);
    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});
