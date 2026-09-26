import assert from 'node:assert/strict';
import test from 'node:test';
import { CANONICAL_HOST, ROUTING_FUNCTION_CODE } from './routing-function.js';

type Field = { value: string; multiValue?: { value: string }[] };
type Request = { uri: string; headers: Record<string, Field>; querystring: Record<string, Field> };

// Evaluates the exact source CloudFront runs, so the test and the deployed function cannot drift.
const handler = new Function(`${ROUTING_FUNCTION_CODE}\nreturn handler;`)() as (event: unknown) => any;

const run = (host: string | null, uri: string, querystring: Record<string, Field> = {}) => {
  const headers: Record<string, Field> = host === null ? {} : { host: { value: host } };
  const request: Request = { uri, headers, querystring };
  return handler({ version: '1.0', request });
};

test('the apex is canonical', () => {
  assert.equal(CANONICAL_HOST, 'model-citizen.dev');
});

for (const host of ['agent-harness.jakeselby.com', 'www.model-citizen.dev', 'd111111abcdef8.cloudfront.net']) {
  test(`${host} gets a 301 to the same path on the apex`, () => {
    const res = run(host, '/docs/');
    assert.equal(res.statusCode, 301);
    assert.equal(res.headers.location.value, 'https://model-citizen.dev/docs/');
  });
}

test('the root of an old host redirects to the root of the apex', () => {
  assert.equal(run('agent-harness.jakeselby.com', '/').headers.location.value, 'https://model-citizen.dev/');
});

test('the redirect keeps the path as sent, without adding index.html', () => {
  const res = run('www.model-citizen.dev', '/skills/plan-authoring');
  assert.equal(res.headers.location.value, 'https://model-citizen.dev/skills/plan-authoring');
});

test('the redirect carries the query string, repeated and empty values included', () => {
  const res = run('agent-harness.jakeselby.com', '/search/', {
    q: { value: 'plan%20mode' },
    tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] },
    empty: { value: '' },
  });
  assert.equal(res.headers.location.value, 'https://model-citizen.dev/search/?q=plan%20mode&tag=a&tag=b&empty=');
});

test('a request with no host header is redirected, never served', () => {
  assert.equal(run(null, '/').statusCode, 301);
});

test('the apex in any letter case passes through to the rewrite', () => {
  const res = run('Model-Citizen.DEV', '/docs/');
  assert.equal(res.statusCode, undefined);
  assert.equal(res.uri, '/docs/index.html');
});

test('the apex rewrites clean URLs and leaves files alone', () => {
  assert.equal(run('model-citizen.dev', '/').uri, '/index.html');
  assert.equal(run('model-citizen.dev', '/skills/plan-authoring').uri, '/skills/plan-authoring/index.html');
  assert.equal(run('model-citizen.dev', '/og.png').uri, '/og.png');
});

test('the apex keeps its query string on the request', () => {
  const qs = { q: { value: 'x' } };
  const res = run('model-citizen.dev', '/docs/', qs);
  assert.deepEqual(res.querystring, qs);
});
