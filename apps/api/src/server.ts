// Maia LMS API server entrypoint
import { loadConfig } from './config.js';
import { initDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();

  console.log(`Starting Maia LMS API [${config.NODE_ENV}]`);

  // Initialize database and run any pending migrations
  const db = initDb(config.DATABASE_URL);
  runMigrations(db);

  const app = createApp(db, config);

  const server = app.listen(config.PORT, config.HOST, () => {
    console.log(`API server listening on http://${config.HOST}:${config.PORT}`);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      db.close();
      console.log('Server closed.');
      process.exit(0);
    });
    // Force exit after 10s if connections hang
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
