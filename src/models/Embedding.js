import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema(
  {
    docId: { type: mongoose.Schema.Types.ObjectId, ref: 'SopDocument', required: true },
    chunkId: { type: String, required: true },
    chunkText: { type: String, required: true },
    page: { type: Number, default: 1 },
    section: { type: String, default: '' },
    filename: { type: String, required: true },
    vector: { type: [Number], required: true },
    embeddingModel: { type: String, default: 'placeholder-1536' },
  },
  { timestamps: true }
);

embeddingSchema.index({ docId: 1 });
embeddingSchema.index({ chunkId: 1 });

export const Embedding = mongoose.model('Embedding', embeddingSchema);
