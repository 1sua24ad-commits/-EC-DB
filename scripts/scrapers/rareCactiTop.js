import * as cheerio from 'cheerio';
import { fetchText } from './httpClient.js';

export const id = 'rare-cacti-top';
export const name = 'Rare Cacti Top';
const BASE_URL = 'https://www.rarecactitop.com';

function parseEuroPrice(text) {
  if (!text) return null;
  const match = text.match(/([\d.,]+)\s*€/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

async function getActiveCategoryPaths() {
  const html = await fetchText(`${BASE_URL}/en/`);
  const $ = cheerio.load(html);
  const paths = [];

  $('#menu-left a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).find('span').text();
    if (!href) return;

    const countMatch = text.match(/\((\d+)\)\s*$/);
    const count = countMatch ? Number(countMatch[1]) : 0;
    // 過去のシーズン分をまとめた「SOLD OUT」アーカイブは対象外(現在購入不可のため)
    if (count === 0 || /sold-out/i.test(href)) return;

    paths.push(href);
  });

  return paths;
}

export async function scrape() {
  const categoryPaths = await getActiveCategoryPaths();
  const items = [];

  for (const categoryPath of categoryPaths) {
    const url = new URL(categoryPath, BASE_URL);
    url.searchParams.set('c', 'all'); // 1ページに全件表示するオプション
    const html = await fetchText(url.toString());
    const $ = cheerio.load(html);

    $('.product-box').each((_, el) => {
      const $el = $(el);
      const $link = $el.find('h2 a').first();
      const productName = $link.text().trim();
      if (!productName) return;

      const href = $link.attr('href');
      const availabilityText = $el.find('p').first().text();

      items.push({
        productName,
        matchText: productName,
        price: parseEuroPrice($el.find('.cena').text()),
        currency: 'EUR',
        inStock: /on\s*stock/i.test(availabilityText) ? true : null,
        productUrl: href ? new URL(href, BASE_URL).toString() : url.toString(),
        imageUrl: $el.find('img').first().attr('src')
          ? new URL($el.find('img').first().attr('src'), BASE_URL).toString()
          : null,
        rawData: null,
      });
    });
  }

  return items;
}
