import express from 'express';
import { authRouter } from './routes/auth.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { billingRouter } from './routes/billing.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/billing', billingRouter);

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use((error, _request, response, _next) => {
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    response.status(status).json({ message });
  });

  return app;
}
