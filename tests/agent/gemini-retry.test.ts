import { describe, it, expect, vi, afterEach } from 'vitest';
import { callGemini, GeminiDailyQuotaExceededError, type AgentContext } from '@/lib/agent/gemini';

const context: AgentContext = {
  caseId: 'CASE001',
  customerMessage: 'My order arrived damaged.',
  previousActions: [],
  iteration: 1,
};

const validBody = {
  candidates: [{ content: { parts: [{ text: '{"tool":"get_policy","args":{"policy_type":"damaged_item"}}' }] } }],
};

describe('callGemini retry behaviour', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries a transient 5xx and then succeeds', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls < 3) return new Response('{}', { status: 503 });
      return new Response(JSON.stringify(validBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGemini(context);

    expect(result).toEqual({ tool: 'get_policy', args: { policy_type: 'damaged_item' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 20000);

  it('fails fast when the daily quota is exhausted instead of retrying', async () => {
    const dailyQuotaBody = JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message:
          "Quota exceeded for quota metric 'Generate Content API requests per day' and limit 'GenerateContentRequestsPerDayPerProjectPerModel-FreeTier'",
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' },
            ],
          },
        ],
      },
    });
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      return new Response(dailyQuotaBody, { status: 429 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(context)).rejects.toBeInstanceOf(GeminiDailyQuotaExceededError);
    expect(calls).toBe(1);
  });

  it('still retries a transient per-minute 429', async () => {
    const perMinuteBody = JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: "Quota exceeded for quota metric 'Generate Content API requests per minute'",
      },
    });
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls < 2) return new Response(perMinuteBody, { status: 429 });
      return new Response(JSON.stringify(validBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGemini(context);

    expect(result).toEqual({ tool: 'get_policy', args: { policy_type: 'damaged_item' } });
    expect(calls).toBe(2);
  }, 20000);

  it('does not retry a non-transient 4xx', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      return new Response('bad request', { status: 400 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(context)).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });
});
