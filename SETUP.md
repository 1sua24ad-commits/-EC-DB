# cactus-db を IntelliJ IDEA で動かす手順

実装指示書「第10章 IntelliJでの実行方法」を、初めてこの種の作業をする人でも迷わず進められるように、
実際に今回作成したファイルに即して詳しく説明したものです。

---

## 0. まず全体像:今回何を作ったか

このプロジェクトは「Node.js」という仕組みの上で動くJavaScriptのプログラム群です。
IntelliJ IDEAは、これらのファイルを編集・実行するための道具(エディタ)だと考えてください。

| ファイル/フォルダ | 役割 |
|---|---|
| `data/source/*.csv` | 元データ(CITES附属書I種リスト、IUCN分類、IUCN評価)。既に配置済み |
| `data/wfo_cactaceae_names.tsv` | World Flora Online由来のサボテン科学名索引(シノニム判定用)。既に配置済み・更新手順は後述 |
| `db/schema.sql` | データベースの設計図(どんな表を作るかの定義) |
| `scripts/db.js` | データベースに接続するための共通処理 |
| `scripts/importSpeciesMaster.js` | 3つのCSVを読み込んでデータベース(`data/cactus.db`)を作るプログラム |
| `scripts/exportSpeciesMaster.js` | データベースの中身をブラウザ用のJSON(`public-data/species_master.json`)に書き出すプログラム |
| `scripts/lib/normalizeName.js`<br>`scripts/lib/speciesMatcher.js`<br>`scripts/lib/extractSynonyms.js` | 学名の表記ゆれ(著者名付き表記・変種表記など)を吸収して判定するロジック本体 |
| `scripts/scrapeProducts.js` | ECサイトから商品情報を取得し、学名照合の結果とあわせて`products`テーブルに保存するプログラム(Phase 1) |
| `scripts/scrapers/*.js` | サイトごとのスクレイピング処理(現在: Hajek Cactus, ADBLPS, Malej Jarda の3サイト) |
| `web/species-search.html`<br>`web/species-search.js` | ブラウザで動く検索ページ(種ごとの購入可能サイト一覧も表示) |
| `test/speciesMatcher.test.js` | 上記ロジックが正しく動くかを自動でチェックするテストコード(9件) |

このうち、あなたが普段さわるのは主に `scripts/` の中身と `web/` の検索ページです。

---

## 1. 事前準備の確認(インストール作業は完了済み)

このセッション内で、Node.js 22 LTSのインストールと `npm install`(必要な部品のダウンロード)は既に完了しています。
IntelliJで新しくPowerShellやターミナルを開いたときは、念のため以下で確認してください。

```bash
node --version
```

`v22.23.2` のように表示されればOKです。何も表示されない・エラーになる場合は、一度PowerShellやIntelliJを閉じて開き直してください(インストール直後はPATHという設定の反映に再起動が必要なことがあります)。

---

## 2. IntelliJ IDEAでプロジェクトを開く

1. IntelliJ IDEAを起動します。
2. スタート画面(または上部メニューの `File`)から **「Open」** を選びます。
3. フォルダ選択ダイアログで、以下のフォルダを選んで「OK」を押します。

   ```
   C:\Users\pachy\OneDrive\ドキュメント\プログラム関連\最初のバイブコーディング\cactus-db
   ```

   > **重要**: 一つ上の階層(「最初のバイブコーディング」フォルダ)ではなく、必ず `cactus-db` フォルダそのものを選んでください。`package.json` が直下にあるフォルダを開く、という意味です。

4. 「Trust Project(このプロジェクトを信頼しますか)」のような確認が出たら **「Trust Project」** を選びます。
5. 初回はIntelliJが自動的にNode.jsを認識しようとして、右下に進捗バーが出ることがあります。しばらく待ちましょう。

---

## 3. Node.jsプラグインの確認(初回のみ、なければ入れる)

IntelliJ IDEAの無料版(Community Edition)には、Node.js向けの機能が標準で入っていないことがあります。

