/**
 * World Flora Online (WFO) Plant List の Darwin Core Archive から、
 * Cactaceaeの学名索引(照合に必要な列だけ)を切り出して data/wfo_cactaceae_names.tsv に書き出す。
 *
 * 入力ファイルの入手手順はSETUP.mdを参照(Zenodo公開・CC0)。
 * 元データは全植物界で約166万行・908MBあるため、ストリームで読みながら
 * Cactaceaeの行だけを残す。
 *
 * 使い方: node scripts/buildWfoNames.js <classification.csv のパス>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';

const OUTPUT_COLUMNS = ['taxonID', 'genus', 'specificEpithet', 'infraspecificEpithet', 'taxonomicStatus', 'acceptedNameUsageID'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'wfo_cactaceae_names.tsv');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('使い方: node scripts/buildWfoNames.js <classification.csv のパス>');
    process.exit(1);
  }

  const out = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });
  out.write(`${OUTPUT_COLUMNS.join('\t')}\n`);

  // WFOのDwCは拡張子こそcsvだがタブ区切り。BOM付きのため bom:true が必須
  // (これが無いと先頭列 taxonID のキーが壊れ、シノニムの参照が全て解決できなくなる)。
  const parser = fs.createReadStream(inputPath).pipe(parse({
    delimiter: '\t',
    columns: true,
    quote: '"',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  }));

  let scanned = 0;
  let kept = 0;
  for await (const row of parser) {
    scanned++;
    if (row.family !== 'Cactaceae') continue;
    out.write(`${OUTPUT_COLUMNS.map((c) => (row[c] ?? '').replace(/[\t\n\r]/g, ' ')).join('\t')}\n`);
    kept++;
  }
  await new Promise((resolve) => out.end(resolve));

  console.log(`走査 ${scanned}行 → Cactaceae ${kept}行を ${OUTPUT_PATH} に書き出しました`);
}

main();
