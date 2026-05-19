import express from 'express';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';

export function createApp() {
  const app = express();
  // Log incoming requests to help diagnose proxy / routing issues
  app.use((req, _res, next) => {
    // Keep logs concise: method and url
    // eslint-disable-next-line no-console
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
