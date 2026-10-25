const { AppError } = require('../utils/AppError');
const { CSRF_COOKIE } = require('../services/tokenService');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_EXEMPT_SUFFIXES = ['/auth/login', '/auth/refresh', '/auth/logout'];

function pathnameOf(req) {
  const raw = String(req.originalUrl || req.url || req.path || '');
  return raw.split('?')[0].replace(/\/+$/, '') || '/';
}

function isAuthExempt(req) {
  const path = pathnameOf(req);
  return AUTH_EXEMPT_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix));
}

function csrfProtection(req, res, next) {
  if (SAFE.has(req.method)) return next();
  if (isAuthExempt(req)) return next();
  if ((req.get('authorization') || '').startsWith('Bearer ')) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError(403, 'Invalid CSRF token', 'CSRF'));
  }
  next();
}

module.exports = { csrfProtection, isAuthExempt, pathnameOf };
