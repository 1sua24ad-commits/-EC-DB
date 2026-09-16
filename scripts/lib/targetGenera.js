/**
 * 属ごとに1ページという構造を持つサイト(例: kaktusKoehres.js)をクロールする際、
 * どの属のページを対象にするかを決める集合を返す。
 *
 * species_master.genus はCITES/IUCNの現行(最新)の属名しか持たない。
 * しかしサボテン科は分類学上の改訂が頻繁で、Turbinicarpus → Gymnocactus/Rapicactus
 * のように1つの属が分割・改称されるケースが多く、商業サイト(特にKöhresのような
 * 古くからのサイト)ではカテゴリが旧属名のまま残っていることが多い。
 * species_master.genus だけを対象属集合にすると、そのようなページ自体が
 * クロール対象から漏れてしまい、ページ内の商品が一度も評価されない。
 *
 * species_synonym には旧学名(例: "Gymnocactus mandragora")がCITES/IUCNの
 * SynonymsWithAuthors由来で格納済みなので、その先頭語(旧属名)も対象に加える。
 */
export function getTargetGenera(db) {
  const masterGenera = db.prepare('SELECT DISTINCT genus FROM species_master').all()
    .map((r) => r.genus);
  const synonymGenera = db.prepare('SELECT synonym FROM species_synonym').all()
    .map((r) => r.synonym.trim().split(/\s+/)[0]);
  return new Set([...masterGenera, ...synonymGenera].map((g) => g.toLowerCase()));
}
