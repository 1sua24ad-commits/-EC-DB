import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSynonyms } from '../scripts/lib/extractSynonyms.js';

test('#1 ハイフンを含む種小名が途中で切られない', () => {
  // 修正前は "Coloradoa mesae" のように mesae-verdae が途中で切れていた
  const result = extractSynonyms('Coloradoa mesae-verdae Boissevain, Ferocactus mesae-verdae (Boissevain) N.P.Taylor');
  assert.ok(result.includes('Coloradoa mesae-verdae'));
  assert.ok(result.includes('Ferocactus mesae-verdae'));
  assert.ok(!result.includes('Coloradoa mesae'));
});

test('#2 著者名の断片("Fric ex"など)を学名として拾わない', () => {
  const result = extractSynonyms('Gymnocactus mandragora (Fric ex A.Berger) Backeb.');
  assert.ok(result.includes('Gymnocactus mandragora'));
  assert.ok(!result.some((s) => /\bex$/i.test(s)));
});

test('#3 "et al" を含む著者名も学名として拾わない', () => {
  const result = extractSynonyms('Discocactus bahiensis Britton & Rose, Buining et al. 1980');
  assert.ok(result.includes('Discocactus bahiensis'));
  assert.ok(!result.includes('Buining et al'));
});

test('#4 階級語(var./subsp.)は学名の一部として取り込まれない', () => {
  const result = extractSynonyms('Sclerocactus wetlandicus var. ilseae Hochstätter');
  assert.ok(!result.some((s) => /\bvar\b/i.test(s)));
});
