// api/server/routes/agents/__tests__/chat.endpoint-guard.test.js
const request = require('supertest');
const express = require('express');

jest.mock('~/server/middleware', () => ({
  moderateText: (req, res, next) => next(),
  validateConvoAccess: (req, res, next) => next(),
  buildEndpointOption: (req, res, next) => next(),
  canAccessAgentFromBody: () => (req, res, next) => next(),
}));
jest.mock('@librechat/api', () => ({
  generateCheckAccess: () => (req, res, next) => next(),
  skipAgentCheck: false,
}));
jest.mock('librechat-data-provider', () => ({
  PermissionTypes: {},
  Permissions: {},
  PermissionBits: { VIEW: 1 },
}));
jest.mock('~/server/services/Endpoints/agents', () => ({ initializeClient: jest.fn() }));
jest.mock('~/server/controllers/agents/request', () => jest.fn((req, res) => res.status(200).json({ ok: true })));
jest.mock('~/server/services/Endpoints/agents/title', () => jest.fn());
jest.mock('~/models', () => ({ getRoleByName: jest.fn() }));

const chat = require('../chat');

const app = express();
app.use(express.json());
app.use('/', chat);

describe('endpoint guard', () => {
  it('returns 403 for non-custom endpoint openAI', async () => {
    const res = await request(app).post('/openAI').send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 for anthropic endpoint', async () => {
    const res = await request(app).post('/anthropic').send({});
    expect(res.status).toBe(403);
  });

  it('passes through for custom endpoint', async () => {
    const res = await request(app).post('/custom').send({});
    expect(res.status).toBe(200);
  });
});
