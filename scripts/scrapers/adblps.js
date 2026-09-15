import * as cheerio from 'cheerio';
import { fetchText } from './httpClient.js';

export const id = 'adblps';
export const name = 'ADBLPS';
const BASE_URL = 'https://adblps-graines-cactus.com';
const LIST_URL = `${BASE_URL}/liste_graines.html`;

function parseEuroPrice(text) {
  if (!text) return null;
  const cleaned = text.replace('€', '').replace(',', '.').trim();
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export async function scrape() {
  const html = await fetchText(LIST_URL, { delayMs: 0 });
  const $ = cheerio.load(html);
  const items = [];

  $('tr.class_body_tr').each((_, row) => {
    const $row = $(row);
    const description = $row.find('td.class_td7').text().trim();
    if (!description) return;

    const priceText = $row.find('td.class_td3').text().trim();
    const refMatch = description.match(/\(ref\s+(\d+)\)/i);
    const productUrl = refMatch ? `${LIST_URL}#ref_${refMatch[1]}` : LIST_URL;

    items.push({
      productName: description,
      matchText: description,
      price: parseEuroPrice(priceText),
      currency: 'EUR',
      inStock: null, // 品目単位での在庫判定が困難なため不明として扱う
      productUrl,
      imageUrl: $row.find('td.class_td6 a').attr('href') || null,
      rawData: { ref: refMatch ? refMatch[1] : null },
    });
  });

  return items;
}
