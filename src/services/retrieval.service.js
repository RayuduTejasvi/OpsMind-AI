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
  // If Atlas vector search is enabled, use a DB-side kNN for efficiency.
  if (String(process.env.USE_ATLAS_VECTOR_SEARCH).toLowerCase() === 'true') {
    try {
      // Use MongoDB Atlas $search with knnBeta when available. This stage
      // requires an Atlas Search index on the `vector` field.
      const pipeline = [
        {
          $search: {
            knnBeta: {
              vector: queryVector,
              path: 'vector',
              k: limit,
            },
          },
        },
        {
          $project: {
            chunkText: 1,
            page: 1,
            section: 1,
            filename: 1,
            score: { $meta: 'searchScore' },
          },
        },
      ];

      const results = await Embedding.aggregate(pipeline).allowDiskUse(true).exec();

      // Normalize score (searchScore is not a cosine; still filter by threshold)
      const filtered = (results || []).filter((r) => (r.score || 0) >= scoreThreshold).slice(0, limit);
      return filtered.map((r) => ({
        chunkText: r.chunkText,
        page: r.page,
        section: r.section,
        filename: r.filename,
        score: r.score,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Atlas vector search failed, falling back to local search:', error?.message || error);
      // fall through to local cosine-based search
    }
  }

  // Local in-process retrieval (fallback)
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
