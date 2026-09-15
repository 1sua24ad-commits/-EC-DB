import * as cheerio from 'cheerio';
import { fetchText } from './httpClient.js';

const MAX_PAGES = 100; // 安全弁。実際のページ数は<link rel="next">が尽きた時点で止まる

function availabilityToInStock(value) {
  if (!value) return null;
  if (value.includes('InStock')) return true;
  if (value.includes('OutOfStock')) return false;
  return null;
}

/**
 * Shoptet(チェコの主要ECプラットフォーム)向けの共通スクレイパー。
 * Malej Jarda・Kakteen.cz など、同一基盤の複数サイトで使い回す。
 * @param {{ id: string, name: string, baseUrl: string, startPath: string }} config
 */
export function createShoptetScraper({ id, name, baseUrl, startPath }) {
  async function scrape() {
    const items = [];
    let path = startPath;

    for (let page = 0; page < MAX_PAGES && path; page++) {
      console.log(`  [${id}] fetching page ${page + 1}: ${baseUrl}${path}`);
      const html = await fetchText(`${baseUrl}${path}`);
      const $ = cheerio.load(html);

      $('.p[data-micro="product"]').each((_, el) => {
        const $el = $(el);
        const productName = $el.find('[data-micro="name"]').first().text().trim();
        if (!productName) return;

        const href = $el.find('a.name').first().attr('href');
        const $offer = $el.find('[data-micro="offer"]').first();
        const priceRaw = $offer.attr('data-micro-price');

        items.push({
          productName,
          matchText: productName,
          price: priceRaw != null ? Number(priceRaw) : null,
          currency: $offer.attr('data-micro-price-currency') || null,
          inStock: availabilityToInStock($offer.attr('data-micro-availability')),
          productUrl: href ? new URL(href, baseUrl).toString() : `${baseUrl}${path}`,
          imageUrl: $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || null,
          rawData: { productId: $el.attr('data-micro-product-id') || null },
        });
      });

      const nextHref = $('link[rel="next"]').attr('href');
      path = nextHref || null;
    }

    return items;
  }

  return { id, name, scrape };
}
