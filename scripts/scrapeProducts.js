import { openDb } from './db.js';
import { matchSpecies } from './lib/speciesMatcher.js';
import { normalizeName } from './lib/normalizeName.js';
import { getTargetGenera } from './lib/targetGenera.js';
import { sites } from './scrapers/siteRegistry.js';

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

function displayScientificName(matchText) {
  const parsed = normalizeName(matchText);
  if (!parsed || !parsed.genus) return null;
  return parsed.species
    ? `${capitalize(parsed.genus)} ${parsed.species}`
    : capitalize(parsed.genus);
}

function toInStockInt(inStock) {
  if (inStock === true) return 1;
  if (inStock === false) return 0;
  return null;
}

const upsertProductStmt = `
  INSERT INTO products
    (site_id, product_name, scientific_name, price, currency, in_stock, product_url, image_url, species_id, cites_appendix, match_status, last_checked_at, raw_data)
  VALUES
    (@siteId, @productName, @scientificName, @price, @currency, @inStock, @productUrl, @imageUrl, @speciesId, @citesAppendix, @matchStatus, datetime('now'), @rawData)
  ON CONFLICT(site_id, product_url) DO UPDATE SET
    product_name    = excluded.product_name,
    scientific_name = excluded.scientific_name,
    price           = excluded.price,
    currency        = excluded.currency,
    in_stock        = excluded.in_stock,
    image_url       = excluded.image_url,
    species_id      = excluded.species_id,
    cites_appendix  = excluded.cites_appendix,
    match_status    = excluded.match_status,
    last_checked_at = datetime('now'),
    raw_data        = excluded.raw_data
`;

function processSite(db, site, context) {
  const stmt = db.prepare(upsertProductStmt);
  const stats = { total: 0, confirmed: 0, needs_review: 0, none: 0, matches: [] };

  return site.scrape(context).then((items) => {
    for (const item of items) {
      const result = matchSpecies(item.matchText, db);
      stats.total++;
      stats[result.status]++;

      stmt.run({
        siteId: site.id,
        productName: item.productName,
        scientificName: displayScientificName(item.matchText),
        price: item.price,
        currency: item.currency,
        inStock: toInStockInt(item.inStock),
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
        speciesId: result.speciesId,
        citesAppendix: result.citesAppendix,
        matchStatus: result.status,
        rawData: JSON.stringify(item.rawData ?? null),
      });

      if (result.status === 'confirmed' || result.status === 'needs_review') {
        stats.matches.push({
          status: result.status,
          matchLevel: result.matchLevel,
          productName: item.productName,
          productUrl: item.productUrl,
        });
      }
    }
    return stats;
  });
}

async function main() {
  const db = openDb();
  const targetGenera = getTargetGenera(db);

  for (const site of sites) {
    console.log(`\n=== ${site.name} (${site.id}) ===`);
    try {
      const stats = await processSite(db, site, { targetGenera });
      console.log(`取得件数: ${stats.total}件 (confirmed: ${stats.confirmed}, needs_review: ${stats.needs_review}, none: ${stats.none})`);

      const confirmed = stats.matches.filter((m) => m.status === 'confirmed');
      const needsReview = stats.matches.filter((m) => m.status === 'needs_review');

      if (confirmed.length > 0) {
        console.log('保護種と確定マッチした商品:');
        for (const m of confirmed) console.log(`  [${m.matchLevel}] ${m.productName} -> ${m.productUrl}`);
      }
      if (needsReview.length > 0) {
        console.log('要確認(ファジーマッチ)の商品:');
        for (const m of needsReview) console.log(`  [${m.matchLevel}] ${m.productName} -> ${m.productUrl}`);
      }
    } catch (err) {
      console.error(`[${site.id}] スクレイピングに失敗しました:`, err.message);
    }
  }

  db.close();
}

main();
