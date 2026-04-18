import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createMockCheckout, createMockPortal } from '../services/billing.service.js';

export const billingRouter = Router();

billingRouter.post('/create-checkout', requireAuth, async (request, response) => {
  const { plan } = request.body || {};
  const payload = createMockCheckout({ userId: request.user._id, plan });
  response.json(payload);
});

billingRouter.post('/webhook', (request, response) => {
  response.status(200).json({ received: true, mode: 'mock' });
});

billingRouter.get('/portal', requireAuth, async (request, response) => {
  const payload = createMockPortal({ userId: request.user._id });
  response.json(payload);
});