1. 上部メニューの `File` → `Settings`(Macの場合は `IntelliJ IDEA` → `Preferences`)を開く
2. 左側の一覧から `Plugins` を選択
3. 検索欄に「Node.js」と入力
4. 「Node.js」というプラグインが出てきたらインストールボタンを押し、指示に従ってIDEを再起動

(Ultimate Edition=有料版には最初から入っています)

---

## 4. 依存パッケージ(node_modules)の確認

このプロジェクトの動作に必要な部品(better-sqlite3など)は、このセッション内で既に `npm install` 済みです。
`cactus-db` フォルダの中に `node_modules` という大きなフォルダが存在していれば準備完了です。

IntelliJの左側のプロジェクトツリーで `node_modules` フォルダが薄いグレー色の文字で表示されるのは正常です(「これは外部から取ってきた部品なので普段は中身を気にしなくていい」という意味の表示です)。

もし将来、別のPCなどで `node_modules` が無い状態から始める場合は、IntelliJ下部にある **Terminal** タブを開いて次を実行してください。

```bash
npm install
```

---

## 5. 実行構成(Run Configuration)を作る

「実行構成」とは、「このボタンを押したらこのコマンドを実行する」という設定をIntelliJにあらかじめ登録しておく機能です。毎回コマンドを手入力しなくても、ワンクリックで実行できるようになります。

今回は次の3つを作ります。

- `import:species` … CSVからデータベースを作る
- `export:species` … データベースをJSONに書き出す
- `test` … 自動テストを実行する

### 5-1. 共通の作り方

1. 画面右上の **「Add Configuration...」**(または上部メニューの `Run` → `Edit Configurations...`)をクリック
2. 左上の **「+」** ボタンをクリックし、一覧から **「npm」** を選択

   > もし「npm」が候補に出てこない場合は、3章のNode.jsプラグインが入っていない可能性があります。

### 5-2. `import:species` 用の設定

| 項目 | 設定値 |
|---|---|
| Name(名前、自由入力) | `import species` |
| package.json | `cactus-db/package.json`(自動で入っていることが多い) |
| Command | `run` |
| Scripts | `import:species` |

入力できたら「OK」または「Apply」で保存します。

### 5-3. `export:species` 用の設定

同じ手順で「+」→「npm」から追加し、以下を設定します。

| 項目 | 設定値 |
|---|---|
| Name | `export species` |
| Command | `run` |
| Scripts | `export:species` |

### 5-4. `test` 用の設定

同じ手順で「+」→「npm」から追加し、以下を設定します。

| 項目 | 設定値 |
|---|---|
| Name | `run tests` |
| Command | `test` |

(`test` はnpmで特別扱いされるコマンドなので、Scriptsの指定は不要です)

### 5-5. `scrape` 用の設定(Phase 1で追加)

同じ手順で「+」→「npm」から追加し、以下を設定します。

| 項目 | 設定値 |
|---|---|
| Name | `scrape products` |
| Command | `run` |
| Scripts | `scrape` |

これは対象ECサイト(現在3サイト)に実際にアクセスして商品情報を取得し、`products` テーブルに保存するプログラムです。サイトへの負荷を抑えるため、ページ取得の間に待機時間を入れており、実行には数分かかります。

---

## 6. 実行する

画面右上のドロップダウンで作った設定(例: `import species`)を選び、その右側の緑色の再生ボタン(▶)をクリックします。

### 6-1. まず `import species` を実行

下部の実行結果(コンソール)に、次のような内容が出れば成功です。

```
taxonomy.csv: 105行読み込み(重複0件)
CITES CSV: 80行読み込み(重複0件, シノニム213件登録)

=== species_master 取り込み結果 ===
総件数: 174
source内訳:
  BOTH: 11
  CITES: 69
  IUCN: 94
rank内訳:
  GENUS: 6
  SPECIES: 166
  SUBSPECIES: 2
CITES・IUCN両方に該当する種(source='BOTH'): 11件
  - Discocactus hartmannii
  - Melocactus conoideus
  - Pediocactus knowltonii
  - Sclerocactus brevispinus
  - Turbinicarpus alonsoi
  - Turbinicarpus gielsdorfianus
  - Turbinicarpus hoferi
  - Turbinicarpus laui
  - Turbinicarpus mandragora
  - Turbinicarpus swobodae
  - Uebelmannia buiningii
```

