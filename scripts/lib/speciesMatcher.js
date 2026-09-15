import { distance } from 'fastest-levenshtein';
import { normalizeName } from './normalizeName.js';

const FUZZY_MAX_DISTANCE = 2; // 種小名の編集距離がこの値以下なら「似ている」とみなす

/**
 * @param {string} rawScientificName スクレイピングで取得した学名(生の文字列)
 * @param {import('better-sqlite3').Database} db better-sqlite3 のDBインスタンス
 * @returns {{
 *   status: 'confirmed' | 'needs_review' | 'none',
 *   matchLevel: 'species' | 'genus' | 'fuzzy' | null,
 *   speciesId: number | null,
 *   citesAppendix: string | null,
 *   iucnCategory: string | null
 * }}
 */
export function matchSpecies(rawScientificName, db) {
  const parsed = normalizeName(rawScientificName);
  if (!parsed || !parsed.genus) {
    return emptyResult();
  }

  // ① 完全一致(属+種小名で species_master と厳密一致)
  if (parsed.species) {
    const exact = db.prepare(`
      SELECT * FROM species_master
      WHERE lower(genus) = ? AND lower(species) = ?
    `).get(parsed.genus, parsed.species);
    if (exact) {
      return toResult(exact, 'confirmed', 'species');
    }
  }

  // ② シノニム一致
  // 完全一致(=)で照合する。前方一致(LIKE 'genus species%')にすると、
  // 例えば "Pediocactus bradyi" の亜種シノニム "Pediocactus simpsonii bradyi" に対して
  // 無関係な(非保護種の)"Pediocactus simpsonii" 単体の問い合わせが誤ってヒットしてしまう
  // (旧亜種名の先頭2語が、たまたま別の実在種の学名と一致するケース)。
  // 同じシノニム文字列が複数種にヒットする可能性はゼロではないため、
  // 全件取得したうえで学名のアルファベット順で決定的に1件選ぶ。
  if (parsed.species) {
    const bySynonym = db.prepare(`
      SELECT DISTINCT sm.* FROM species_synonym syn
      JOIN species_master sm ON sm.id = syn.species_id
      WHERE lower(syn.synonym) = ?
      ORDER BY sm.scientific_name ASC
    `).all(`${parsed.genus} ${parsed.species}`);
    if (bySynonym.length > 0) {
      return toResult(bySynonym[0], 'confirmed', 'species');
    }
  }

  // ②b 旧亜種名など「属名+識別語」が離れて出現するケースを拾う
  // 例: Pediocactus bradyi は旧分類では Pediocactus simpsonii の亜種として
  // "Pediocactus simpsonii bradyi" と呼ばれていた(3語シノニムとしてDBに保存済み)。
  // 通常の②(属+種小名の完全一致)では、真ん中に別種の種小名(simpsonii)が
  // 挟まるせいで一致しない。しかし商業サイトでは分類学的な改訂が反映されず、
  // 旧来の(親種+亜種名)表記がそのまま使われ続けることが多いため、
  // 「属名」と「シノニムの末尾語(亜種・変種などを区別する識別語)」の両方が
  // 単語として入力文字列に含まれていれば、種レベルの確定マッチとして拾う。
  // (逆に「属名+親種小名」だけで識別語が無い場合は、通常のPediocactus simpsonii
  //  のような無関係の種と区別がつかないため、あえてマッチさせない)
  if (parsed.genus) {
    const rawLower = rawScientificName.toLowerCase();
    if (new RegExp(`\\b${escapeRegExp(parsed.genus)}\\b`, 'i').test(rawLower)) {
      const genusSynonyms = db.prepare(`
        SELECT DISTINCT sm.*, syn.synonym FROM species_synonym syn
        JOIN species_master sm ON sm.id = syn.species_id
        WHERE lower(sm.genus) = ?
        ORDER BY sm.scientific_name ASC
      `).all(parsed.genus);

      for (const row of genusSynonyms) {
        const words = row.synonym.trim().split(/\s+/);
        if (words.length < 3) continue; // 属+種小名の2語は②で既にカバー済み
        const epithet = words[words.length - 1];
        if (new RegExp(`\\b${escapeRegExp(epithet)}\\b`, 'i').test(rawLower)) {
          return toResult(row, 'confirmed', 'species');
        }
      }
    }
  }

  // ③ 属単位のCITES登録(GENUS rank)に該当するか
  //    → 附属書I登録は「属内の全種」に及ぶため、種小名が違っても確定扱いにする
  const genusListing = db.prepare(`
    SELECT * FROM species_master WHERE rank = 'GENUS' AND lower(genus) = ?
  `).get(parsed.genus);
  if (genusListing) {
    return toResult(genusListing, 'confirmed', 'genus');
  }

  // ④ ファジーマッチ(同じ属の中で、種小名が編集距離FUZZY_MAX_DISTANCE以内)
  //    同点の場合は学名のアルファベット順で先頭のものを採用する。
  if (parsed.species) {
    const sameGenusSpecies = db.prepare(`
      SELECT * FROM species_master WHERE lower(genus) = ? AND species IS NOT NULL
      ORDER BY scientific_name ASC
    `).all(parsed.genus);
    let best = null;
    let bestDist = Infinity;
    for (const row of sameGenusSpecies) {
      const d = distance(parsed.species, row.species.toLowerCase());
      if (d < bestDist) { bestDist = d; best = row; }
    }
    if (best && bestDist <= FUZZY_MAX_DISTANCE) {
      return toResult(best, 'needs_review', 'fuzzy');
    }
  }

  return emptyResult();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emptyResult() {
  return { status: 'none', matchLevel: null, speciesId: null, citesAppendix: null, iucnCategory: null };
}

function toResult(row, status, matchLevel) {
  return {
    status,
    matchLevel,
    speciesId: row.id,
    citesAppendix: row.cites_appendix,
    iucnCategory: row.iucn_category,
  };
}
