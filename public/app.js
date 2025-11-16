const API_BASE = "/api/v1/tokens";
const TIME_PERIODS = [
  { value: "1h", label: "1 Hour", statsKey: "h1" },
  { value: "6h", label: "6 Hours", statsKey: "h6" },
  { value: "24h", label: "24 Hours", statsKey: "h24" },
];
const SORTS = [
  { value: "market_cap", label: "Market Cap" },
  { value: "volume", label: "Volume" },
  { value: "price_change", label: "Price Change" },
];
const PAGE_SIZES = [20, 30];
const PAGE_FETCH_LIMIT = 60;
const MAX_PAGES_PER_PERIOD = 10;

const state = {
  tokensByPeriod: TIME_PERIODS.reduce((map, period) => {
    map[period.value] = [];
    return map;
  }, {}),
  currentPeriod: "1h",
  sortBy: "market_cap",
  pageSize: 20,
  currentPage: 1,
  searchTerm: "",
  lastUpdated: null,
  socketConnected: false,
};

const dom = {
  timeRangeSelect: document.querySelector("#timeRangeSelect"),
  sortSelect: document.querySelector("#sortSelect"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  searchInput: document.querySelector("#searchInput"),
  statusMessage: document.querySelector("#statusMessage"),
  lastUpdated: document.querySelector("#lastUpdated"),
  tokenCount: document.querySelector("#tokenCount"),
  updateSource: document.querySelector("#updateSource"),
  tokenContainer: document.querySelector("#tokenContainer"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  pageIndicator: document.querySelector("#pageIndicator"),
};

function setStatus(message, isError = false) {
  dom.statusMessage.textContent = message;
  dom.statusMessage.style.color = isError ? "#ff6b6b" : "inherit";
}

function formatNumber(value) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
  if (numericValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toFixed(2)}B`;
  }
  if (numericValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(2)}M`;
  }
  if (numericValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(1)}K`;
  }
  return numericValue.toFixed(2);
}

function formatAddress(address = "") {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function buildMetric(label, value) {
  return `<div class="token-metric"><span>${value}</span>${label}</div>`;
}

function flashButton(button) {
  if (!button) return;
  button.classList.add("is-pressed");
  setTimeout(() => {
    button.classList.remove("is-pressed");
  }, 120);
}

async function fetchAllTokensForPeriod(periodValue) {
  const collected = [];
  let cursor = 0;
  let pageCount = 0;

  while (cursor !== null && pageCount < MAX_PAGES_PER_PERIOD) {
    const params = new URLSearchParams({
      limit: PAGE_FETCH_LIMIT.toString(),
      cursor: cursor.toString(),
      sort_by: "market_cap",
      time_period: periodValue,
    });
    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${periodValue} page ${pageCount + 1}`);
    }
    const payload = await response.json();
    collected.push(...payload.tokens);
    cursor = payload.next_cursor;
    pageCount += 1;
    if (payload.next_cursor === null) break;
  }

  return collected;
}

function transformTokenForPeriod(token, period) {
  const statsKey = TIME_PERIODS.find((p) => p.value === period)?.statsKey;
  if (!statsKey) return null;
  const stats = token.stats?.[statsKey];
  if (!stats) return null;
  return {
    token_address: token.token_address,
    token_name: token.token_name,
    token_ticker: token.token_ticker,
    price_usd: token.price_usd,
    market_cap_usd: token.market_cap_usd,
    liquidity_usd: token.liquidity_usd,
    protocol: token.protocol,
    stats,
  };
}

function upsertToken(collection, token) {
  if (!token) return;
  const index = collection.findIndex((item) => item.token_address === token.token_address);
  if (index === -1) {
    collection.push(token);
  } else {
    collection[index] = { ...collection[index], ...token };
  }
}

