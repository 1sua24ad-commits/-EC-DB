import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../scripts/db.js';
import { getTargetGenera } from '../scripts/lib/targetGenera.js';

let db;

before(() => {
  db = openDb();
});

after(() => {
  db.close();
});

test('#1 species_master の現行属名が対象に含まれる', () => {
  const genera = getTargetGenera(db);
  assert.ok(genera.has('turbinicarpus'));
});

test('#2 分類改訂で分かれた旧属名(シノニム由来)も対象に含まれる', () => {
  // Turbinicarpus mandragora は旧分類で Gymnocactus / Rapicactus 等として
  // 流通しており、Köhresのように属ごとにカテゴリページが分かれるサイトでは
  // これらの旧属名ページ自体がクロール対象から漏れると商品を一度も評価できない。
  const genera = getTargetGenera(db);
  assert.ok(genera.has('gymnocactus'));
  assert.ok(genera.has('rapicactus'));
});
