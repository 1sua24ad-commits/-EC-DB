import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../scripts/db.js';
import { matchSpecies } from '../scripts/lib/speciesMatcher.js';

let db;

before(() => {
  db = openDb();
});

after(() => {
  db.close();
});

test('#1 完全一致(附属書I種)', () => {
  const result = matchSpecies('Ariocarpus agavoides', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
  assert.equal(result.citesAppendix, 'I');
});

test('#2 括弧内の著者名が正しく除去される', () => {
  const result = matchSpecies('Ariocarpus fissuratus (Engelmann) Schumann', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});

test('#3 属単位のCITES登録(GENUS)にマッチする', () => {
  const result = matchSpecies('Ariocarpus sp.', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'genus');
});

test('#4 シノニム表記からのマッチ', () => {
  const result = matchSpecies('Roseocactus fissuratus', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});

test('#5 タイプミスはファジーマッチでneeds_review', () => {
  // Ariocarpus属はGENUS単位でCITES登録されているため、Ariocarpus属のタイプミスは
  // ③(属単位マッチ)が④(ファジーマッチ)より先に確定してしまい、この検証はできない。
  // GENUS単位の登録がないSclerocactus属で検証する。
  const result = matchSpecies('Sclerocactus brevispinuss', db);
  assert.equal(result.status, 'needs_review');
  assert.equal(result.matchLevel, 'fuzzy');
});

test('#6 CITES・IUCN両方に掲載されている種はBOTH統合が反映される', () => {
  const result = matchSpecies('Discocactus hartmannii', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.citesAppendix, 'I');
  assert.equal(result.iucnCategory, 'Critically Endangered');
});

test('#7 変種表記(var.)は種レベルに畳み込まれてマッチする', () => {
  const result = matchSpecies('Ariocarpus retusus var. hintonii', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});

test('#8 附属書I・IUCN CRいずれにも該当しない種はnone', () => {
  const result = matchSpecies('Echinopsis pachanoi', db);
  assert.equal(result.status, 'none');
});

test('#9 空文字・nullは例外を投げずnoneを返す', () => {
  assert.doesNotThrow(() => matchSpecies('', db));
  assert.doesNotThrow(() => matchSpecies(null, db));
  assert.equal(matchSpecies('', db).status, 'none');
  assert.equal(matchSpecies(null, db).status, 'none');
});

test('#10 旧亜種名(属名+識別語が離れて出現)でもマッチする', () => {
  // Pediocactus bradyi は旧分類で "Pediocactus simpsonii bradyi"(P. simpsoniiの亜種)
  // と呼ばれていた。園芸店ではこの旧称がそのまま使われ続けることが多い。
  const result = matchSpecies('Pediocactus simpsonii bradyi PJR 123', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});

test('#11 識別語を伴わない親種名単体は誤って保護種扱いされない', () => {
  // "Pediocactus simpsonii" 単体は非保護種の普通種であり、
  // #10のシノニムに前方一致してconfirmedになってしまう不具合を過去に修正した。
  const result = matchSpecies('Pediocactus simpsonii', db);
  assert.equal(result.status, 'none');
});

test('#12 種小名の直後にスペース無しでカンマが続いてもマッチする', () => {
  // Wonderful Cactusの実データ: "Pediocactus knowltonii, small perennial plant, ..."
  // 種小名 "knowltonii," にカンマが直接くっついているとnormalizeNameが
  // species=null にしてしまい、①②④の判定が全てスキップされて
  // 保護種を見逃す不具合があった(③はPediocactus属がGENUS登録されていないため不成立)。
  const result = matchSpecies('Pediocactus knowltonii, small perennial plant, 5 seeds 2.5€', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});
