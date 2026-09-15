import { fetchJson } from './httpClient.js';

export const id = 'hajek-cactus';
export const name = 'Hajek Cactus';
const BASE_URL = 'https://hajek-cactus.com';
const MAX_PAGES = 40; // 安全弁(通常のカタログ規模なら十分な上限)

// products.json のトップページに埋め込まれる Shopify.currency.active は
// 訪問者のIP等に応じて変動する「表示用」の値であり、実際に取得した回でも
// USD/JPYなど毎回異なる値が返ってきて信用できなかった(例: 同じ商品が
// あるときは「1.94 USD」、別のリクエストでは「561 JPY」のように見えてしまう)。
// 誤った通貨で金額を断定表示するリスクの方が「通貨不明」と表示するより
// 有害なため、ここでは通貨判定を行わずnullのままにする。
export async function scrape() {
  const currency = null;
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchJson(`${BASE_URL}/products.json?limit=250&page=${page}`);
    const products = data.products ?? [];
    if (products.length === 0) break;

    for (const product of products) {
      const variant = product.variants?.[0];
      if (!variant) continue;

      items.push({
        productName: product.title,
        matchText: product.title,
        price: variant.price != null ? Number(variant.price) : null,
        currency,
        inStock: variant.available ?? null,
        productUrl: `${BASE_URL}/products/${product.handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        rawData: { shopifyProductId: product.id, shopifyVariantId: variant.id },
      });
    }
  }

  return items;
}
