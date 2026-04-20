import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    page: { type: Number, default: 1 },
    section: { type: String, default: '' },
    charStart: { type: Number, required: true },
    charEnd: { type: Number, required: true },
  },
  { _id: false }
);

const sopDocumentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'indexed', 'error'], default: 'processing' },
    chunks: { type: [chunkSchema], default: [] },
  },
  { timestamps: true }
);

export const SopDocument = mongoose.model('SopDocument', sopDocumentSchema);
