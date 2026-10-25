const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requiredInProd(name, fallback) {
  const value = process.env[name] || fallback;
  if (process.env.NODE_ENV === 'production' && !process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const isProd = (process.env.NODE_ENV || 'development') === 'production';
const clientOrigins = parseOrigins(process.env.CLIENT_ORIGIN || 'http://localhost:5173');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5001),
  clientOrigin: clientOrigins[0] || 'http://localhost:5173',
  clientOrigins,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mohit_doc_viewer',
  jwt: {
    accessSecret: requiredInProd('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32chars!!'),
    refreshSecret: requiredInProd('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32chars!!'),
    issuer: process.env.JWT_ISSUER || 'mohit-doc-viewer',
    audience: process.env.JWT_AUDIENCE || 'mohit-doc-viewer-client',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE
      ? String(process.env.COOKIE_SECURE).toLowerCase() === 'true'
      : isProd,
    sameSite: (process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase(),
  },
  storage: {
    driver: 'mongodb',
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
  },
  seed: {
    adminEmail: (process.env.SEED_ADMIN_EMAIL || 'admin@company.com').toLowerCase(),
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123!@#',
    employeeEmail: (process.env.SEED_EMPLOYEE_EMAIL || 'employee@company.com').toLowerCase(),
    employeePassword: process.env.SEED_EMPLOYEE_PASSWORD || 'Employee123!@#',
  },
};

module.exports = { env };
