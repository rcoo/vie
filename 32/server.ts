import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
}

async function startServer() {
  // Import application modules only after dotenv has loaded so seed/config code
  // always sees environment variables on first initialization.
  const [{ apiRouter }, { storage }] = await Promise.all([
    import('./server/routes.ts'),
    import('./server/db/storage.ts')
  ]);

  await storage.initialize();

  const app = express();
  const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
  const isProduction = isProductionRuntime();

  if (!Number.isFinite(PORT) || PORT <= 0 || PORT > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  app.disable('x-powered-by');
  if (isProduction) {
    // Required for correct client IPs when hosted behind Railway/Render/etc.
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use('/api/auth', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'cinevault',
      database: storage.getDatabaseStatus(),
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api', apiRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[CineVault] Vite middleware attached (development).');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log(`[CineVault] Serving production build from ${distPath}`);
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled request error:', err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: 'Internal server error.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 CineVault Server running at http://0.0.0.0:${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[CineVault] ${signal} received. Saving data and shutting down...`);
    server.close(async () => {
      try {
        await storage.close();
        process.exit(0);
      } catch (err) {
        console.error('[CineVault] Shutdown save failed:', err);
        process.exit(1);
      }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
