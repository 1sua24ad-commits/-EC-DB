import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDb } from './db.js';
import { siteNameById } from './scrapers/siteRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'public-data', 'species_master.json');

function main() {
  const db = openDb();

  const species = db.prepare(`
    SELECT id, scientific_name, genus, species, rank, cites_appendix, iucn_category, source
    FROM species_master
    ORDER BY scientific_name ASC
  `).all();

  const synonymsBySpeciesId = new Map();
  const synonymRows = db.prepare('SELECT species_id, synonym FROM species_synonym').all();
  for (const row of synonymRows) {
    if (!synonymsBySpeciesId.has(row.species_id)) synonymsBySpeciesId.set(row.species_id, []);
    synonymsBySpeciesId.get(row.species_id).push(row.synonym);
  }

  // 公開ページに載せるのは match_status = 'confirmed' の商品のみ。
  // needs_review(タイプミス等のファジーマッチ)は誤って「購入可能」と断定してしまう
  // リスクがあるため、ここでは載せず今後の手動レビュー対象として products テーブルに留める。
  //
  // また products は upsert のみで行を消さないため、販売終了品や前シーズンの価格表の商品が
  // 残り続ける。サイトごとに「最後に取得に成功した実行」で見つかった商品だけを載せるため、
  // そのサイトの最新 last_checked_at から6時間以内に確認された行に限定する
  // (取得に失敗したサイトは前回実行分がそのまま最新なので、前回のデータが残る)。
  const listingsBySpeciesId = new Map();
  const productRows = db.prepare(`
    SELECT p.species_id, p.site_id, p.product_name, p.price, p.currency, p.in_stock, p.product_url
    FROM products p
    JOIN (
      SELECT site_id, datetime(MAX(last_checked_at), '-6 hours') AS fresh_since
      FROM products
      GROUP BY site_id
    ) latest ON latest.site_id = p.site_id
    WHERE p.match_status = 'confirmed' AND p.species_id IS NOT NULL
      AND p.last_checked_at >= latest.fresh_since
    ORDER BY p.product_name ASC
  `).all();
  for (const row of productRows) {
    if (!listingsBySpeciesId.has(row.species_id)) listingsBySpeciesId.set(row.species_id, []);
    listingsBySpeciesId.get(row.species_id).push({
      siteId: row.site_id,
      siteName: siteNameById[row.site_id] ?? row.site_id,
      productName: row.product_name,
      price: row.price,
      currency: row.currency,
      inStock: row.in_stock === null ? null : Boolean(row.in_stock),
      productUrl: row.product_url,
    });
  }

  const output = species.map((row) => ({
    id: row.id,
    scientificName: row.scientific_name,
    genus: row.genus,
    species: row.species,
    rank: row.rank,
    citesAppendix: row.cites_appendix,
    iucnCategory: row.iucn_category,
    source: row.source,
    synonyms: synonymsBySpeciesId.get(row.id) ?? [],
    listings: listingsBySpeciesId.get(row.id) ?? [],
  }));

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  const speciesWithListings = output.filter((s) => s.listings.length > 0).length;
  const totalListings = output.reduce((sum, s) => sum + s.listings.length, 0);
  console.log(`書き出し完了: ${output.length}件 → ${OUTPUT_PATH}`);
  console.log(`購入可能サイト情報あり: ${speciesWithListings}種(のべ${totalListings}商品)`);

  db.close();
}

main();
