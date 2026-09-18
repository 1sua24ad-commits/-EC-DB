const input = document.getElementById('search-input');
const resultsEl = document.getElementById('results');
const metaRow = document.getElementById('meta-row');
const resultCountEl = document.getElementById('result-count');
const totalCountEl = document.getElementById('total-count');
const protectionEl = document.getElementById('filter-protection');
const availabilityEl = document.getElementById('filter-availability');
const genusListEl = document.getElementById('genus-list');
const genusPanelTitle = document.getElementById('genus-panel-title');
const resetButton = document.getElementById('reset-filters');
const sortSelect = document.getElementById('sort-select');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarToggleState = document.getElementById('sidebar-toggle-state');

let allSpecies = [];
let currentQuery = '';

const LISTING_PREVIEW_COUNT = 5;

const filters = {
  cites: false,
  iucn: false,
  availability: 'all',
  genus: null,
};

const hasListings = (s) => (s.listings ?? []).length > 0;
const hasStock = (s) => (s.listings ?? []).some((l) => l.inStock === true);

// 保護区分のチェックは絞り込み(AND)として扱う。両方にチェックを入れた場合は
// 「CITES附属書IとIUCNの両方に掲載されている種」に絞られる。
// 流通状況は互いに排他的(購入先ありと流通未確認は同時に成立しない)なので
// ラジオボタンにして、矛盾する条件を選べないようにしている。
// 件数が同じときに並びが実行のたびに変わらないよう、いずれも最後は学名順で決着させる。
const byName = (a, b) => a.scientificName.localeCompare(b.scientificName);
const SORTERS = {
  name: byName,
  listings: (a, b) => (b.listings ?? []).length - (a.listings ?? []).length || byName(a, b),
  stock: (a, b) => {
    const count = (s) => (s.listings ?? []).filter((l) => l.inStock === true).length;
    return count(b) - count(a) || byName(a, b);
  },
};

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'すべて', test: () => true },
  { value: 'listed', label: '購入先あり', test: hasListings },
  { value: 'inStock', label: '在庫あり', test: hasStock },
  { value: 'unlisted', label: '流通未確認', test: (s) => !hasListings(s) },
];

function matchesFilters(species, { ignoreGenus = false } = {}) {
  if (filters.cites && species.citesAppendix !== 'I') return false;
  if (filters.iucn && !species.iucnCategory) return false;
  const option = AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability);
  if (option && !option.test(species)) return false;
  if (!ignoreGenus && filters.genus && species.genus !== filters.genus) return false;
  return true;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderCard(species) {
  const badges = [];
  if (species.citesAppendix) {
    badges.push(`<span class="badge cites">CITES附属書${escapeHtml(species.citesAppendix)}</span>`);
  }
  if (species.iucnCategory) {
    badges.push(`<span class="badge iucn">IUCN: ${escapeHtml(species.iucnCategory)}</span>`);
  }

  // 対象11サイトを横断しても販売が見つからなかった種であることを明示する。
  // 「データが無い」のではなく「現在の園芸市場で流通が確認できない」という、
  // 保護状況を見るうえで意味のある情報なので、購入可能な種と区別して示す。
  const stockCount = (species.listings ?? []).filter((l) => l.inStock === true).length;
  if ((species.listings ?? []).length === 0) {
    badges.push('<span class="badge unlisted">流通未確認</span>');
  } else if (stockCount > 0) {
    badges.push(`<span class="badge available">在庫あり ${stockCount}件</span>`);
  }

  const genusNote = species.rank === 'GENUS'
    ? '<span class="genus-note">(属単位の登録。この属の全種が対象)</span>'
    : '';

  const synonymsHtml = renderSynonyms(species);

  return `
    <div class="card">
      <span class="sci-name">${escapeHtml(species.scientificName)}</span>${genusNote}
      ${synonymsHtml}
      <div class="badges">${badges.join('')}</div>
      ${renderListings(species)}
    </div>
  `;
}

// 異名は種によって100件を超えることがあり(最多はHaageocereus pacalaensisの104件)、
// 全件並べるとカード本体の情報が埋もれてしまう。既定では数件だけ見せて残りは畳む。
// ただし検索語が異名に一致してヒットした場合、一致した異名が畳まれた側に隠れていると
// 「なぜヒットしたのか」が分からなくなるため、一致するものを先頭に並べ替える。
const SYNONYM_PREVIEW_COUNT = 5;

