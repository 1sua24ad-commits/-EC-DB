import { fetchText } from './httpClient.js';

export const id = 'kaktus-koehres';
export const name = 'Kaktus Köhres';
const BASE_URL = 'https://www.kaktus-koehres.de/shop';
const CATEGORY_ROOT = `${BASE_URL}/Kakteen-Samen---1.html`;

// 属ごとに1ページ(150属以上)という構造なので、全属を巡回すると負荷が大きい。
// species_master に登録済みの属だけを対象に絞り込むことで、
// 無関係なリクエストを避けつつ目的(保護種の在庫確認)を達成する。
async function getGenusPages() {
  const html = await fetchText(CATEGORY_ROOT);
  const linkRe = /href="(https:\/\/www\.kaktus-koehres\.de\/shop\/Kakteen-Samen\/[^"]+\.html)">([^<]+)<\/a>/g;
  return [...html.matchAll(linkRe)].map((m) => ({ url: m[1], genusName: m[2].trim() }));
}

function parseGermanPrice(segment) {
  const match = segment.match(/(\d+(?:\.\d{3})*),(\d{2})\s*EUR/);
  if (!match) return null;
  const intPart = match[1].replace(/\./g, '');
  return Number.parseFloat(`${intPart}.${match[2]}`);
}

export async function scrape(context = {}) {
  const targetGenera = context.targetGenera ?? null; // 小文字属名のSet。nullなら全属を対象
  const genusPages = await getGenusPages();
  const items = [];

  for (const { url, genusName } of genusPages) {
    if (targetGenera && !targetGenera.has(genusName.toLowerCase())) continue;

    const html = await fetchText(url);
    // "<strong ...>商品名</strong><em>(products_id)</em>" というマークアップから
    // 商品名とIDを抜き出す。テーブルの入れ子が崩れているためDOM解析ではなく
    // 正規表現でテキストとして扱う。
    const productRe = /<strong[^>]*>([^<]+)<\/strong><em>\((\d+)\)<\/em>/g;
    const matches = [...html.matchAll(productRe)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const productName = match[1].replace(/\s+/g, ' ').trim();
      const productId = match[2];
      if (!productName) continue;

      const segmentStart = match.index + match[0].length;
      const segmentEnd = i + 1 < matches.length ? matches[i + 1].index : segmentStart + 3000;
      const segment = html.slice(segmentStart, segmentEnd);

      items.push({
        productName,
        matchText: productName,
        price: parseGermanPrice(segment),
        currency: 'EUR',
        inStock: null, // 在庫表記が明確でないため不明として扱う
        productUrl: `${BASE_URL}/product_info.php?products_id=${productId}`,
        imageUrl: null,
        rawData: { productId },
      });
    }
  }

  return items;
}
