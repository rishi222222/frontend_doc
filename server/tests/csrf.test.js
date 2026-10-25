const { isAuthExempt, pathnameOf } = require('../src/middleware/csrf');

test('pathname strips query string and trailing slash', () => {
  expect(pathnameOf({ originalUrl: '/api/auth/login/?x=1' })).toBe('/api/auth/login');
  expect(pathnameOf({ url: '/api/auth/login/' })).toBe('/api/auth/login');
});

test('login refresh and logout are CSRF-exempt even with path variants', () => {
  expect(isAuthExempt({ originalUrl: '/api/auth/login' })).toBe(true);
  expect(isAuthExempt({ originalUrl: '/api/auth/login/' })).toBe(true);
  expect(isAuthExempt({ originalUrl: '/auth/login' })).toBe(true);
  expect(isAuthExempt({ originalUrl: '/api/auth/refresh' })).toBe(true);
  expect(isAuthExempt({ originalUrl: '/api/auth/logout' })).toBe(true);
  expect(isAuthExempt({ originalUrl: '/api/documents' })).toBe(false);
});
