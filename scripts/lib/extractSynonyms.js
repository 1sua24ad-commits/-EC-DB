/**
 * SynonymsWithAuthors のような「著者名付き学名がカンマ区切りで並んだ文字列」から
 * 属名+種小名(+任意で1語だけ亜種名相当)の部分だけを抜き出す。
 *
 * 単純に split(',') してから正規表現を当てる方式だと、
 *  - 著者名自体がカンマ区切りの複数人(例: "Matusz., Myšák & Jiruše")である場合に
 *    1つの学名が2つの断片に分断されてしまう
 *  - "var." "subsp." 等の階級語が学名の一部として誤って取り込まれてしまう
 *    (例: "Sclerocactus wetlandicus var. ilseae" → "wetlandicus var" のように誤抽出される)
 * という問題がある。
 *
 * そこでカンマでの分割はせず、まず階級語以降を取り除いたうえで、
 * 文字列全体から「大文字始まりの単語(属名) + 小文字始まりの単語1〜2個」という
 * パターンをグローバルに検索する。この方式なら上記どちらの問題も自然に回避できる
 * (著者名の断片は大文字始まりが続くため候補として拾われず、階級語は事前に除去される)。
 */
export function extractSynonyms(synonymsWithAuthors) {
  if (!synonymsWithAuthors) return [];

  const withoutRanks = synonymsWithAuthors.replace(
    /\b(?:var|subsp|forma|f)\.?\s+[a-zà-ÿ][a-zà-ÿ-]*/gi,
    ' '
  );

  const pattern = /[A-Z][a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){1,2}/g;
  const matches = withoutRanks.match(pattern) || [];

  return [...new Set(matches.map((s) => s.trim()))];
}
