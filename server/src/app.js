const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { requestId } = require('./middleware/requestId');
const { csrfProtection } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const documentRoutes = require('./routes/documentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const statsRoutes = require('./routes/statsRoutes');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Universal CORS middleware - runs first for all requests and preflights
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Refresh-Token, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(requestId);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: process.env.NODE_ENV === 'test' ? 10000 : 600,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.use(csrfProtection);

  // Health checks with version marker to verify deployment status
  const healthHandler = (req, res) =>
    res.json({ ok: true, version: '2.0.0', deployedAt: 'latest', timestamp: new Date().toISOString() });
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Mount routes with and without /api prefix
  app.use('/auth', authRoutes);
  app.use('/api/auth', authRoutes);

  app.use('/users', userRoutes);
  app.use('/api/users', userRoutes);

  app.use('/documents', documentRoutes);
  app.use('/api/documents', documentRoutes);

  app.use('/audit-logs', auditRoutes);
  app.use('/api/audit-logs', auditRoutes);

  app.use('/stats', statsRoutes);
  app.use('/api/stats', statsRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
