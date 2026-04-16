import { Embedding } from '../models/Embedding.js';
import { generateEmbedding } from './embedding.service.js';

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveRelevantChunks(query, options = {}) {
  const limit = Number(options.limit || 5);
  const scoreThreshold = Number(options.scoreThreshold || 0.2);

  const queryVector = await generateEmbedding(query);
  const candidates = await Embedding.find({}, {
    chunkText: 1,
    page: 1,
    section: 1,
    filename: 1,
    vector: 1,
  }).lean();

  const ranked = candidates
    .map((candidate) => ({
      chunkText: candidate.chunkText,
      page: candidate.page,
      section: candidate.section,
      filename: candidate.filename,
      score: cosineSimilarity(queryVector, candidate.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((item) => item.score >= scoreThreshold);

  return ranked;
}
