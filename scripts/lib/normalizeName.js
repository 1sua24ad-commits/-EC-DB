/**
 * スクレイピングした商品の学名表記を正規化する。
 * 入力例: "Ariocarpus fissuratus (Engelmann) Schumann", "ARIOCARPUS  RETUSUS", "Ariocarpus sp."
 * 出力: { genus: string, species: string|null } を返す(全て小文字)
 */
export function normalizeName(raw) {
  if (!raw) return null;
  let s = raw
    .replace(/\(.*?\)/g, ' ')      // 括弧内(著者名の一部)を除去
    .replace(/[×xX]\s+/g, ' ')      // 交配種記号を除去(必要なら)
    .replace(/\s+/g, ' ')
    .trim();

  const words = s.split(' ');
  const genus = (words[0] || '').toLowerCase().replace(/[^a-zà-ÿ-]/g, '');
  if (!genus) return null;

  // 2単語目が種小名らしい場合のみ採用。
  // 属名と同様に、直後にカンマ等の記号が空白なしで続くケース
  // (例: "Pediocactus knowltonii, small perennial plant" の "knowltonii,")
  // に対応するため、判定前に文字以外の記号を取り除く。取り除いた結果が
  // 空文字や "sp"/"spp"(種未特定を表すプレースホルダ)になる場合は不採用とする。
  let species = null;
  if (words[1]) {
    const w2 = words[1].toLowerCase().replace(/[^a-zà-ÿ-]/g, '');
    if (w2 && w2 !== 'sp' && w2 !== 'spp') {
      species = w2;
    }
  }
  return { genus, species };
}
