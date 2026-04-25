export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Placeholder embedding implementation for Week 1 scaffolding.
  // Replace this with Gemini/OpenAI embedding calls once credentials are wired.
  return Array.from({ length: 1536 }, (_value, index) => (index % 10) / 10);
}
