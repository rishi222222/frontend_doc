const User = require('../models/User');
const { AppError } = require('../utils/AppError');
const { ACCESS_COOKIE, verifyAccessToken } = require('../services/tokenService');

function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.query?.token) return String(req.query.token);
  return req.cookies?.[ACCESS_COOKIE];
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError(401, 'Access token expired', 'TOKEN_EXPIRED');
      }
      throw new AppError(401, 'Invalid access token', 'INVALID_TOKEN');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new AppError(401, 'Account is inactive or does not exist', 'INACTIVE');
    }
    if (user.tokenVersion !== payload.tv) {
      throw new AppError(401, 'Session revoked', 'REVOKED');
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError(403, 'Administrator access required', 'FORBIDDEN'));
  }
  next();
}

module.exports = { authenticate, requireAdmin, extractToken };
