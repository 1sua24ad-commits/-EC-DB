import { PDFParse } from 'pdf-parse';
import { fetchText, fetchArrayBuffer } from './httpClient.js';

export const id = 'cact-cz';
export const name = 'Cact.cz (Chrudimský kaktusář)';
const BASE_URL = 'https://www.cact.cz';
const CATALOG_PAGE = `${BASE_URL}/semena-seeds-prodej-a15`;

// カタログ番号(例: "80.00", "6749.51")で始まる行を商品1件として扱う。
const PRODUCT_LINE_RE = /^(\d+(?:\.\d+)?)\s+(.*)$/;
// 価格は "22,-" のようにチェコ式(通貨記号なしのコンマ・ハイフン表記、CZK)で末尾に付く。
const PRICE_RE = /(\d+(?:[.,]\d+)?)\s*,-\s*$/;

async function findPdfUrl() {
  const html = await fetchText(CATALOG_PAGE);
  // ページには「現行カタログ」と「発注不可の過去アーカイブ」の2種類のPDFが
  // 混在しうるため、"アーカイブ"表記の無い最初のリンクを現行カタログとみなす。
  const match = html.match(/href="([^"]+?\.pdf)"/i);
  if (!match) throw new Error('カタログPDFのリンクが見つかりませんでした');
  return new URL(match[1], BASE_URL).toString();
}

/**
 * 見出し行(属名。旧属名がある場合は"GYMNOCACTUS (TURBINICARPUS)"のように
 * 括弧付きで併記される)かどうかを判定する。
 * 商品行は必ず数字(カタログ番号)で始まるため、数字で始まらずアルファベットを含み、
 * かつ全て大文字である行を見出しとみなせば商品行と衝突しない。
 */
function isGenusHeaderLine(line) {
  return /[A-ZÁ-ŽČĎĚŇŘŠŤŮŽ]/.test(line) && line === line.toUpperCase();
}

export async function scrape() {
  const pdfUrl = await findPdfUrl();
  const buffer = await fetchArrayBuffer(pdfUrl);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text.split('\n').map((l) => l.trim()).filter(Boolean);

  const items = [];
  let currentGenus = null;

  for (const line of lines) {
    if (isGenusHeaderLine(line)) {
      // 括弧内の旧属名/別名部分は除去し、見出しの主属名だけを残す
      // (旧属名自体は種小名と一緒にspecies_synonymへ既に登録済みのため、
      //  マッチング精度としてはどちらの属名を使っても差はない)。
      currentGenus = line.replace(/\(.*?\)/g, '').trim();
      continue;
    }
    if (!currentGenus) continue; // カタログ本文が始まる前の説明文中の行は無視

    const match = PRODUCT_LINE_RE.exec(line);
    if (!match) continue;

    const [, code, description] = match;
    const priceMatch = description.match(PRICE_RE);
    const price = priceMatch ? Number(priceMatch[1].replace(',', '.')) : null;
    const productName = `${currentGenus} ${description}`.replace(/\s+/g, ' ').trim();

    items.push({
      productName,
      matchText: productName,
      price,
      currency: 'CZK',
      inStock: null, // 在庫数量ではなく容量(粒数)表記のため在庫有無は不明として扱う
      productUrl: `${pdfUrl}#${code}`,
      imageUrl: null,
      rawData: { code },
    });
  }

  return items;
}
