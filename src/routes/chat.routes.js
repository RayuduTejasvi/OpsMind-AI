import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { clearChatSession, getChatHistory, processChatQuery } from '../services/chat.service.js';

export const chatRouter = Router();

chatRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const { query, session_id: sessionIdFromBody, sessionId } = request.body || {};
    const result = await processChatQuery({
      user: request.user,
      query,
      sessionId: sessionIdFromBody || sessionId,
    });

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    const words = result.answer.split(/\s+/).filter(Boolean);
    for (const word of words) {
      response.write(`event: token\n`);
      response.write(`data: ${JSON.stringify({ text: `${word} ` })}\n\n`);
    }

    for (const citation of result.citations) {
      response.write('event: citation\n');
      response.write(`data: ${JSON.stringify(citation)}\n\n`);
    }

    response.write('event: done\n');
    response.write(`data: ${JSON.stringify({ session_id: result.sessionId, total_tokens: result.totalTokens })}\n\n`);
    response.end();
  } catch (error) {
    return next(error);
  }
});

chatRouter.get('/history', requireAuth, async (request, response, next) => {
  try {
    const history = await getChatHistory(request.user._id);
    return response.json({ sessions: history });
  } catch (error) {
    return next(error);
  }
});

chatRouter.delete('/history/:session_id', requireAuth, async (request, response, next) => {
  try {
    const deleted = await clearChatSession(request.user._id, request.params.session_id);
    if (!deleted) {
      return response.status(404).json({ message: 'Session not found' });
    }

    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});
