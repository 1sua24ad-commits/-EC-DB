import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PATH = path.join(ROOT, 'data', 'wfo_cactaceae_names.tsv');

/**
 * 学名を「属 + 種小名 + 識別語」の形に整える。
 *
 * 亜種・変種を親種の二名式に潰してはならない。潰すと別種同士が同一視され、
 * 例えば Pediocactus simpsonii var. bradyi(保護種bradyiの旧亜種名)が
 * "Pediocactus simpsonii"(非保護の普通種)として登録され、誤検出を招く。
 * 3語のまま保持しておけば、照合側の「属名+識別語の共起判定」が正しく扱える。
 */
function toName(row) {
  return [row.genus, row.specificEpithet, row.infraspecificEpithet]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();
}

/**
 * WFO Plant ListのCactaceae学名索引を読み込み、ある学名と「同一の分類群」として
 * 扱われている別名を引けるインデックスを返す。
 *
 * CITES/IUCNが採用する学名とWFOの現行学名は一致しないことがある
 * (例: CITESの Turbinicarpus mandragora は、WFOでは Rapicactus mandragora が現行名)。
 * そのため「入力名がシノニム側に回っている」場合も正名まで辿ってから、
 * その正名が束ねる別名を全て集める。
 */
export function loadWfoSynonymIndex(filePath = DEFAULT_PATH) {
  const rows = parse(fs.readFileSync(filePath, 'utf8'), {
    delimiter: '\t',
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  });

  const byId = new Map();
  const idsByName = new Map();
  const synonymsByAcceptedId = new Map();

  for (const row of rows) {
    byId.set(row.taxonID, row);

    const name = toName(row);
    if (name) {
      if (!idsByName.has(name)) idsByName.set(name, []);
      idsByName.get(name).push(row);
    }

    if (row.taxonomicStatus === 'Synonym' && row.acceptedNameUsageID) {
      if (!synonymsByAcceptedId.has(row.acceptedNameUsageID)) {
        synonymsByAcceptedId.set(row.acceptedNameUsageID, []);
      }
      synonymsByAcceptedId.get(row.acceptedNameUsageID).push(row);
    }
  }

  /**
   * @param {string} scientificName 「属 種小名」または「属 種小名 識別語」
   * @returns {string[]} 同一分類群の別名(入力名自身は含まない、全て小文字)
   */
  function findSynonyms(scientificName) {
    const name = scientificName.trim().toLowerCase().replace(/\s+/g, ' ');

    const acceptedIds = new Set();
    for (const row of idsByName.get(name) ?? []) {
      if (row.taxonomicStatus === 'Accepted') {
        acceptedIds.add(row.taxonID);
      } else if (row.acceptedNameUsageID && byId.has(row.acceptedNameUsageID)) {
        acceptedIds.add(row.acceptedNameUsageID);
      }
    }

    const names = new Set();
    for (const acceptedId of acceptedIds) {
      names.add(toName(byId.get(acceptedId)));
      for (const synonym of synonymsByAcceptedId.get(acceptedId) ?? []) {
        names.add(toName(synonym));
      }
    }
    names.delete(name);
    names.delete('');
    return [...names];
  }

  return { findSynonyms, nameCount: idsByName.size };
}
