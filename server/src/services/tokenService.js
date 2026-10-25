const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const RefreshToken = require('../models/RefreshToken');
const { hashToken, randomToken, csrfToken } = require('../utils/crypto');

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, tv: user.tokenVersion },
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessExpires,
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, {
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });
}

function cookieOptions(maxAgeMs) {
  const sameSite = env.cookie.sameSite;
  const secure = sameSite === 'none' ? true : env.cookie.secure;
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
  };
}

async function issueRefreshToken(user, req) {
  const raw = randomToken();
  const days = 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(raw),
    expiresAt,
    userAgent: req?.get?.('user-agent') || '',
  });
  return raw;
}

async function rotateRefreshToken(raw, req) {
  const tokenHash = hashToken(raw);
  const existing = await RefreshToken.findOne({ tokenHash, revokedAt: { $exists: false } });
  if (!existing || existing.expiresAt < new Date()) {
    return null;
  }
  existing.revokedAt = new Date();
  await existing.save();
  return existing.userId;
}

async function revokeRefreshToken(raw) {
  if (!raw) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(raw) }, { revokedAt: new Date() });
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
}

function setAuthCookies(res, { accessToken, refreshToken, csrf }) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
  const csrfCookie = cookieOptions(7 * 24 * 60 * 60 * 1000);
  res.cookie(CSRF_COOKIE, csrf, {
    ...csrfCookie,
    httpOnly: false,
  });
}

function clearAuthCookies(res) {
  const opts = { ...cookieOptions(0), maxAge: 0 };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setAuthCookies,
  clearAuthCookies,
  csrfToken,
};
