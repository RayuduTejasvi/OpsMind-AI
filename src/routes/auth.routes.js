import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { loginUser, refreshAccessToken, registerUser, toPublicUser } from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post('/register', async (request, response, next) => {
  try {
    const { email, password, role } = request.body || {};
    const result = await registerUser({ email, password, role });
    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body || {};
    const result = await loginUser({ email, password });
    return response.json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      return response.status(400).json({ message: 'refreshToken is required' });
    }

    const result = await refreshAccessToken(refreshToken);
    return response.json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, async (request, response) => {
  response.json({ user: toPublicUser(request.user) });
});
