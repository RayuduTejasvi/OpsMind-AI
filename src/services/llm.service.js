const FALLBACK_MESSAGE = "I don't have information on this in the current knowledge base.";

function buildContext(chunks) {
  return chunks
    .map((chunk, index) => {
      const section = chunk.section || 'N/A';
      const page = chunk.page || 1;
      return `Chunk ${index + 1}\nSource: ${chunk.filename} | Page: ${page} | Section: ${section}\nContent: ${chunk.chunkText}`;
    })
    .join('\n\n');
}

function buildPrompt(query, chunks) {
  return [
    'You are OpsMind AI, a corporate SOP assistant.',
    'Answer ONLY from the provided SOP context.',
    `If context is insufficient, respond exactly with: ${FALLBACK_MESSAGE}`,
    'If you answer, include at least one source citation in this format:',
    'According to [filename], Page [X], Section [Y], ...',
    '',
    `Employee Question: ${query}`,
    '',
    'SOP Context:',
    buildContext(chunks),
  ].join('\n');
}

function deterministicFallback(chunks) {
  if (!chunks.length) {
    return FALLBACK_MESSAGE;
  }

  const top = chunks[0];
  const preview = top.chunkText.length > 500 ? `${top.chunkText.slice(0, 500)}...` : top.chunkText;
  const section = top.section || 'N/A';
  return `According to ${top.filename}, Page ${top.page || 1}, Section ${section}, ${preview}`;
}

function isGroundedAnswer(answer, chunks) {
  if (!answer || answer.trim() === FALLBACK_MESSAGE) {
    return true;
  }

  if (!/According to/i.test(answer)) {
    return false;
  }

  return chunks.some((chunk) => answer.includes(chunk.filename));
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return body?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return body?.choices?.[0]?.message?.content || null;
}

export async function generateGroundedAnswer({ query, chunks }) {
  if (!chunks.length) {
    return FALLBACK_MESSAGE;
  }

  const prompt = buildPrompt(query, chunks);

  let answer = await callGemini(prompt);
  if (!answer) {
    answer = await callGroq(prompt);
  }

  if (!answer || !isGroundedAnswer(answer, chunks)) {
    return deterministicFallback(chunks);
  }

  return answer.trim();
}

export { FALLBACK_MESSAGE };
