import { randomUUID } from 'crypto';
import { User } from '../models/User.js';
import { retrieveRelevantChunks } from './retrieval.service.js';

const FALLBACK_MESSAGE = "I don't have information on this in the current knowledge base.";

function buildCitations(chunks) {
  return chunks.map((chunk) => ({
    filename: chunk.filename,
    page: chunk.page || 1,
    section: chunk.section || '',
  }));
}

function buildAnswer(chunks, query) {
  if (!chunks.length) {
    return FALLBACK_MESSAGE;
  }

  const top = chunks[0];
  const answerBody = top.chunkText.length > 500 ? `${top.chunkText.slice(0, 500)}...` : top.chunkText;

  return `According to ${top.filename}, Page ${top.page || 1}, Section ${top.section || 'N/A'}, ${answerBody}`;
}

function maybeResetDailyCounter(user) {
  const resetAt = user.queryResetAt ? new Date(user.queryResetAt) : new Date(0);
  const now = new Date();

  if (now >= resetAt) {
    user.queryCountToday = 0;
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    user.queryResetAt = tomorrow;
  }
}

function enforcePlanLimit(user) {
  if (user.planTier !== 'free') {
    return;
  }

  const freeTierLimit = Number(process.env.FREE_TIER_DAILY_LIMIT || 20);
  if (user.queryCountToday >= freeTierLimit) {
    const error = new Error('Daily query limit reached for free tier');
    error.statusCode = 429;
    throw error;
  }
}

async function saveChatMessage(userId, sessionId, role, content, citations = []) {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }

  const existingSession = user.chatHistory.find((session) => session.sessionId === sessionId);
  if (existingSession) {
    existingSession.messages.push({ role, content, citations, timestamp: new Date() });
  } else {
    user.chatHistory.push({
      sessionId,
      messages: [{ role, content, citations, timestamp: new Date() }],
    });
  }

  await user.save();
}

export async function processChatQuery({ user, query, sessionId }) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    const error = new Error('Query is required');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedQuery.length > 500) {
    const error = new Error('Query must be 500 characters or fewer');
    error.statusCode = 400;
    throw error;
  }

  maybeResetDailyCounter(user);
  enforcePlanLimit(user);

  const resolvedSessionId = sessionId || randomUUID();
  const chunks = await retrieveRelevantChunks(normalizedQuery, { limit: 5, scoreThreshold: 0.2 });
  const citations = buildCitations(chunks);
  const answer = buildAnswer(chunks, normalizedQuery);

  user.queryCountToday += 1;
  await user.save();

  await saveChatMessage(user._id, resolvedSessionId, 'user', normalizedQuery);
  await saveChatMessage(user._id, resolvedSessionId, 'assistant', answer, citations);

  return {
    sessionId: resolvedSessionId,
    answer,
    citations,
    totalTokens: answer.split(/\s+/).filter(Boolean).length,
  };
}

export async function getChatHistory(userId) {
  const user = await User.findById(userId).lean();
  return user?.chatHistory || [];
}

export async function clearChatSession(userId, sessionId) {
  const user = await User.findById(userId);
  if (!user) {
    return false;
  }

  const initialLength = user.chatHistory.length;
  user.chatHistory = user.chatHistory.filter((session) => session.sessionId !== sessionId);

  if (user.chatHistory.length === initialLength) {
    return false;
  }

  await user.save();
  return true;
}
