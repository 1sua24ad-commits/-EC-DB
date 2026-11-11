import { fetchText, fetchArrayBuffer } from './httpClient.js';
import { parseSeedlistWorkbook } from './xlsxSeedlist.js';

export const id = 'cactus-hobby';
export const name = 'Cactus Hobby';
const BASE_URL = 'https://www.cactus-hobby.eu';
// トップページに「Katalog 2026」のようにその年の価格表(xlsx)へのリンクが掲載される。
// 年末(例: 2026年は12/31締切)にしか注文を受け付けないため、時期によってはリンク自体が無い。
const CATALOG_PAGE = `${BASE_URL}/`;

// robots.txtは/wp-admin/のみを禁止しており、トップページと/wp-content/uploads/配下の
// 価格表ファイルは対象外(2026-11時点で確認済み)。
async function findXlsxUrls() {
  const html = await fetchText(CATALOG_PAGE);
  const matches = [...html.matchAll(/href="([^"]+?\.xlsx)"/gi)];
  return [...new Set(matches.map((m) => new URL(m[1], BASE_URL).toString()))];
}

export async function scrape() {
  const xlsxUrls = await findXlsxUrls();
  if (xlsxUrls.length === 0) {
    // 受付期間外は価格表が掲載されないため、エラーにせず0件として扱う
    console.log('  価格表(xlsx)のリンクが見つかりませんでした(注文受付期間外の可能性があります)');
    return [];
  }

  const items = [];
  for (const xlsxUrl of xlsxUrls) {
    const buffer = await fetchArrayBuffer(xlsxUrl);
    // 価格列の見出しは「Price per portion」で通貨の記載が無いが、サイトの注文案内
    // (最低注文額250 Kč、送料もKč建て)からチェコ・コルナ建てと判断できる(2026-11確認)。
    const rows = parseSeedlistWorkbook(buffer, { pricePattern: /price per portion/i, priceCurrency: 'CZK' });

    for (const row of rows) {
      const fieldNumber = String(row.row['Field number'] ?? '').trim();
      const seeds = row.row['Seeds per portion'];
      const productName = [row.genus, row.speciesDescription, fieldNumber, seeds ? `(${seeds} seeds)` : '']
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      items.push({
        productName,
        matchText: row.matchText,
        price: row.price,
        currency: row.currency,
        inStock: null, // 在庫表記が無いため不明として扱う
        productUrl: `${xlsxUrl}#${encodeURIComponent(row.code)}`,
        imageUrl: null,
        rawData: { code: row.code, fieldNumber: fieldNumber || null, seedsPerPortion: seeds || null, locality: row.row.Locality || null, sourceFile: xlsxUrl },
      });
    }
  }

  return items;
}
