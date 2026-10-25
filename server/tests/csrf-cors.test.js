const request = require('supertest');
const { setupApp, teardownApp, createUser } = require('./helpers');

let app;
const password = 'Password123!@#';
const frontendOrigin = 'http://localhost:5173';

beforeAll(async () => {
  app = await setupApp();
}, 30000);

afterAll(async () => {
  await teardownApp();
}, 30000);

beforeEach(async () => {
  await require('../src/models/User').deleteMany({});
  await require('../src/models/RefreshToken').deleteMany({});
  await require('../src/models/Document').deleteMany({});
  await require('../src/models/DocumentPermission').deleteMany({});
  await require('../src/models/DocumentVersion').deleteMany({});
  await require('../src/models/AuditLog').deleteMany({});
});

test('login succeeds without a CSRF cookie or header', async () => {
  const user = await createUser({ email: 'login-csrf@company.com', password });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', frontendOrigin)
    .send({ email: user.email, password });
  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
  expect(res.body.csrfToken).toBeTruthy();
  expect(res.headers['access-control-allow-origin']).toBe(frontendOrigin);
  expect(res.headers['access-control-allow-credentials']).toBe('true');
});

test('login succeeds with a stale CSRF header and no matching cookie', async () => {
  const user = await createUser({ email: 'stale-csrf@company.com', password });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', frontendOrigin)
    .set('X-CSRF-Token', 'stale-from-previous-session')
    .send({ email: user.email, password });
  expect(res.status).toBe(200);
  expect(res.body.user.email).toBe(user.email);
});

test('cookie-authenticated mutating requests require a matching CSRF token', async () => {
  const user = await createUser({ email: 'cookie-csrf@company.com', password });
  const agent = request.agent(app);
  const loginRes = await agent.post('/api/auth/login').send({ email: user.email, password });
  expect(loginRes.status).toBe(200);
  const csrf = loginRes.body.csrfToken;

  const denied = await agent.post('/api/documents').field('title', 'No CSRF');
  expect(denied.status).toBe(403);
  expect(denied.body.error.code).toBe('CSRF');

  const wrong = await agent.post('/api/documents').set('X-CSRF-Token', 'not-the-cookie').field('title', 'Wrong CSRF');
  expect(wrong.status).toBe(403);

  const allowed = await agent
    .post('/api/documents')
    .set('X-CSRF-Token', csrf)
    .field('title', 'Policy')
    .field('description', 'Controlled')
    .field('visibility', 'private')
    .attach('file', Buffer.from('hello world file contents'), 'policy.txt');
  expect(allowed.status).toBe(201);
});

test('CORS preflight from the configured frontend origin allows credentials and CSRF header', async () => {
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', frontendOrigin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,authorization,x-csrf-token');
  expect(res.status).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe(frontendOrigin);
  expect(res.headers['access-control-allow-credentials']).toBe('true');
  expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-csrf-token');
});

test('CORS does not reflect an unknown origin', async () => {
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'POST');
  expect(res.headers['access-control-allow-origin']).toBeUndefined();
});
