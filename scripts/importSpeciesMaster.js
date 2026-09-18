import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDb } from './db.js';
import { extractSynonyms } from './lib/extractSynonyms.js';
import { loadWfoSynonymIndex } from './lib/wfoSynonyms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(__dirname, '..', 'data', 'source');

function readCsv(filename) {
  const raw = readFileSync(path.join(SOURCE_DIR, filename), 'utf8');
  return parse(raw, { columns: true, bom: true, skip_empty_lines: true, trim: true });
}

function upsertSpeciesMaster(db, record) {
  const existing = db.prepare('SELECT * FROM species_master WHERE scientific_name = ?').get(record.scientificName);

  if (!existing) {
    const info = db.prepare(`
      INSERT INTO species_master
        (scientific_name, genus, species, subspecies, family, rank, cites_appendix, iucn_category, iucn_taxon_id, source, updated_at)
      VALUES (@scientificName, @genus, @species, @subspecies, @family, @rank, @citesAppendix, @iucnCategory, @iucnTaxonId, @source, datetime('now'))
    `).run({
      scientificName: record.scientificName,
      genus: record.genus,
      species: record.species ?? null,
      subspecies: record.subspecies ?? null,
      family: record.family ?? 'Cactaceae',
      rank: record.rank,
      citesAppendix: record.citesAppendix ?? null,
      iucnCategory: record.iucnCategory ?? null,
      iucnTaxonId: record.iucnTaxonId ?? null,
      source: record.source,
    });
    return { id: info.lastInsertRowid, wasDuplicateInRun: false };
  }

  // 同一 scientific_name が既に存在する場合。
  // 同一ソース内の重複行(同一CSV内で同じ学名が複数回出現するケース)であっても、
  // ここでのUPDATEは常に同じ値で上書きするだけなので安全(idempotent)。
  const mergedSource = existing.source === record.source ? existing.source : 'BOTH';

  db.prepare(`
    UPDATE species_master SET
      cites_appendix = COALESCE(@citesAppendix, cites_appendix),
      iucn_category  = COALESCE(@iucnCategory, iucn_category),
      iucn_taxon_id  = COALESCE(@iucnTaxonId, iucn_taxon_id),
      subspecies     = COALESCE(@subspecies, subspecies),
      source         = @source,
      updated_at     = datetime('now')
    WHERE id = @id
  `).run({
    id: existing.id,
    citesAppendix: record.citesAppendix ?? null,
    iucnCategory: record.iucnCategory ?? null,
    iucnTaxonId: record.iucnTaxonId ?? null,
    subspecies: record.subspecies ?? null,
    source: mergedSource,
  });

  return { id: existing.id, wasDuplicateInRun: existing.source === record.source };
}

