import { fetchText } from './httpClient.js';

export const id = 'succseed';
export const name = 'SuccSeed';
const BASE_URL = 'https://www.succseed.com';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

// このサイト(Abicart)の商品データは /backend/jsonrpc/v1 からしか取得できないが、
// そのパスは robots.txt で明示的に禁止されている。ヘッドレスブラウザで描画しても
// 同じ禁止パスを自動で踏むことになるため、APIは使わない。
//
// 一方 robots.txt は `Allow: /` に加えて sitemap.xml を自ら案内しており、
// そのサイトマップは商品ページを1件ずつ列挙している。URL自体に学名が含まれる
// (例: /en/seeds-cacti/echinopsis/echinopsis-ayopayana-tb-7973-leque-3371m-...html)
// ため、「どの保護種を扱っているか」はサイトマップだけで判定できる。
// 商品ページ本体はJSのみのSPAシェル(商品名も価格も含まれない)なので取得しない。
// 結果として相手サーバーへのリクエストはサイトマップの数件のみで済む。
//
// ただし価格・在庫は禁止パスからしか得られないため null のままとする
// (フロントエンドでは「価格不明 / 在庫不明」と表示され、購入可能とは断定されない)。
const PRODUCT_URL_RE = /^https:\/\/www\.succseed\.com\/en\/([^/]+)\/([^/]+)\/([^/]+)\.html$/;

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
}

/**
 * スラッグを学名照合用のテキストに戻す。
 * 苗(種子ではなく現物)の商品は学名の前に "plantpflanze-" が付くため取り除く。
 */
function slugToText(slug) {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/^plantpflanze\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function scrape() {
  const indexXml = await fetchText(SITEMAP_URL);
  const urlsetUrls = extractLocs(indexXml);

  const pageUrls = [];
  for (const urlsetUrl of urlsetUrls) {
    const xml = await fetchText(urlsetUrl);
    pageUrls.push(...extractLocs(xml));
  }

  const items = [];
  for (const url of pageUrls) {
    // スウェーデン語・ドイツ語版は同一商品の別URLなので、英語版だけを対象にする
    const match = PRODUCT_URL_RE.exec(url);
    if (!match) continue;

    const [, category, , slug] = match;
    const text = slugToText(slug);
    if (!text) continue;

    items.push({
      productName: text.charAt(0).toUpperCase() + text.slice(1),
      matchText: text,
      price: null,
      currency: null,
      inStock: null,
      productUrl: url,
      imageUrl: null,
      rawData: { source: 'sitemap', category },
    });
  }

  return items;
}
