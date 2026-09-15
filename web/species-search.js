const input = document.getElementById('search-input');
const resultsEl = document.getElementById('results');
const metaRow = document.getElementById('meta-row');
const resultCountEl = document.getElementById('result-count');
const totalCountEl = document.getElementById('total-count');

let allSpecies = [];

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

  const genusNote = species.rank === 'GENUS'
    ? '<span class="genus-note">(属単位の登録。この属の全種が対象)</span>'
    : '';

  const synonymsHtml = species.synonyms && species.synonyms.length > 0
    ? `<div class="synonyms">異名: ${species.synonyms.map(escapeHtml).join(', ')}</div>`
    : '';

  return `
    <div class="card">
      <span class="sci-name">${escapeHtml(species.scientificName)}</span>${genusNote}
      ${synonymsHtml}
      <div class="badges">${badges.join('')}</div>
      ${renderListings(species)}
    </div>
  `;
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

  const bodyHtml = siteGroups.map((g) => `
    <div class="listing-site-group">
      <div class="listing-site-name">${escapeHtml(g.siteName)}</div>
      ${g.items.map(renderListingItem).join('')}
    </div>
  `).join('');

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

function search(query) {
  const q = query.trim().toLowerCase();
  let filtered = allSpecies;
  if (q) {
    filtered = allSpecies.filter((s) => {
      if (s.scientificName.toLowerCase().includes(q)) return true;
      if (s.genus.toLowerCase().includes(q)) return true;
      if (s.synonyms && s.synonyms.some((syn) => syn.toLowerCase().includes(q))) return true;
      return false;
    });
  }
  filtered = [...filtered].sort((a, b) => a.scientificName.localeCompare(b.scientificName));

  resultCountEl.textContent = q ? `${filtered.length}件ヒット` : `全${filtered.length}件`;
  render(filtered);
}

input.addEventListener('input', () => search(input.value));

async function init() {
  resultsEl.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const res = await fetch('../public-data/species_master.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allSpecies = await res.json();

    input.disabled = false;
    metaRow.hidden = false;
    totalCountEl.textContent = `総登録種数: ${allSpecies.length}`;
    search('');
  } catch (err) {
    console.error('species_master.json の読み込みに失敗しました', err);
    resultsEl.innerHTML = `<div class="error">データの読み込みに失敗しました(${escapeHtml(String(err.message || err))})。ローカルサーバー経由で開いているか確認してください。</div>`;
  }
}

init();
