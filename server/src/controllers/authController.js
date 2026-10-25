const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { verifyPassword } = require('../utils/crypto');
const { toSafeUser } = require('../utils/sanitize');
const { logEvent } = require('../services/auditService');
const {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  csrfToken,
  REFRESH_COOKIE,
} = require('../services/tokenService');

async function attachSession(res, user, req) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, req);
  const csrf = csrfToken();
  setAuthCookies(res, { accessToken, refreshToken, csrf });
  return { accessToken, refreshToken, csrf };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    await logEvent({ action: 'auth.login.failure', details: { email }, req });
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    await logEvent({ actorId: user._id, action: 'auth.login.failure', details: { reason: 'inactive' }, req });
    throw new AppError(401, 'Account is deactivated', 'INACTIVE');
  }
  const tokens = await attachSession(res, user, req);
  await logEvent({ actorId: user._id, action: 'auth.login.success', req });
  res.json({
    user: toSafeUser(user),
    csrfToken: tokens.csrf,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || req.get('x-refresh-token');
  await revokeRefreshToken(raw);
  if (req.user) {
    await logEvent({ actorId: req.user._id, action: 'auth.logout', req });
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || req.get('x-refresh-token');
  if (!raw) throw new AppError(401, 'Refresh token missing', 'UNAUTHENTICATED');
  const userId = await rotateRefreshToken(raw, req);
  if (!userId) {
    clearAuthCookies(res);
    throw new AppError(401, 'Refresh token invalid', 'INVALID_TOKEN');
  }
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new AppError(401, 'Account is deactivated', 'INACTIVE');
  }
  const tokens = await attachSession(res, user, req);
  res.json({
    user: toSafeUser(user),
    csrfToken: tokens.csrf,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: toSafeUser(user) });
});

module.exports = { login, logout, refresh, me };
