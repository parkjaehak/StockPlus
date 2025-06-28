// uiManager.js - UI 관리 및 렌더링

// 정렬 상태
let sortKey = null;
let sortOrder = "desc";

// 무한 스크롤 관련
const PAGE_SIZE = 20;
let currentPage = 1;
let filteredStocks = [];
let favoriteStocks = []; // 즐겨찾기 목록 별도 관리
let realTimeData = new Map();
let prevPriceMap = new Map(); // 종목별 이전 가격 저장

const headerDefs = [
  { label: "종목명", key: null },
  { label: "현재가", key: "price" },
  { label: "전일대비", key: "change_rate" },
  { label: "거래량", key: "volume" },
];

let visibleRowCodes = new Set();
let observer = null;

import { getFavorites, toggleFavorite } from "./dataManager.js";

// 서버 상태 표시 함수
export function showServerStatus(status) {
  // 기존 상태 표시 요소 제거
  const existingStatus = document.querySelector(".server-status");
  if (existingStatus) {
    existingStatus.remove();
  }

  // 상태 표시 요소 생성
  const statusElement = document.createElement("div");
  statusElement.className = "server-status";

  if (status.server === "connected") {
    statusElement.innerHTML = `
      <div class="status-indicator connected">
        <span class="status-dot"></span>
        <span class="status-text">서버 연결됨</span>
      </div>
    `;
    statusElement.style.display = "none"; // 연결되면 숨김
  } else {
    statusElement.innerHTML = `
      <div class="status-indicator disconnected">
        <span class="status-dot"></span>
        <span class="status-text">서버 연결 안됨</span>
        <span class="status-error">${status.error || "알 수 없는 오류"}</span>
      </div>
    `;
    statusElement.style.display = "block";
  }

  // 팝업 상단에 추가
  const popup = document.querySelector(".popup-container") || document.body;
  popup.insertBefore(statusElement, popup.firstChild);
}

function handleRowVisibility(entries) {
  let changed = false;
  entries.forEach((entry) => {
    const code = entry.target.getAttribute("data-code");
    if (!code) return;
    if (entry.isIntersecting) {
      if (!visibleRowCodes.has(code)) {
        visibleRowCodes.add(code);
        changed = true;
      }
    } else {
      if (visibleRowCodes.delete(code)) {
        changed = true;
      }
    }
  });
  // 구독 대상이 바뀌었을 때만 갱신
  if (changed) {
    const codes = Array.from(visibleRowCodes).slice(0, 41);
    updateRealTimeSubscriptions(codes);
  }
}

function setupRowObservers() {
  // 기존 Observer 해제
  if (observer) observer.disconnect();
  visibleRowCodes.clear();
  observer = new IntersectionObserver(handleRowVisibility, {
    root:
      document.querySelector(".table-body .ss-content") ||
      document.querySelector(".table-body"),
    threshold: 0.1, // 10% 이상 보이면 보이는 것으로 간주
  });
  // 모든 tr에 Observer 등록
  document.querySelectorAll("#stock-tbody tr").forEach((tr) => {
    observer.observe(tr);
  });
}

