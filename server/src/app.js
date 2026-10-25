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

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (env.clientOrigins.includes('*') || env.clientOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (
      url.hostname.endsWith('.vercel.app') ||
      url.hostname.endsWith('.onrender.com') ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    ) {
      return true;
    }
  } catch {}
  return false;
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const corsOptions = {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Refresh-Token', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

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

  // Health checks
  const healthHandler = (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() });
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Mount routes with and without /api prefix to support various deployment configurations
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
