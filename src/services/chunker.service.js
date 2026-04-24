export function chunkText(text, chunkSize = 1000, overlap = 100) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalizedText.length) {
    let end = Math.min(start + chunkSize, normalizedText.length);

    if (end < normalizedText.length) {
      const sentenceBreak = normalizedText.lastIndexOf('. ', end);
      if (sentenceBreak > start + 200) {
        end = sentenceBreak + 1;
      }
    }

    const chunk = normalizedText.slice(start, end).trim();
    if (chunk) {
      chunks.push({
        chunkIndex: chunks.length,
        text: chunk,
        charStart: start,
        charEnd: end,
      });
    }

    if (end >= normalizedText.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks;
}
