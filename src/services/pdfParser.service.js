import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);

  return {
    text: parsed.text || '',
    pageCount: parsed.numpages || 0,
  };
}