function renderSynonyms(species) {
  const synonyms = species.synonyms ?? [];
  if (synonyms.length === 0) return '';

  const ordered = currentQuery
    ? [...synonyms].sort((a, b) => {
      const aHit = a.toLowerCase().includes(currentQuery);
      const bHit = b.toLowerCase().includes(currentQuery);
      return aHit === bHit ? 0 : aHit ? -1 : 1;
    })
    : synonyms;

  const shown = ordered.slice(0, SYNONYM_PREVIEW_COUNT).map(highlightQuery).join(', ');
  const restCount = ordered.length - SYNONYM_PREVIEW_COUNT;
  if (restCount <= 0) {
    return `<div class="synonyms">異名: ${shown}</div>`;
  }

  const rest = ordered.slice(SYNONYM_PREVIEW_COUNT).map(highlightQuery).join(', ');
  return `
    <div class="synonyms">
      異名: ${shown}<span class="collapsible" hidden>, ${rest}</span>
      <button type="button" class="more-toggle" data-more="他${restCount}件">他${restCount}件</button>
    </div>
  `;
}

function highlightQuery(text) {
  const escaped = escapeHtml(text);
  if (!currentQuery) return escaped;
  const index = text.toLowerCase().indexOf(currentQuery);
  if (index === -1) return escaped;
  const before = escapeHtml(text.slice(0, index));
  const hit = escapeHtml(text.slice(index, index + currentQuery.length));
  const after = escapeHtml(text.slice(index + currentQuery.length));
  return `${before}<mark>${hit}</mark>${after}`;
}

function stockBadge(inStock) {
  if (inStock === true) return '<span class="stock in">在庫あり</span>';
  if (inStock === false) return '<span class="stock out">在庫なし</span>';
  return '<span class="stock unknown">在庫不明</span>';
}

function renderListingItem(item) {
  const priceText = item.price != null
    ? item.currency
      ? `${item.price} ${escapeHtml(item.currency)}`
      : `${item.price}(通貨要確認)`
    : '価格不明';
  return `
    <a class="listing-item" href="${escapeHtml(item.productUrl)}" target="_blank" rel="noopener noreferrer">
      <span class="listing-name">${escapeHtml(item.productName)}</span>
      <span class="listing-meta">${priceText} ${stockBadge(item.inStock)}</span>
    </a>
  `;
}

function renderListings(species) {
  const listings = species.listings;
  if (!listings || listings.length === 0) return '';

  const bySite = new Map();
  for (const item of listings) {
    if (!bySite.has(item.siteId)) bySite.set(item.siteId, { siteName: item.siteName, items: [] });
    bySite.get(item.siteId).items.push(item);
  }
  const siteGroups = [...bySite.values()];

  const summaryText = siteGroups
    .map((g) => `${escapeHtml(g.siteName)}(${g.items.length}件)`)
    .join(' / ');

  // 1種で190件(Ariocarpus retusus)に達するサイトもあるため、サイトごとに
  // 先頭数件だけ出して残りは畳む。サイト名の右に総数を出しておけば、
  // 畳んだ状態でもそのサイトが何件扱っているかは分かる。
  const bodyHtml = siteGroups.map((g) => {
    const shown = g.items.slice(0, LISTING_PREVIEW_COUNT).map(renderListingItem).join('');
    const restCount = g.items.length - LISTING_PREVIEW_COUNT;
    const rest = restCount > 0
      ? `<div class="collapsible" hidden>${g.items.slice(LISTING_PREVIEW_COUNT).map(renderListingItem).join('')}</div>
         <button type="button" class="more-toggle" data-more="他${restCount}件を表示">他${restCount}件を表示</button>`
      : '';
    return `
      <div class="listing-site-group">
        <div class="listing-site-name">${escapeHtml(g.siteName)} <span class="listing-site-count">${g.items.length}件</span></div>
        ${shown}${rest}
      </div>
    `;
  }).join('');

  return `
    <details class="listings">
      <summary>購入可能: ${listings.length}件 — ${summaryText}</summary>
      <div class="listings-body">${bodyHtml}</div>
    </details>
  `;
}

function render(list) {
  if (list.length === 0) {
    resultsEl.innerHTML = '<div class="empty">該当なし</div>';
    return;
  }
  resultsEl.innerHTML = list.map(renderCard).join('');
}

function matchesQuery(species, q) {
  if (!q) return true;
  if (species.scientificName.toLowerCase().includes(q)) return true;
  if (species.genus.toLowerCase().includes(q)) return true;
  return (species.synonyms ?? []).some((syn) => syn.toLowerCase().includes(q));
}

