import express from 'express';
import { adminRouter } from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/admin', adminRouter);

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
