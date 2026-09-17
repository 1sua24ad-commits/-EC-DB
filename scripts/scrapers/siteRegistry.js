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
import * as succseed from './succseed.js';

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
  succseed,
];

export const siteNameById = Object.fromEntries(sites.map((s) => [s.id, s.name]));

// 以下のサイトは意図的に対象外としている(理由はSETUP.md参照):
// - Giromagi: 実カタログがrobots.txtで禁止された/shop配下にしかない
// - Kakteen-Haage: robots.txtがClaudeBotを名指しでDisallowしている
// - Uhlig Kakteen: ボット検出用JSチャレンジ(WAF)がありアクセス不可
// - Cactus Nursery: robots.txtでアクセス禁止
// - Cactus Hobby: 年末しか注文を受け付けておらず、現時点では価格表(xlsx)自体が存在しない
// SuccSeedは商品データを持つJSON-RPC API(/backend/)がrobots.txtで禁止されているため、
// APIもヘッドレスブラウザも使わず、robots.txtが案内するsitemap.xmlのURLからのみ
// 取り扱い学名を判定している(価格・在庫は取得せずnull。詳細はsuccseed.js参照)。