このとき、プロジェクトフォルダの中に `data/cactus.db` というファイルが新しく作られます(これがデータベース本体です)。

### 6-2. 次に `export species` を実行

次のように出れば成功です。

```
書き出し完了: 174件 → ...\public-data\species_master.json
```

`public-data/species_master.json` というファイルが作られます(検索ページが読み込むデータです)。

### 6-3. 最後に `run tests` を実行

次のように出れば成功です。

```
# tests 9
# pass 9
# fail 0
```

9個のテストすべてが成功(pass)していればOKです。もし失敗(fail)しているテストがあれば、先に `import species` を実行し忘れていないか確認してください(テストは実際のデータベースの中身を見て判定するため、先にimportが必須です)。

### 6-4. `scrape products` を実行(Phase 1、任意)

ECサイトの商品情報を取り込みたいときに実行します。数分かかります。次のように出れば成功です。

```
=== Hajek Cactus (hajek-cactus) ===
取得件数: 1183件 (confirmed: 477, needs_review: 4, none: 702)
保護種と確定マッチした商品:
  [species] Pediocactus knowltonii ... -> https://hajek-cactus.com/products/...
  ...
```

実行後は、検索ページに反映するために **もう一度 `export species` を実行し直してください**(スクレイピング結果をJSONに書き出すのはexportの役目のため)。

---

## 7. 検索ページを開く

1. IntelliJ左側のプロジェクトツリーで `web/species-search.html` を探します
2. ファイル名を右クリック
3. メニューから **「Open In」→「Browser」→ お使いのブラウザ(Chromeなど)** を選択
   (バージョンによっては単に「Open in Browser」という項目名です)
4. ブラウザが開き、検索ページが表示されます

このとき、IntelliJが裏側で小さなWebサーバーを一時的に立ち上げてページを配信しています。

> **注意**: `species-search.html` をエクスプローラーからダブルクリックして直接開いてしまうと、ブラウザのセキュリティ制限により検索データが読み込めず「データの読み込みに失敗しました」というエラーが表示されます。**必ずIntelliJの「Open in Browser」から開いてください。**

### 動作確認のやり方

- 検索欄に `Ariocarpus` と入力 → Ariocarpus属の種が複数表示されればOK
- `Roseocactus` と入力 → 異名(シノニム)経由で `Ariocarpus fissuratus` などがヒットすればOK
- 存在しない適当な文字列(例: `zzz`)を入力 → 「該当なし」と表示されればOK
- `scrape products` を実行済みなら、種のカードに「▶ 購入可能: N件 — サイト名(件数)...」という行が表示されます。クリックすると展開し、サイトごとの商品名・価格・在庫状況・購入ページへのリンクが確認できます

---

## 8. よくあるトラブル

| 症状 | 原因と対処 |
|---|---|
| npmがRun Configurationの候補に出てこない | Node.jsプラグインが未インストール(3章を参照) |
| testを実行すると全部失敗する | importを先に実行していない。6-1から順にやり直す |
| ブラウザで「データの読み込みに失敗しました」と出る | HTMLファイルを直接ダブルクリックして開いている。7章の手順でIntelliJ経由で開き直す |
| `npm install` でエラーが出る | ネットワーク接続を確認。それでも解決しない場合はエラーメッセージを教えてください |
| scrapeを実行してもページに購入可能情報が出ない | scrape後に `export species` を実行し忘れている可能性があります。6-4を参照 |

---

## 9. 今後CSVを更新したときの作業サイクル

CITES・IUCNのCSVが新しくなったときは、次の順番で再実行してください。

