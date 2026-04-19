import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { SopDocument } from '../models/SopDocument.js';
import { Embedding } from '../models/Embedding.js';
import { extractPdfText } from './pdfParser.service.js';
import { chunkText } from './chunker.service.js';
import { generateEmbedding } from './embedding.service.js';

export async function listIndexedDocuments() {
  return SopDocument.find({}, {
    filename: 1,
    originalName: 1,
    uploadDate: 1,
    pageCount: 1,
    chunkCount: 1,
    status: 1,
    createdAt: 1,
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function deleteDocumentAndEmbeddings(documentId) {
  const documentRecord = await SopDocument.findById(documentId);
  if (!documentRecord) {
    return false;
  }

  await Embedding.deleteMany({ docId: documentRecord._id });
  await SopDocument.deleteOne({ _id: documentRecord._id });
  return true;
}

export async function reindexDocument(documentId) {
  const documentRecord = await SopDocument.findById(documentId);
  if (!documentRecord) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  await Embedding.deleteMany({ docId: documentRecord._id });

  const writes = documentRecord.chunks.map(async (chunk) => {
    const vector = await generateEmbedding(chunk.text);
    return Embedding.create({
      docId: documentRecord._id,
      chunkId: chunk.chunkId,
      chunkText: chunk.text,
      page: chunk.page || 1,
      section: chunk.section || '',
      filename: documentRecord.filename,
      vector,
      embeddingModel: process.env.EMBEDDING_MODEL || 'deterministic-1536',
    });
  });

  await Promise.all(writes);
  documentRecord.status = 'indexed';
  await documentRecord.save();

  return {
    message: 'Document reindexed successfully',
    documentId: documentRecord._id,
    chunkCount: documentRecord.chunks.length,
  };
}

export async function ingestPdfDocument(file) {
  const documentRecord = await SopDocument.create({
    filename: file.filename,
    originalName: file.originalname,
    status: 'processing',
  });

  try {
    const { text, pageCount } = await extractPdfText(file.path);
    const chunks = chunkText(text);

    const storedChunks = [];
    const embeddingWrites = [];

    for (const chunk of chunks) {
      const chunkId = randomUUID();
      const vector = await generateEmbedding(chunk.text);

      storedChunks.push({
        chunkId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        page: 1,
        section: '',
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
      });

      embeddingWrites.push(
        Embedding.create({
          docId: documentRecord._id,
          chunkId,
          chunkText: chunk.text,
          page: 1,
          section: '',
          filename: file.filename,
          vector,
          embeddingModel: process.env.EMBEDDING_MODEL || 'deterministic-1536',
        })
      );
    }

    await Promise.all(embeddingWrites);

    documentRecord.pageCount = pageCount;
    documentRecord.chunkCount = storedChunks.length;
    documentRecord.chunks = storedChunks;
    documentRecord.status = 'indexed';
    await documentRecord.save();

    return {
      message: 'PDF ingested successfully',
      documentId: documentRecord._id,
      fileName: file.originalname,
      pageCount,
      chunkCount: storedChunks.length,
    };
  } catch (error) {
    documentRecord.status = 'error';
    await documentRecord.save();
    throw error;
  } finally {
    await fs.unlink(file.path).catch(() => undefined);
  }
}
