import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkText } from '../src/services/chunker.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sampleText = await fs.readFile(path.join(__dirname, 'sample.txt'), 'utf8').catch(() => {
    return 'Sample SOP text. This is only a placeholder for the Week 1 ingestion pipeline test.';
  });

  const chunks = chunkText(sampleText);
  console.log(JSON.stringify({ chunkCount: chunks.length, chunks }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