1. `data/source/` の中の対象CSVを新しいファイルに差し替える
2. `import species` を実行(データベースが最新のCSVから作り直されます)
3. `export species` を実行(検索ページ用のJSONが更新されます)
4. 必要なら `run tests` で壊れていないか確認する
5. ブラウザをリロードして検索ページを確認する

商品の在庫・価格情報を最新化したいだけの場合は、`scrape products` → `export species` の順で実行すれば十分です(CSVの再取り込みは不要)。

### World Flora Online(学名索引)を更新する場合

シノニム(異名)の判定には、CITESのシノニム欄に加えてWorld Flora Online (WFO) Plant Listの
サボテン科学名索引 `data/wfo_cactaceae_names.tsv` を使っています。既に配置済みなので通常は不要ですが、
WFOは半年ごと(6月・12月の至の日)に新版を出すため、更新したい場合は次の手順で差し替えます。

1. Zenodoの公開リポジトリ(DOI: `10.5281/zenodo.7460141`)から最新版の `_DwC_backbone_R.zip` をダウンロードする
   (ライセンスはCC0。WFO本体のサイト`worldfloraonline.org`は`robots.txt`で自動アクセスを禁止しているため、
   サイトを巡回するのではなく、この公開データセットを使うこと)
2. zipを展開する(中身は `classification.csv` 1ファイル、約900MB)
3. 次のコマンドでサボテン科の行だけを抜き出し、索引を作り直す

   ```bash
   node scripts/buildWfoNames.js <展開した classification.csv のパス>
   ```

4. `import species` → `scrape products` → `export species` の順に再実行する

> `import species` は `species_master` のidを振り直すため `products` も一緒にクリアされます。
> WFO索引を更新したときは `scrape products` のやり直しが必須です。

---

## 10. Phase 1(商品スクレイピング)の現状と制約

### 対応済みサイト(9サイト)

| サイト | 方式 |
|---|---|
| Hajek Cactus | Shopify `/products.json` |
| ADBLPS | 静的HTML(フランスの種子販売サイト) |
| Zahradnictví Malej Jarda | Shoptet(チェコの生産者直販サイト) |
| Kakteen.cz | Shoptet(Malej Jardaと同一基盤、スクレイパー共通化) |
| Rare Cacti Top | 独自PHP、静的HTML(カテゴリごとに`?c=all`で全件取得) |
| Kaktus Köhres | 独自eコマース(modified eCommerce)。属ごとに1ページの構造のため、`species_master`登録済みの属だけを対象に絞り込んでクロール |
| Kaktusy webzdarma | カタログページからExcel(.xlsx)ファイルのURLを自動検出し、ダウンロードして解析(SheetJS) |
| Cactus Moravia | 同上。カタログページに複数のxlsxファイル(属グループ別)が掲載されている場合は全て自動検出して解析 |
| Wonderful Cactus | ECサイトではないが、Facebook経由で実際に注文可能。カタログページのPDF(数百ページ)をダウンロードし`pdf-parse`でテキスト抽出、独自フォーマットの商品リストを解析(売り切れ商品は除外) |
| Cact.cz | 季節カタログのPDFリンクを毎回自動検出してダウンロードし、「属見出し(旧属名を括弧併記)+カタログ番号付き商品行」というレイアウトを解析。価格はチェコ式表記(`22,-` = CZK) |
| SuccSeed | robots.txtが案内する`sitemap.xml`のみを参照し、URLに含まれる学名から取り扱い種を判定(詳細は後述) |

### 対象外にしたサイトとその理由

| サイト | 理由 |
|---|---|
| Cactus Nursery | robots.txtでアクセス禁止 |
| Giromagi | 実際の商品カタログがrobots.txtで禁止された`/shop`配下にしかなく、許可されている別ドメイン(giromagishop.com)は独立したカテゴリ一覧を持たない |
| Kakteen-Haage | robots.txtが`User-agent: ClaudeBot`に対して明示的に`Disallow: /`としている(名指しでの拒否のため対応不可) |
| Uhlig Kakteen | アクセス時にボット検出用のJS Proof-of-Workチャレンジ(WAF)が挟まっており、これを解読・回避する実装は方針上行わない |
| Cactus Hobby | 年末しか注文を受け付けておらず、現時点では価格表(xlsx)自体がサイト上に存在しない(後回し) |