function applyFilters() {
  const dataset = state.tokensByPeriod[state.currentPeriod] ?? [];
  const searchTerm = state.searchTerm.trim().toLowerCase();
  const filtered = dataset.filter((token) => {
    if (!searchTerm) return true;
    const name = (token.token_name || "").toLowerCase();
    const ticker = (token.token_ticker || "").toLowerCase();
    const address = (token.token_address || "").toLowerCase();
    return name.includes(searchTerm) || ticker.includes(searchTerm) || address.includes(searchTerm);
  });

  filtered.sort((a, b) => {
    if (state.sortBy === "market_cap") {
      return b.market_cap_usd - a.market_cap_usd;
    }
    if (state.sortBy === "volume") {
      return b.stats.volume - a.stats.volume;
    }
    return b.stats.price_change - a.stats.price_change;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
  const start = (state.currentPage - 1) * state.pageSize;
  const visible = filtered.slice(start, start + state.pageSize);
  renderTokens(visible);
  renderSummary(filtered.length, totalPages);
}

function renderTokens(tokens) {
  if (!tokens.length) {
    dom.tokenContainer.innerHTML = "<p>No tokens found for current filters.</p>";
    return;
  }

  const fragment = document.createDocumentFragment();
  tokens.forEach((token) => {
    const card = document.createElement("article");
    card.className = "token-card";
    const price = `$${(token.price_usd ?? 0).toFixed(4)}`;
    const marketCap = `$${formatNumber(token.market_cap_usd)}`;
    const liquidity = `$${formatNumber(token.liquidity_usd)}`;
    const volume = `$${formatNumber(token.stats?.volume ?? 0)}`;
    const priceChange = `${(token.stats?.price_change ?? 0).toFixed(2)}%`;
    const txCount = token.stats?.transaction_count ?? 0;

    card.innerHTML = `
      <div class="token-card__identity">
        <div class="token-name">${token.token_name || "Unknown token"}</div>
        <div class="token-ticker">${token.token_ticker || "—"}</div>
        <div class="token-address">${formatAddress(token.token_address)}</div>
      </div>
      <div class="token-metrics">
        ${buildMetric("Price", price)}
        ${buildMetric("Market Cap", marketCap)}
        ${buildMetric("Liquidity", liquidity)}
        ${buildMetric("Volume", volume)}
      </div>
      <div class="token-card__stats">
        <div>Δ Price: <strong>${priceChange}</strong></div>
        <div>Tx Count: <strong>${txCount}</strong></div>
      </div>
    `;
    fragment.appendChild(card);
  });
  dom.tokenContainer.innerHTML = "";
  dom.tokenContainer.appendChild(fragment);
}

function renderSummary(totalTokens, totalPages) {
  dom.tokenCount.textContent = `${totalTokens} tokens cached for ${state.currentPeriod}`;
  dom.pageIndicator.textContent = `Page ${state.currentPage} / ${totalPages}`;
  dom.prevPage.disabled = state.currentPage === 1;
  dom.nextPage.disabled = state.currentPage === totalPages;

  if (state.lastUpdated) {
    dom.lastUpdated.textContent = `Last update: ${state.lastUpdated.toLocaleTimeString()}`;
  }

  dom.updateSource.textContent = state.socketConnected
    ? "Live updates: WebSocket connected"
    : "WebSocket disconnected";
}

function attachListeners() {
  dom.timeRangeSelect.addEventListener("change", (event) => {
    state.currentPeriod = event.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  dom.sortSelect.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    applyFilters();
  });

  dom.pageSizeSelect.addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value);
    state.currentPage = 1;
    applyFilters();
  });

  dom.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  dom.prevPage.addEventListener("click", () => {
    if (state.currentPage > 1) {
      flashButton(dom.prevPage);
      state.currentPage -= 1;
      applyFilters();
    }
  });

  dom.nextPage.addEventListener("click", () => {
    flashButton(dom.nextPage);
    state.currentPage += 1;
    applyFilters();
  });
}

function populateControls() {
  TIME_PERIODS.forEach((period) => {
    const option = document.createElement("option");
    option.value = period.value;
    option.textContent = period.label;
    dom.timeRangeSelect.appendChild(option);
  });
  dom.timeRangeSelect.value = state.currentPeriod;

  SORTS.forEach((sort) => {
    const option = document.createElement("option");
    option.value = sort.value;
    option.textContent = sort.label;
    dom.sortSelect.appendChild(option);
  });
  dom.sortSelect.value = state.sortBy;

  PAGE_SIZES.forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = `${size} tokens`;
    dom.pageSizeSelect.appendChild(option);
  });
  dom.pageSizeSelect.value = state.pageSize;
}

function connectSocket() {
  const socket = io();

  socket.on("connect", () => {
    state.socketConnected = true;
    setStatus("Connected to token stream");
    renderSummary(state.tokensByPeriod[state.currentPeriod].length, Math.max(1, Math.ceil(state.tokensByPeriod[state.currentPeriod].length / state.pageSize)));
  });

  socket.on("disconnect", () => {
    state.socketConnected = false;
    setStatus("WebSocket disconnected. Reconnecting…", true);
    renderSummary(state.tokensByPeriod[state.currentPeriod].length, Math.max(1, Math.ceil(state.tokensByPeriod[state.currentPeriod].length / state.pageSize)));
  });

  socket.on("token_updates", (updates) => {
    if (!Array.isArray(updates) || !updates.length) return;
    TIME_PERIODS.forEach((period) => {
      updates.forEach((token) => {
        const transformed = transformTokenForPeriod(token, period.value);
        if (transformed) {
          upsertToken(state.tokensByPeriod[period.value], transformed);
        }
      });
    });
    state.lastUpdated = new Date();
    applyFilters();
  });
}

async function loadInitialData() {
  setStatus("Loading aggregated token data…");
  try {
    for (const period of TIME_PERIODS) {
      setStatus(`Fetching ${period.label} snapshots…`);
      const tokens = await fetchAllTokensForPeriod(period.value);
      state.tokensByPeriod[period.value] = tokens;
    }
    state.lastUpdated = new Date();
    setStatus("Initial dataset cached. Listening for live updates.");
    applyFilters();
    connectSocket();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load data: ${error.message}`, true);
  }
}

function bootstrap() {
  populateControls();
  attachListeners();
  loadInitialData();
}

bootstrap();
