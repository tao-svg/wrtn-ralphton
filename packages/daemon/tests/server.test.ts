import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

function buildApp(
  registerRoutes?: (app: import('express').Application) => void,
) {
  return createServer({ logger: silentLogger, registerRoutes });
}

describe('createServer', () => {
  it('GET /healthz returns 200 with status ok', async () => {
    const app = buildApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 JSON for an unknown route', async () => {
    const app = buildApp();
    const res = await request(app).get('/no-such-route-here');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('returns 400 validation_error with details when a handler forwards a ZodError', async () => {
    const app = buildApp((a) => {
      a.get('/__test/zod', (_req, _res, next) => {
        try {
          z.object({ x: z.string() }).parse({});
        } catch (err) {
          next(err);
        }
      });
    });
    const res = await request(app).get('/__test/zod');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('returns 500 internal_server_error for an unknown thrown error', async () => {
    const app = buildApp((a) => {
      a.get('/__test/boom', (_req, _res, next) => {
        next(new Error('boom'));
      });
    });
    const res = await request(app).get('/__test/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal_server_error' });
  });

  it('parses JSON request bodies (application/json)', async () => {
    const app = buildApp((a) => {
      a.post('/__test/echo', (req, res) => {
        res.status(200).json({ received: req.body });
      });
    });
    const res = await request(app)
      .post('/__test/echo')
      .send({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: { hello: 'world' } });
  });
});
