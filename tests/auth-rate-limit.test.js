import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('auth rate limit contract', () => {
  it('returns a standardized error after too many registration attempts', async () => {
    let response;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await request(app).post('/api/v1/auth/register').send({});
    }

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Limite de cadastros atingido. Tente novamente mais tarde.',
        details: [],
      },
    });
  });

  it('returns a standardized error after too many login attempts', async () => {
    let response;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app).post('/api/v1/auth/login').send({});
    }

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
        details: [],
      },
    });
  });
});
