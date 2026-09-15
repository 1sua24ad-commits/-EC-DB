import { fetchText, fetchArrayBuffer } from './httpClient.js';
import { parseSeedlistWorkbook } from './xlsxSeedlist.js';

export const id = 'cactus-moravia';
export const name = 'Cactus Moravia';
const BASE_URL = 'https://cactus-moravia.eu';
const CATALOG_PAGE = `${BASE_URL}/seeds-catalog-for-orders/`;

// robots.txtは過去シーズンのアーカイブ済みファイル(/wp-content/uploads/_pda/...)のみを
// 禁止しており、カタログページに掲載されている「現行シーズンの」xlsxは対象外。
async function findXlsxUrls() {
  const html = await fetchText(CATALOG_PAGE);
  const matches = [...html.matchAll(/href="(https?:\/\/[^"]+?\.xlsx)"/gi)];
  return [...new Set(matches.map((m) => m[1]))];
}

export async function scrape() {
  const xlsxUrls = await findXlsxUrls();
  const items = [];

  for (const xlsxUrl of xlsxUrls) {
    const buffer = await fetchArrayBuffer(xlsxUrl);
    const rows = parseSeedlistWorkbook(buffer);

    for (const row of rows) {
      const productName = `${row.genus} ${row.speciesDescription}`.replace(/\s+/g, ' ').trim();
      items.push({
        productName,
        matchText: row.matchText,
        price: row.price,
        currency: row.currency,
        inStock: null, // 在庫表記が無いため不明として扱う
        productUrl: `${xlsxUrl}#${encodeURIComponent(row.code)}`,
        imageUrl: null,
        rawData: { code: row.code, sourceFile: xlsxUrl },
      });
    }
  }

  return items;
}
