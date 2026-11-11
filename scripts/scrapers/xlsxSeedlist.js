import * as XLSX from 'xlsx';

/**
 * サボテン種苗業者が配布する「属・種・価格」形式のExcel価格表を共通の形に変換する。
 * ヘッダー行の位置や列順はシーズンごとに変わりうるため、ヘッダーの文言から
 * 列の役割(コード・属・種/変種の説明・EUR価格・CZK価格)を都度検出する。
 *
 * @param {ArrayBuffer} buffer
 * @param {{ pricePattern?: RegExp, priceCurrency?: string }} [options]
 *   ヘッダーに通貨表記が無い価格列を使う業者向け。EUR/CZK列が見つからない場合に限り、
 *   pricePatternに一致する列をpriceCurrency建ての価格として扱う(通貨は呼び出し側が根拠を持って指定する)。
 * @returns {Array<{ code: string, genus: string, speciesDescription: string, matchText: string, price: number|null, currency: string|null }>}
 */
export function parseSeedlistWorkbook(buffer, options = {}) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const items = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });

    const headerRowIndex = rows.findIndex((row) =>
      row.some((cell) => typeof cell === 'string' && /genus|rod\b/i.test(cell))
    );
    if (headerRowIndex === -1) continue; // このシートには価格表が無い(空シート等)

    const header = rows[headerRowIndex];
    const findCol = (pattern) => header.findIndex((cell) => typeof cell === 'string' && pattern.test(cell));

    const codeCol = findCol(/code|kód/i);
    const genusCol = findCol(/genus|rod\b/i);
    const speciesCol = findCol(/species|druh|type.*variet/i);
    const priceEurCol = findCol(/€|eur/i);
    const priceCzkCol = findCol(/czk|kč/i);
    const fallbackPriceCol =
      priceEurCol === -1 && priceCzkCol === -1 && options.pricePattern && options.priceCurrency
        ? findCol(options.pricePattern)
        : -1;

    if (genusCol === -1) continue;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const genus = String(row[genusCol] ?? '').trim();
      if (!genus) continue;

      const speciesDescription = speciesCol !== -1 ? String(row[speciesCol] ?? '').trim() : '';
      const priceEur = priceEurCol !== -1 ? Number(row[priceEurCol]) : NaN;
      const priceCzk = priceCzkCol !== -1 ? Number(row[priceCzkCol]) : NaN;
      const priceFallback = fallbackPriceCol !== -1 ? Number(row[fallbackPriceCol]) : NaN;

      let price = null;
      let currency = null;
      if (Number.isFinite(priceEur) && priceEur > 0) {
        price = priceEur;
        currency = 'EUR';
      } else if (Number.isFinite(priceCzk) && priceCzk > 0) {
        price = priceCzk;
        currency = 'CZK';
      } else if (Number.isFinite(priceFallback) && priceFallback > 0) {
        price = priceFallback;
        currency = options.priceCurrency;
      }

      items.push({
        code: codeCol !== -1 ? String(row[codeCol] ?? '').trim() : String(i),
        genus,
        speciesDescription,
        matchText: `${genus} ${speciesDescription}`.trim(),
        price,
        currency,
        row: Object.fromEntries(header.map((h, c) => [String(h).trim(), row[c]]).filter(([h]) => h)),
      });
    }
  }

  return items;
}
