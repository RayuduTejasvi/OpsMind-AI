import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const storage = multer.diskStorage({
  destination: async (_request, _file, callback) => {
    try {
      await fs.mkdir('uploads', { recursive: true });
      callback(null, 'uploads');
    } catch (error) {
      callback(error);
    }
  },
  filename: (_request, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, `${randomUUID()}-${safeName}`);
  },
});

function fileFilter(_request, file, callback) {
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';

  if (!isPdf) {
    return callback(new Error('Only PDF files are allowed'));
  }

  return callback(null, true);
}

export const uploadSinglePdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