function renderProtectionFilters() {
  const citesCount = allSpecies.filter((s) => s.citesAppendix === 'I').length;
  const iucnCount = allSpecies.filter((s) => s.iucnCategory).length;
  protectionEl.innerHTML = `
    <label class="filter-option">
      <input type="checkbox" data-filter="cites"${filters.cites ? ' checked' : ''}>
      <span>CITES附属書I</span><span class="count">${citesCount}</span>
    </label>
    <label class="filter-option">
      <input type="checkbox" data-filter="iucn"${filters.iucn ? ' checked' : ''}>
      <span>IUCN掲載</span><span class="count">${iucnCount}</span>
    </label>
  `;
}

function renderAvailabilityFilters() {
  availabilityEl.innerHTML = AVAILABILITY_OPTIONS.map((option) => {
    const count = option.value === 'all' ? allSpecies.length : allSpecies.filter(option.test).length;
    return `
      <label class="filter-option">
        <input type="radio" name="availability" value="${option.value}"${filters.availability === option.value ? ' checked' : ''}>
        <span>${option.label}</span><span class="count">${count}</span>
      </label>
    `;
  }).join('');
}

// 属索引の件数は、属以外の絞り込みを適用した後の数を出す。
// 「CITES附属書Iに絞ると、その属に何種残るのか」がその場で分かるようにするため。
function renderGenusIndex(query) {
  const counts = new Map();
  for (const species of allSpecies) {
    if (!matchesFilters(species, { ignoreGenus: true })) continue;
    if (!matchesQuery(species, query)) continue;
    counts.set(species.genus, (counts.get(species.genus) ?? 0) + 1);
  }

  const genera = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  genusPanelTitle.textContent = `属索引(${genera.length}属)`;

  if (genera.length === 0) {
    genusListEl.innerHTML = '<div class="empty" style="padding: 12px 0; font-size: 0.8rem;">該当なし</div>';
    return;
  }

  genusListEl.innerHTML = genera.map(([genus, count]) => `
    <button type="button" class="genus-item" data-genus="${escapeHtml(genus)}" aria-pressed="${filters.genus === genus}">
      <span>${escapeHtml(genus)}</span><span class="count">${count}</span>
    </button>
  `).join('');
}

function update() {
  const q = input.value.trim().toLowerCase();
  currentQuery = q;

  const filtered = allSpecies
    .filter((s) => matchesFilters(s) && matchesQuery(s, q))
    .sort(SORTERS[sortSelect.value] ?? SORTERS.name);

  renderGenusIndex(q);

  const isNarrowed = q || filters.cites || filters.iucn || filters.genus || filters.availability !== 'all';
  resultCountEl.textContent = isNarrowed
    ? `${filtered.length}件ヒット`
    : `全${filtered.length}件`;
  render(filtered);
}

input.addEventListener('input', update);
sortSelect.addEventListener('change', update);

protectionEl.addEventListener('change', (event) => {
  const key = event.target.dataset.filter;
  if (!key) return;
  filters[key] = event.target.checked;
  update();
});

availabilityEl.addEventListener('change', (event) => {
  if (event.target.name !== 'availability') return;
  filters.availability = event.target.value;
  update();
});

genusListEl.addEventListener('click', (event) => {
  const button = event.target.closest('.genus-item');
  if (!button) return;
  const { genus } = button.dataset;
  filters.genus = filters.genus === genus ? null : genus;
  update();
});

resetButton.addEventListener('click', () => {
  filters.cites = false;
  filters.iucn = false;
  filters.availability = 'all';
  filters.genus = null;
  input.value = '';
  renderProtectionFilters();
  renderAvailabilityFilters();
  update();
});

resultsEl.addEventListener('click', (event) => {
  const button = event.target.closest('.more-toggle');
  if (!button) return;
  const collapsible = button.parentElement.querySelector('.collapsible');
  if (!collapsible) return;
  collapsible.hidden = !collapsible.hidden;
  button.textContent = collapsible.hidden ? button.dataset.more : '折りたたむ';
});

sidebarToggle.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('open');
  sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  sidebarToggleState.textContent = isOpen ? '▲' : '▼';
});

async function init() {
  resultsEl.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const res = await fetch('../public-data/species_master.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allSpecies = await res.json();

    input.disabled = false;
    metaRow.hidden = false;
    totalCountEl.textContent = `総登録種数: ${allSpecies.length}`;
    renderProtectionFilters();
    renderAvailabilityFilters();
    update();
  } catch (err) {
    console.error('species_master.json の読み込みに失敗しました', err);
    resultsEl.innerHTML = `<div class="error">データの読み込みに失敗しました(${escapeHtml(String(err.message || err))})。ローカルサーバー経由で開いているか確認してください。</div>`;
  }
}

init();
