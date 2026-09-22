import assert from 'node:assert/strict';
import test from 'node:test';

import { latestTag } from '../latest-harness-tag.mjs';

const refs = (...names) => names.map((name, i) => `${String(i).repeat(40)}\trefs/tags/${name}`);

test('ignores refs that are not v<major>.<minor>.<patch>', () => {
  const lines = refs('v0.11.0', 'v0.11.1-rc.1', 'nightly', 'v0.11.1', 'v0.11.1^{}');
  assert.equal(latestTag(lines), 'v0.11.1');
});

test('sorts numerically, not lexically', () => {
  assert.equal(latestTag(refs('v0.9.0', 'v0.10.0')), 'v0.10.0');
  assert.equal(latestTag(refs('v0.11.9', 'v0.11.10')), 'v0.11.10');
  assert.equal(latestTag(refs('v1.0.0', 'v0.99.99')), 'v1.0.0');
});

test('returns null for an empty list', () => {
  assert.equal(latestTag([]), null);
  assert.equal(latestTag(['', '   ']), null);
});
