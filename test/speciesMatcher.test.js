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

test('#13 属の分割で旧属名になった学名がWFO由来シノニムでマッチする', () => {
  // CITESの Turbinicarpus mandragora は、WFOでは Rapicactus mandragora が現行名。
  // Koehresのような古いサイトは Gymnocactus mandragora 名義で販売している。
  // どちらの表記でも同一の保護種として確定マッチしなければならない。
  for (const name of ['Gymnocactus mandragora', 'Rapicactus mandragora']) {
    const result = matchSpecies(name, db);
    assert.equal(result.status, 'confirmed', name);
    assert.equal(result.citesAppendix, 'I', name);
  }
});

test('#14 近年の属移動(Escobaria→Pelecyphora)もマッチする', () => {
  // CITES/IUCNの学名(Escobaria minima)より新しいWFOの現行名。
  // CITESのシノニム欄には無く、WFO索引を取り込んで初めて拾えるようになった。
  const result = matchSpecies('Pelecyphora minima', db);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.matchLevel, 'species');
});

test('#15 WFO取り込み後も親種名単体は保護種扱いされない', () => {
  // WFOは Pediocactus simpsonii var. bradyi を bradyi のシノニムとして持つ。
  // これを二名式に潰して登録すると、非保護の普通種 Pediocactus simpsonii が
  // 保護種として誤検出される(#11の不具合の再発)。3語のまま保持する設計の回帰テスト。
  const result = matchSpecies('Pediocactus simpsonii', db);
  assert.equal(result.status, 'none');
});
