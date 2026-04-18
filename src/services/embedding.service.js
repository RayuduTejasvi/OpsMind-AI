const DIMENSIONS = 1536;

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function normalizeVector(vector) {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return vector;
  }

  for (let i = 0; i < vector.length; i += 1) {
    vector[i] /= norm;
  }

  return vector;
}

export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const vector = Array.from({ length: DIMENSIONS }, () => 0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % DIMENSIONS;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return normalizeVector(vector);
}
