import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';

const port = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  const app = createApp();
  app.listen(port, () => {
    console.log(`OpsMind AI API running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
