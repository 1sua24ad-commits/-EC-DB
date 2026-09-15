import { createShoptetScraper } from './shoptet.js';

// Malej Jarda と同じ Shoptet 基盤(チェコのECプラットフォーム)のサイト。
// カテゴリ構造・HTMLマークアップが共通のため createShoptetScraper を使い回す。
export const { id, name, scrape } = createShoptetScraper({
  id: 'kakteen-cz',
  name: 'Kakteen.cz',
  baseUrl: 'https://www.kakteen.cz',
  startPath: '/kaktusy/',
});