// CITES欄由来(「Genus species」形式)とWFO由来(全て小文字)で表記が揃わないと、
// UNIQUE制約をすり抜けて同じ学名が大小文字違いで二重登録される。
// 照合時は小文字化して突き合わせるため実害は無いが、データとしては
// 学名の標準的な表記(属名のみ大文字)に統一して保持する。
function normalizeSynonym(synonym) {
  const s = synonym.trim().replace(/\s+/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function insertSynonym(db, speciesId, synonym) {
  db.prepare('INSERT OR IGNORE INTO species_synonym (species_id, synonym) VALUES (?, ?)')
    .run(speciesId, normalizeSynonym(synonym));
}

function importIucn(db) {
  const assessments = readCsv('assessments.csv');
  const redlistByTaxonId = new Map();
  for (const row of assessments) {
    redlistByTaxonId.set(row.internalTaxonId, row.redlistCategory);
  }

  const taxonomy = readCsv('taxonomy.csv');
  const seenInThisFile = new Set();
  let duplicateCount = 0;

  for (const row of taxonomy) {
    const scientificName = row.scientificName;
    if (seenInThisFile.has(scientificName)) {
      duplicateCount++;
      console.warn(`[import:iucn] taxonomy.csv内で重複した学名を検出: "${scientificName}" (internalTaxonId=${row.internalTaxonId})`);
    }
    seenInThisFile.add(scientificName);

    const rank = row.speciesName ? 'SPECIES' : 'GENUS';

    upsertSpeciesMaster(db, {
      scientificName,
      genus: row.genusName,
      species: row.speciesName || null,
      subspecies: null,
      family: 'Cactaceae',
      rank,
      iucnCategory: redlistByTaxonId.get(row.internalTaxonId) ?? null,
      iucnTaxonId: row.internalTaxonId ? Number(row.internalTaxonId) : null,
      source: 'IUCN',
    });
  }

  return { rowCount: taxonomy.length, duplicateCount };
}

function importCites(db) {
  const cites = readCsv('Index_of_CITES_Species.csv');
  const seenInThisFile = new Set();
  let duplicateCount = 0;
  let synonymCount = 0;

  for (const row of cites) {
    const scientificName = row.FullName;
    if (seenInThisFile.has(scientificName)) {
      duplicateCount++;
      console.warn(`[import:cites] CITES CSV内で重複した学名を検出: "${scientificName}" (TaxonId=${row.TaxonId})`);
    }
    seenInThisFile.add(scientificName);

    const { id } = upsertSpeciesMaster(db, {
      scientificName,
      genus: row.Genus,
      species: row.Species || null,
      subspecies: row.Subspecies || null,
      family: 'Cactaceae',
      rank: row.RankName,
      citesAppendix: row.CurrentListing || null,
      source: 'CITES',
    });

    const synonyms = extractSynonyms(row.SynonymsWithAuthors);
    for (const synonym of synonyms) {
      insertSynonym(db, id, synonym);
      synonymCount++;
    }
  }

  return { rowCount: cites.length, duplicateCount, synonymCount };
}

/**
 * CITES CSVの著者名付きシノニム欄に加えて、World Flora Online (WFO) Plant Listの
 * Cactaceae学名索引からシノニムを補う。
 *
 * CITES欄由来のものは「著者名込みの文字列から正規表現で学名らしき部分を切り出す」
 * 方式のため取りこぼしが多く、実際174種中58種にしか付いていなかった。
 * WFOは属・種小名・識別語が列として分かれており、分類改訂による属の移動も
 * 正名⇔シノニムの関係として持っているため、はるかに正確かつ網羅的に補完できる。
 *
 * CITES側にしか無い表記ゆれ(綴り違い等)も実在するため、置き換えではなく統合する。
 */
function importWfoSynonyms(db) {
  const { findSynonyms } = loadWfoSynonymIndex();
  const species = db.prepare('SELECT id, genus, species, subspecies FROM species_master WHERE species IS NOT NULL').all();

  let speciesCount = 0;
  let synonymCount = 0;

  for (const row of species) {
    const name = [row.genus, row.species, row.subspecies].filter(Boolean).join(' ');
    const synonyms = findSynonyms(name);
    if (synonyms.length === 0) continue;

    speciesCount++;
    for (const synonym of synonyms) {
      insertSynonym(db, row.id, synonym);
      synonymCount++;
    }
  }

  return { speciesCount, synonymCount };
}

function printReport(db) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM species_master').get().n;

  const bySource = db.prepare(`
    SELECT source, COUNT(*) AS n FROM species_master GROUP BY source ORDER BY source
  `).all();

  const byRank = db.prepare(`
    SELECT rank, COUNT(*) AS n FROM species_master GROUP BY rank ORDER BY rank
  `).all();

  const bothSpecies = db.prepare(`
    SELECT scientific_name FROM species_master WHERE source = 'BOTH' ORDER BY scientific_name
  `).all();

  console.log('\n=== species_master 取り込み結果 ===');
  console.log(`総件数: ${total}`);
  console.log('source内訳:');
  for (const row of bySource) console.log(`  ${row.source}: ${row.n}`);
  console.log('rank内訳:');
  for (const row of byRank) console.log(`  ${row.rank}: ${row.n}`);
  console.log(`CITES・IUCN両方に該当する種(source='BOTH'): ${bothSpecies.length}件`);
  for (const row of bothSpecies) console.log(`  - ${row.scientific_name}`);
}

function main() {
  const db = openDb();

  // 再実行のたびに3CSVから species_master / species_synonym をクリーンに再構築する。
  // products.species_id は species_master(id) への外部キーなので、
  // species_master を作り直すと古いidの整合性が崩れる(再構築後は同じ学名でも
  // idが変わりうる)。products も合わせて空にし、scrape:products の再実行を促す。
  db.exec('DELETE FROM products; DELETE FROM species_synonym; DELETE FROM species_master;');

  const iucnResult = importIucn(db);
  console.log(`taxonomy.csv: ${iucnResult.rowCount}行読み込み(重複${iucnResult.duplicateCount}件)`);

  const citesResult = importCites(db);
  console.log(`CITES CSV: ${citesResult.rowCount}行読み込み(重複${citesResult.duplicateCount}件, シノニム${citesResult.synonymCount}件登録)`);

  const wfoResult = importWfoSynonyms(db);
  console.log(`WFO学名索引: ${wfoResult.speciesCount}種にシノニム${wfoResult.synonymCount}件を追加登録`);

  printReport(db);

  db.close();
}

main();
