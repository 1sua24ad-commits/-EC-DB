import { createShoptetScraper } from './shoptet.js';

export const { id, name, scrape } = createShoptetScraper({
  id: 'malej-jarda',
  name: 'Zahradnictví Malej Jarda',
  baseUrl: 'https://www.malej-jarda.cz',
  startPath: '/en/cacti-succulents/',
});