### 特殊な取得方式のサイト

- **SuccSeed**: JS依存のSPAで、商品データは`/backend/`のJSON-RPC APIからしか取得できないが、そのパスはrobots.txtで禁止されている(ヘッドレスブラウザで描画しても同じ禁止パスを自動で踏むことになる)。そのためAPIもブラウザも使わず、**robots.txtが自ら案内している`sitemap.xml`のみ**を参照している。サイトマップのURLには学名が含まれている(例:`/en/seeds-cacti/ariocarpus/ariocarpus-retusus-sb-240-matehuala-slp.html`)ため、「どの保護種を扱っているか」はこれだけで判定できる。**価格と在庫は禁止パスからしか得られないため取得しておらず、画面上は「価格不明 / 在庫不明」と表示される**。サーバーへのリクエストはサイトマップの数件のみ

### その他の制約

- **各サイトのrobots.txtを確認し、禁止されているパスにはアクセスしていません**。また相手サーバーへの負荷を抑えるため、リクエストの間に待機時間とタイムアウト(20秒、1回リトライ)を設定し、識別可能なUser-Agentを付けています。
- Cactus Moraviaのrobots.txtには過去シーズンのアーカイブ済みファイル(`/wp-content/uploads/_pda/...`配下、xlsx/pdf/zip)への禁止指定がありますが、現行シーズンのカタログページに掲載されているファイルはこの禁止対象に含まれていないことを確認済みです。
- xlsx・PDFファイルのURLはハードコードせず、カタログページのHTMLからリンクを毎回自動検出しています。季節ごとにファイル名やバージョンが変わっても(例:「春」→「秋」の価格表更新)スクレイパー側の変更は不要です。
- Hajek Cactusの通貨(現地表示価格が USD/JPY など毎回変動して信頼できなかったため)は、価格の数字だけを表示し「(通貨要確認)」と明記しています。誤った通貨を断定表示するより安全側に倒しています。
- Wonderful CactusのPDFには「まとめ売り」区画(例: 産地別のLophophora一覧)があり、個々の品目が独自の番号付きリスト(「18-」等)で区切られていて、区画全体を1商品として扱わざるを得ない場合があります。この区画内のどこかに「(sold out)」が含まれていれば、区画全体を安全側に倒して除外しています(在庫ありと誤って断定するリスクを避けるため)。
- `needs_review`(タイプミス等によるファジーマッチ)と判定された商品は、誤って「購入可能」と断定してしまうリスクを避けるため、検索ページには表示していません。`scrape products` 実行時のコンソール出力に一覧が出るので、手動で確認したい場合はそちらを参照してください。
- 商品データは `products` テーブルに保存されており、`scrape products` を再実行するたびに同じ商品(サイトIDと商品URLの組み合わせ)は上書き更新されます。
- `import species` を再実行すると、`species_master`のidが振り直されるため、整合性を保つために`products`テーブルも一緒にクリアされます。CSVを更新した後は`scrape products`をやり直してください。
- Malej Jardaのrobots.txtには「検索エンジンへのインデックスは許可するが、AI学習データとしての収集は禁止する」という`Content-Signal`があります。今回の用途はAI学習ではなく個人の商品カタログ照合と判断し実施していますが、気になる場合はこのサイトだけ`scripts/scrapers/siteRegistry.js`の一覧から外すことができます。
- `xlsx`パッケージはnpmレジストリ配布版に修正されていない高深刻度の脆弱性があるため、SheetJS公式サイト(cdn.sheetjs.com)配布のパッチ版を使用しています。`package.json`の依存関係URLはそのままにしてください。

### 現在の実績値(2026年9月時点)

11サイト合計で約23,900商品を取得し、うち**2,439商品**が保護種と確定マッチ(**134種**に何らかの購入先あり)。