// 테이블 렌더링
export function renderTable(data, append = false, market = "KOSPI") {
  const tbody = document.getElementById("stock-tbody");
  if (!append) tbody.innerHTML = "";

  const favorites = getFavorites(market);

  data.forEach((stock) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-code", stock.code);
    tr.setAttribute("data-market", stock.market || market || "KOSPI");

    // 실시간 데이터가 있으면 사용, 없으면 기본 데이터 사용
    const displayData = realTimeData.get(stock.code) || stock;

    const isFavorite = favorites.includes(stock.code);
    // SVG 별 아이콘, 모든 스타일은 CSS에서 제어
    const starIcon = isFavorite
      ? `<svg class="favorite-star favorite-active" data-code="${stock.code}" width="18" height="18" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9"/></svg>`
      : `<svg class="favorite-star" data-code="${stock.code}" width="18" height="18" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9"/></svg>`;
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center;">
          ${starIcon}
          <span class="stock-name">${stock.name}</span>
        </div>
        <div class="stock-code">${stock.code}</div>
      </td>
      <td class="${getChangeClass(displayData.change_rate)}">
        ${formatNumber(Math.abs(displayData.price))}
      </td>
      <td>
        <div class="change-rate ${getChangeClass(displayData.change_rate)}">
          ${
            displayData.change_rate > 0
              ? "+"
              : displayData.change_rate < 0
              ? "-"
              : ""
          }
          ${Math.abs(displayData.change_rate).toFixed(2)}%
        </div>
        <div class="change-price ${getChangeClass(displayData.change_rate)}">
        <span class="arrow">${
          displayData.change_price > 0
            ? "▲"
            : displayData.change_price < 0
            ? "▼"
            : ""
        }</span>
          ${formatNumber(Math.abs(displayData.change_price))}
        </div>
      </td>
      <td class="volume">${formatVolume(displayData.volume)}</td>
    `;
    tbody.appendChild(tr);
  });

  // 별 클릭 이벤트 등록 (SVG polygon 클릭도 포함)
  tbody.querySelectorAll(".favorite-star").forEach((star) => {
    star.addEventListener("click", async (e) => {
      const code = star.getAttribute("data-code");
      const tr = star.closest("tr");
      const marketAttr =
        tr && tr.getAttribute("data-market")
          ? tr.getAttribute("data-market")
          : market || "KOSPI";
      toggleFavorite(code, marketAttr);
      // 즐겨찾기 모드라면 즐겨찾기 리스트를 즉시 다시 필터링해서 렌더링
      if (window.showingFavorites) {
        const favorites = getFavorites(marketAttr);
        const allStocks = getFilteredStocks();

        // 1. 테이블에 있는 즐겨찾기 종목 (시세 상위 100개 중)
        const favoriteStocksInTable = allStocks.filter((stock) =>
          favorites.includes(stock.code)
        );

        // 2. 테이블에 없는 즐겨찾기 종목 코드 (검색으로 추가된 종목들)
        const codesInTable = allStocks.map((stock) => stock.code);
        const codesNotInTable = favorites.filter(
          (code) => !codesInTable.includes(code)
        );

        // 3. 없는 종목은 API로 조회 (검색으로 추가된 종목들)
        let favoriteStocksNotInTable = [];
        if (codesNotInTable.length > 0) {
          // API 호출을 위해 dataManager에서 fetchStockData 가져오기
          const { fetchStockData } = await import("./dataManager.js");
          const fetched = await fetchStockData(codesNotInTable, marketAttr);

          // 심볼 이름 매핑을 위해 stockSymbols 가져오기
          const { stockSymbols } = await import("./stockSymbols.js");
          const marketSymbols = stockSymbols[marketAttr] || [];

          favoriteStocksNotInTable = fetched.map((d) => {
            const code = d.stck_shrn_iscd || d.code;
            const symbol = marketSymbols.find((s) => s.code === code);
            return {
              code,
              name: symbol ? symbol.name : "",
              market: marketAttr,
              price: parseFloat(d.stck_prpr || d.price) || 0,
              change_rate: parseFloat(d.prdy_ctrt || d.chgrate) || 0,
              change_price: parseFloat(d.prdy_vrss || d.change) || 0,
              volume: parseFloat(d.acml_vol || d.volume) || 0,
            };
          });
        }

        // 4. 두 결과 합치기
        const allFavoriteStocks = favoriteStocksInTable.concat(
          favoriteStocksNotInTable
        );

        // 5. 즐겨찾기 배열 순서대로 정렬 (등록한 순서대로 위에서부터 아래로)
        const sortedFavoriteStocks = favorites
          .map((favoriteCode) => {
            const stock = allFavoriteStocks.find(
              (s) => s.code === favoriteCode
            );
            return stock;
          })
          .filter(Boolean); // undefined 제거

        // 6. 안내문구 처리
        if (sortedFavoriteStocks.length === 0) {
          const tbody = document.getElementById("stock-tbody");
          tbody.innerHTML = `<tr><td colspan="4"><div class="empty-favorites-container"><div class="empty-favorites-text">즐겨찾기한 종목이 없습니다.</div><button id="back-to-all-btn" class="btn-back-all">전체보기</button></div></td></tr>`;
          setFavoriteStocks([]); // 빈 배열로 설정
          // 전체보기 버튼 이벤트 바인딩 추가
          const backBtn = document.getElementById("back-to-all-btn");
          if (backBtn) {
            backBtn.onclick = () => {
              const searchInput = document.getElementById("search");
              const favBtn = document.getElementById("show-favorites-btn");
              if (searchInput) {
                searchInput.value = "";
                searchInput.dispatchEvent(new Event("input"));
              }
              if (favBtn) favBtn.classList.remove("active");
              window.showingFavorites = false;
            };
          }
        } else {
          setFavoriteStocks(sortedFavoriteStocks); // 즐겨찾기 목록 설정
          renderTable(sortedFavoriteStocks, false, marketAttr);
        }
      } else {
        renderTable(data, false, marketAttr); // 기존 동작 유지
      }
    });
  });

  setupRowObservers();
}

//헤더 렌더링
export function renderTableHeader(currentMarket = "KOSPI") {
  const thead = document.querySelector(".stock-table thead tr");
  thead.innerHTML = "";
  headerDefs.forEach((h, idx) => {
    const th = document.createElement("th");
    th.innerHTML = h.label + (h.key ? getSortIcon(h.key) : "");
    if (h.key) {
      th.classList.add("sortable");
      th.dataset.key = h.key;
      th.addEventListener("click", () => sortStocks(h.key, currentMarket));
    }
    thead.appendChild(th);
  });
}

export function updateHeaderArrows() {
  const ths = document.querySelectorAll(".stock-table th");
  headerDefs.forEach((h, idx) => {
    if (!h.key) return;
    ths[idx].innerHTML = h.label + getSortIcon(h.key);
  });
}

// 주식 행 업데이트
export function updateStockRow(stockCode) {
  const row = document.querySelector(`tr[data-code='${stockCode}']`);
  if (!row) return;

  const data = realTimeData.get(stockCode);
  if (!data) return;

  const priceCell = row.querySelector("td:nth-child(2)");
  const changeCell = row.querySelector("td:nth-child(3)");
  const volumeCell = row.querySelector("td:nth-child(4)");

  // 클래스 업데이트
  const changeClass = getChangeClass(data.change_rate);
  priceCell.className = changeClass;
  changeCell.className = changeClass;

  // 가격 변동에 따른 강조 효과: UI에 표시된 가격이 변할 때만
  const formattedPrice = formatNumber(data.price);
  if (priceCell.textContent !== formattedPrice) {
    if (data.change_price > 0) {
      priceCell.classList.add("price-update-rise");
      setTimeout(() => priceCell.classList.remove("price-update-rise"), 1000);
    } else if (data.change_price < 0) {
      priceCell.classList.add("price-update-fall");
      setTimeout(() => priceCell.classList.remove("price-update-fall"), 1000);
    }
  }

  // 가격 업데이트
  priceCell.textContent = formattedPrice;

  // 전일대비 업데이트
  changeCell.innerHTML = `
    <div class="change-rate ${getChangeClass(data.change_rate)}">${
    data.change_rate > 0 ? "+" : data.change_rate < 0 ? "-" : ""
  }${Math.abs(data.change_rate).toFixed(2)}%</div>
    <div class="change-price ${getChangeClass(data.change_rate)}">
      <span class="arrow">${
        data.change_price > 0 ? "▲" : data.change_price < 0 ? "▼" : ""
      }</span>
      ${formatNumber(Math.abs(data.change_price))}
    </div>
  `;

  // 거래량 업데이트
  if (volumeCell) {
    volumeCell.textContent = formatVolume(data.volume);
  }
}

// 유틸리티 함수들
export function formatNumber(num) {
  return Number(num).toLocaleString();
}

export function getChangeClass(rate) {
  if (rate > 0) return "text-rise";
  if (rate < 0) return "text-fall";
  return "text-even";
}

export function formatVolume(val) {
  if (!val || isNaN(val)) {
    return 0;
  }
  return Math.floor(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function getSortIcon(key) {
  if (!key) return "";
  const isActive = sortKey === key;
  let iconClass = "fas fa-sort sort-icon";
  if (isActive) {
    iconClass =
      sortOrder === "asc"
        ? "fas fa-sort-up sort-icon sort-active"
        : "fas fa-sort-down sort-icon sort-active";
  }
  return `<i class="${iconClass}"></i>`;
}

export function showLoading(show) {
  const loader = document.getElementById("loader");
  if (show) {
    loader.style.display = "flex";
  } else {
    loader.style.display = "none";
  }
}

export function showNotification(message, type = "info") {
  // 기존 알림 제거
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px 15px;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    z-index: 1000;
    max-width: 300px;
    word-wrap: break-word;
  `;

  if (type === "error") {
    notification.style.backgroundColor = "#d32f2f";
  } else if (type === "success") {
    notification.style.backgroundColor = "#2e7d32";
  } else {
    notification.style.backgroundColor = "#1976d2";
  }

  document.body.appendChild(notification);

  // 5초 후 자동 제거
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// 정렬 함수
export function sortStocks(key, market = "KOSPI") {
  if (sortKey === key) {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortOrder = "desc";
  }

  // 현재 모드에 따라 다른 데이터를 정렬
  const stocksToSort = window.showingFavorites
    ? favoriteStocks
    : filteredStocks;

  // 즐겨찾기 모드이고 즐겨찾기 목록이 비어있으면 정렬하지 않음
  if (window.showingFavorites && favoriteStocks.length === 0) {
    return; // 안내문구 유지
  }

  stocksToSort.sort((a, b) => {
    const aData = realTimeData.get(a.code) || a;
    const bData = realTimeData.get(b.code) || b;

    if (aData[key] < bData[key]) return sortOrder === "asc" ? -1 : 1;
    if (aData[key] > bData[key]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  currentPage = 1;

  // 현재 모드에 따라 다른 데이터를 렌더링
  if (window.showingFavorites) {
    renderTable(favoriteStocks, false, market);
  } else {
    renderTable(filteredStocks, false, market);
  }

  updateHeaderArrows();
}

// 데이터 관리 함수들
export function setFilteredStocks(stocks) {
  filteredStocks = stocks;
  currentPage = 1;
  // 구독 요청은 handleRowVisibility에서만 처리
}

// 실시간 데이터 구독 업데이트 함수
async function updateRealTimeSubscriptions(stockCodes) {
  try {
    // 최대 41개까지만 구독 요청
    const limitedCodes = Array.from(stockCodes).slice(0, 41);
    // 백그라운드에 실시간 데이터 구독 업데이트 요청
    await chrome.runtime.sendMessage({
      type: "START_REAL_TIME",
      data: limitedCodes,
    });
  } catch (error) {
    console.error("실시간 데이터 구독 설정 실패:", error);
  }
}

export function getFilteredStocks() {
  return filteredStocks;
}

export function setFavoriteStocks(stocks) {
  favoriteStocks = stocks;
}

export function getFavoriteStocks() {
  return favoriteStocks;
}

export function setRealTimeData(code, data) {
  realTimeData.set(code, {
    ...data,
    timestamp: Date.now(),
  });
}

export function getRealTimeData() {
  return realTimeData;
}

export function getCurrentPage() {
  return currentPage;
}

export function setCurrentPage(page) {
  currentPage = page;
}

export function getPageSize() {
  return PAGE_SIZE;
}

// 스크롤 위치 초기화 함수
export function resetScrollPosition() {
  const tableBody = document.querySelector(".table-body");
  if (tableBody) {
    tableBody.scrollTop = 0;
  }
  const ssContent = document.querySelector(".table-body .ss-content");
  if (ssContent) {
    ssContent.scrollTop = 0;
  }
}

// 스크롤 이벤트에도 구독 갱신
const tableBody = document.querySelector(".table-body");
if (tableBody) {
  tableBody.addEventListener("scroll", () => {
    setupRowObservers();
  });
}
