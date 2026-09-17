import * as hajekCactus from './hajekCactus.js';
import * as adblps from './adblps.js';
import * as malejJarda from './malejJarda.js';
import * as kakteenCz from './kakteenCz.js';
import * as rareCactiTop from './rareCactiTop.js';
import * as kaktusKoehres from './kaktusKoehres.js';
import * as kaktusyWebzdarma from './kaktusyWebzdarma.js';
import * as cactusMoravia from './cactusMoravia.js';
import * as wonderfulCactus from './wonderfulCactus.js';
import * as cactCz from './cactCz.js';

export const sites = [
  hajekCactus,
  adblps,
  malejJarda,
  kakteenCz,
  rareCactiTop,
  kaktusKoehres,
  kaktusyWebzdarma,
  cactusMoravia,
  wonderfulCactus,
  cactCz,
];

export const siteNameById = Object.fromEntries(sites.map((s) => [s.id, s.name]));

// 以下のサイトは意図的に対象外としている(理由はSETUP.md参照):
// - Giromagi: 実カタログがrobots.txtで禁止された/shop配下にしかない
// - Kakteen-Haage: robots.txtがClaudeBotを名指しでDisallowしている
// - Uhlig Kakteen: ボット検出用JSチャレンジ(WAF)がありアクセス不可
// - Cactus Nursery: robots.txtでアクセス禁止
// - Cactus Hobby: 年末しか注文を受け付けておらず、現時点では価格表(xlsx)自体が存在しない
// - SuccSeed: Playwrightなど追加の仕組みが必要なため未着手
