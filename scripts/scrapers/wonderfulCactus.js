import { PDFParse } from 'pdf-parse';
import { fetchText, fetchArrayBuffer } from './httpClient.js';

export const id = 'wonderful-cactus';
export const name = 'Wonderful Cactus';
const BASE_URL = 'https://wonderfulcactus.com';

// PDFテキスト抽出時に混ざるノイズ行(ページ区切り・共通ヘッダー・注意書き内のリンク)。
const NOISE_LINE_PATTERNS = [
  /^--\s*\d+\s+of\s+\d+\s*--$/i, // "-- 12 of 185 --" のようなページ区切り
  /^Wonderfulcactus-SEEDS/i,
  /^https:\/\/drive\.google\.com/i,
];

async function findPdfUrl() {
  const html = await fetchText(`${BASE_URL}/`);
  const match = html.match(/href="(https?:\/\/[^"]+?\.pdf)"/i);
  if (!match) throw new Error('PDFカタログのリンクが見つかりませんでした');
  return match[1];
}

function isNoiseLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * PDFから抽出した生テキストを商品エントリ(「--」で始まる1行〜複数行のまとまり)に分割する。
 * PDFのレイアウト上、1商品が複数行に折り返されることが多いため、
 * 次の「--」開始行が出るまでを1エントリとして連結する。
 */
function groupIntoEntries(text) {
  const lines = text.split('\n').filter((line) => !isNoiseLine(line));
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (/^--/.test(line.trim())) {
      if (current) entries.push(current);
      current = line.trim();
    } else if (current) {
      current += ' ' + line.trim();
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * 1エントリのテキストを解析する。
 * 例: "--(sold out)(December.2024) Acanthocereus maculatus (Peniocereus), 5 seeds 2.25€"
 *     "--(June.2026) Backebergia militaris, La Pareja, Arteaga, Michoacan, Mex., 10 seeds 25€"
 *
 * 一部の「まとめ売り」区画(例: Lophophoraの産地別一覧、Trichocereusコレクション)は、
 * 個々の品目が"--"ではなく"18-"や"24.4-"のような番号付きで区切られており、
 * 本来の「--」単位のグルーピングでは複数の品目が1つのエントリに混ざってしまう。
 * その結果、区画の先頭が sold out でなくても、区画内の一部品目だけが
 * sold out ということがあり得る。個別の品目単位に安全に分割するのは
 * 現実的に困難なため、エントリ内のどこかに "(sold out)" が含まれていれば
 * 区画全体を安全側に倒して除外する(在庫ありと誤って断定するリスクを避けるため)。
 */
function parseEntry(entry) {
  const soldOut = /\(sold out\)/i.test(entry);
  let rest = entry.replace(/^--/, '').trim();
  rest = rest.replace(/^\(sold out\)/i, '').trim();

  // 先頭の "(Month.Year)" 形式の日付を取り除く(無い商品もある)
  rest = rest.replace(/^\([A-Za-z]+\.?\s*\d{4}\)\s*/, '').trim();
  if (!rest) return null;

  const priceMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*€/);
  const price = priceMatch ? Number(priceMatch[1].replace(',', '.')) : null;

  return { soldOut, description: rest, price };
}

export async function scrape() {
  const pdfUrl = await findPdfUrl();
  const buffer = await fetchArrayBuffer(pdfUrl, { delayMs: 0 });

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  const entries = groupIntoEntries(result.text);
  const items = [];

  entries.forEach((entry, index) => {
    const parsed = parseEntry(entry);
    if (!parsed || parsed.soldOut) return; // 売り切れ商品は除外

    items.push({
      productName: parsed.description,
      matchText: parsed.description,
      price: parsed.price,
      currency: 'EUR',
      inStock: true, // sold outでないことが明記されている商品のみ残しているため
      productUrl: `${pdfUrl}#entry-${index}`,
      imageUrl: null,
      rawData: null,
    });
  });

  return items;
}
