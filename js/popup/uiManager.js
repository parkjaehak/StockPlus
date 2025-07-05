// uiManager.js - UI 관리 및 렌더링

import { getFavorites, toggleFavorite } from "./dataManager.js";
import {
  formatNumber,
  getChangeClass,
  formatVolume,
  showNotification,
  showLoading,
  resetScrollPosition,
  isEmptyArray,
} from "../utils.js";

import {
  UI_CONSTANTS,
  SORT_CONSTANTS,
  TABLE_HEADERS,
  CSS_CLASSES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  MARKET_CONSTANTS,
  API_CONSTANTS,
} from "../constants.js";

// 정렬 상태
let sortKey = null;
let sortOrder = SORT_CONSTANTS.DEFAULT_ORDER;

// 무한 스크롤 관련
let currentPage = 1;
let filteredStocks = [];
let favoriteStocks = []; // 즐겨찾기 목록 별도 관리
let realTimeData = new Map();
let prevPriceMap = new Map(); // 종목별 이전 가격 저장

let visibleRowCodes = new Set();
let observer = null;

/**
 * 서버 상태 표시 함수
 * @param {Object} status - 서버 상태 객체
 */
export function showServerStatus(status) {
  // 기존 상태 표시 요소 제거
  const existingStatus = document.querySelector(
    `.${CSS_CLASSES.SERVER_STATUS}`
  );
  if (existingStatus) {
    existingStatus.remove();
  }

  // 상태 표시 요소 생성
  const statusElement = document.createElement("div");
  statusElement.className = CSS_CLASSES.SERVER_STATUS;

  if (status.server === "connected") {
    statusElement.innerHTML = `
      <div class="${CSS_CLASSES.STATUS_INDICATOR} connected">
        <span class="${CSS_CLASSES.STATUS_DOT}"></span>
        <span class="${CSS_CLASSES.STATUS_TEXT}">${SUCCESS_MESSAGES.SERVER_CONNECTED}</span>
      </div>
    `;
    statusElement.style.display = "none"; // 연결되면 숨김
  } else {
    statusElement.innerHTML = `
      <div class="${CSS_CLASSES.STATUS_INDICATOR} disconnected">
        <span class="${CSS_CLASSES.STATUS_DOT}"></span>
        <span class="${CSS_CLASSES.STATUS_TEXT}">${
      STATUS_MESSAGES.SERVER_DISCONNECTED
    }</span>
        <span class="${CSS_CLASSES.STATUS_ERROR}">${
      status.error || STATUS_MESSAGES.UNKNOWN_ERROR
    }</span>
      </div>
    `;
    statusElement.style.display = "block";
  }

  // 팝업 상단에 추가
  const popup = document.querySelector(".popup-container") || document.body;
  popup.insertBefore(statusElement, popup.firstChild);
}

/**
 * 행 가시성 변경 처리
 * @param {Array} entries - IntersectionObserver 엔트리 배열
 */
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
    const codes = Array.from(visibleRowCodes).slice(
      0,
      UI_CONSTANTS.MAX_SUBSCRIPTIONS
    );
    updateRealTimeSubscriptions(codes);
  }
}

/**
 * 행 관찰자 설정
 */
function setupRowObservers() {
  // 기존 Observer 해제
  if (observer) observer.disconnect();
  visibleRowCodes.clear();

  observer = new IntersectionObserver(handleRowVisibility, {
    root:
      document.querySelector(".table-body .ss-content") ||
      document.querySelector(".table-body"),
    threshold: UI_CONSTANTS.INTERSECTION_THRESHOLD,
  });

  // 모든 tr에 Observer 등록
  document.querySelectorAll("#stock-tbody tr").forEach((tr) => {
    observer.observe(tr);
  });
}

/**
 * 테이블 렌더링
 * @param {Array} data - 렌더링할 주식 데이터 배열
 * @param {boolean} append - 기존 데이터에 추가할지 여부
 * @param {string} market - 마켓 코드
 */
export function renderTable(
  data,
  append = false,
  market = MARKET_CONSTANTS.DEFAULT_MARKET
) {
  const tbody = document.getElementById("stock-tbody");
  if (!append) tbody.innerHTML = "";

  // 즐겨찾기 모드인지 확인
  const isFavoritesMode = window.showingFavorites;
  const favorites = isFavoritesMode
    ? data.map((stock) => stock.code)
    : getFavorites(market);

  data.forEach((stock) => {
    const tr = createStockRow(stock, favorites, market);
    tbody.appendChild(tr);
  });

  // 별 클릭 이벤트 등록
  setupFavoriteClickEvents(tbody, market);

  // 무한 스크롤을 위한 Observer 설정
  setupRowObservers();
}

/**
 * 주식 행 생성
 * @param {Object} stock - 주식 데이터
 * @param {Array} favorites - 즐겨찾기 목록
 * @param {string} market - 마켓 코드
 * @returns {HTMLElement} 생성된 tr 요소
 */
function createStockRow(stock, favorites, market) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-code", stock.code);
  tr.setAttribute(
    "data-market",
    stock.market || market || MARKET_CONSTANTS.DEFAULT_MARKET
  );

  // 실시간 데이터가 있으면 사용, 없으면 기본 데이터 사용
  const displayData = realTimeData.get(stock.code) || stock;

  const isFavorite = favorites.includes(stock.code);
  const starIcon = createStarIcon(stock.code, isFavorite);

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
        ${getChangeRateText(displayData.change_rate)}
      </div>
      <div class="change-price ${getChangeClass(displayData.change_rate)}">
        <span class="arrow">${getChangeArrow(displayData.change_price)}</span>
        ${formatNumber(Math.abs(displayData.change_price))}
      </div>
    </td>
    <td class="volume">${formatVolume(displayData.volume)}</td>
  `;

  return tr;
}

/**
 * 별 아이콘 생성
 * @param {string} code - 종목 코드
 * @param {boolean} isFavorite - 즐겨찾기 여부
 * @returns {string} SVG 별 아이콘 HTML
 */
function createStarIcon(code, isFavorite) {
  const activeClass = isFavorite ? ` ${CSS_CLASSES.FAVORITE_ACTIVE}` : "";
  return `<svg class="favorite-star${activeClass}" data-code="${code}" width="18" height="18" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9"/></svg>`;
}

/**
 * 등락률 텍스트 생성
 * @param {number} changeRate - 등락률
 * @returns {string} 등락률 텍스트
 */
function getChangeRateText(changeRate) {
  const sign = changeRate > 0 ? "+" : changeRate < 0 ? "-" : "";
  return `${sign}${Math.abs(changeRate).toFixed(2)}%`;
}

/**
 * 등락 화살표 생성
 * @param {number} changePrice - 등락가
 * @returns {string} 화살표 문자
 */
function getChangeArrow(changePrice) {
  if (changePrice > 0) return "▲";
  if (changePrice < 0) return "▼";
  return "";
}

/**
 * 즐겨찾기 클릭 이벤트 설정
 * @param {HTMLElement} tbody - 테이블 본문 요소
 * @param {string} market - 마켓 코드
 */
async function setupFavoriteClickEvents(tbody, market) {
  tbody.querySelectorAll(".favorite-star").forEach((star) => {
    star.addEventListener("click", async (e) => {
      const code = star.getAttribute("data-code");
      const tr = star.closest("tr");
      const marketAttr =
        tr?.getAttribute("data-market") ||
        market ||
        MARKET_CONSTANTS.DEFAULT_MARKET;

      // 즉시 시각적 피드백 제공
      const isCurrentlyFavorite = star.classList.contains(
        CSS_CLASSES.FAVORITE_ACTIVE
      );
      if (isCurrentlyFavorite) {
        star.classList.remove(CSS_CLASSES.FAVORITE_ACTIVE);
      } else {
        star.classList.add(CSS_CLASSES.FAVORITE_ACTIVE);
      }

      toggleFavorite(code, marketAttr);

      // 즐겨찾기 모드라면 즐겨찾기 리스트를 즉시 다시 필터링해서 렌더링
      if (window.showingFavorites) {
        await updateFavoritesDisplay(marketAttr);
      } else {
        // 일반 모드에서는 클릭한 별 아이콘만 업데이트
        const favorites = getFavorites(marketAttr);
        const isFavorite = favorites.includes(code);

        // 실제 상태와 시각적 상태가 다르면 수정
        if (isFavorite !== !isCurrentlyFavorite) {
          if (isFavorite) {
            star.classList.add(CSS_CLASSES.FAVORITE_ACTIVE);
          } else {
            star.classList.remove(CSS_CLASSES.FAVORITE_ACTIVE);
          }
        }
      }
    });
  });
}

/**
 * 즐겨찾기 표시 업데이트
 * @param {string} marketAttr - 마켓 코드
 */
async function updateFavoritesDisplay(marketAttr) {
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
    const { fetchStockData } = await import("./dataManager.js");
    const fetched = await fetchStockData(codesNotInTable, marketAttr);

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
      const stock = allFavoriteStocks.find((s) => s.code === favoriteCode);
      return stock;
    })
    .filter(Boolean);

  // 6. 안내문구 처리
  if (isEmptyArray(sortedFavoriteStocks)) {
    // popup.js의 showEmptyFavoritesMessage 함수 호출
    import("./popup.js")
      .then(({ showEmptyFavoritesMessage }) => {
        showEmptyFavoritesMessage();
      })
      .catch(() => {
        // fallback: 로컬 함수 사용
        showEmptyFavoritesMessageLocal();
      });
  } else {
    setFavoriteStocks(sortedFavoriteStocks);
    renderTable(sortedFavoriteStocks, false, marketAttr);
  }
}

/**
 * 빈 즐겨찾기 메시지 표시 (로컬 fallback)
 */
function showEmptyFavoritesMessageLocal() {
  const tbody = document.getElementById("stock-tbody");
  tbody.innerHTML = `<tr><td colspan="4"><div class="${CSS_CLASSES.EMPTY_FAVORITES_CONTAINER}"><div class="${CSS_CLASSES.EMPTY_FAVORITES_TEXT}">즐겨찾기한 종목이 없습니다.</div><button id="back-to-all-btn" class="${CSS_CLASSES.BTN_BACK_ALL}">전체보기</button></div></td></tr>`;
  setFavoriteStocks([]);
}

/**
 * 테이블 헤더 렌더링
 * @param {string} currentMarket - 현재 마켓 코드
 */
export function renderTableHeader(
  currentMarket = MARKET_CONSTANTS.DEFAULT_MARKET
) {
  const thead = document.querySelector(".stock-table thead tr");
  thead.innerHTML = "";

  TABLE_HEADERS.forEach((header) => {
    const th = document.createElement("th");
    th.innerHTML = header.label + (header.key ? getSortIcon(header.key) : "");

    if (header.key) {
      th.classList.add(CSS_CLASSES.SORTABLE);
      th.dataset.key = header.key;
      th.addEventListener("click", () => sortStocks(header.key, currentMarket));
    }

    thead.appendChild(th);
  });
}

/**
 * 헤더 화살표 업데이트
 */
export function updateHeaderArrows() {
  const headers = document.querySelectorAll(
    `.stock-table thead th.${CSS_CLASSES.SORTABLE}`
  );

  headers.forEach((header) => {
    const key = header.dataset.key;
    if (key === sortKey) {
      header.classList.add(CSS_CLASSES.SORT_ACTIVE);
      header.innerHTML = header.innerHTML.replace(
        /<i class="fas fa-sort sort-icon">/g,
        `<i class="fas fa-sort-${
          sortOrder === SORT_CONSTANTS.ASC ? "up" : "down"
        } sort-icon">`
      );
    } else {
      header.classList.remove(CSS_CLASSES.SORT_ACTIVE);
      header.innerHTML = header.innerHTML.replace(
        /<i class="fas fa-sort-(up|down) sort-icon">/g,
        `<i class="fas fa-sort sort-icon">`
      );
    }
  });
}

/**
 * 주식 행 업데이트
 * @param {string} stockCode - 주식 코드
 */
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
  updatePriceWithHighlight(priceCell, data);

  // 전일대비 업데이트
  updateChangeInfo(changeCell, data);

  // 거래량 업데이트
  if (volumeCell) {
    volumeCell.textContent = formatVolume(data.volume);
  }
}

/**
 * 가격 업데이트 및 강조 효과 적용
 * @param {HTMLElement} priceCell - 가격 셀 요소
 * @param {Object} data - 주식 데이터
 */
function updatePriceWithHighlight(priceCell, data) {
  const formattedPrice = formatNumber(data.price);
  if (priceCell.textContent !== formattedPrice) {
    if (data.change_price > 0) {
      priceCell.classList.add(CSS_CLASSES.PRICE_UPDATE_RISE);
      setTimeout(
        () => priceCell.classList.remove(CSS_CLASSES.PRICE_UPDATE_RISE),
        UI_CONSTANTS.PRICE_UPDATE_DURATION
      );
    } else if (data.change_price < 0) {
      priceCell.classList.add(CSS_CLASSES.PRICE_UPDATE_FALL);
      setTimeout(
        () => priceCell.classList.remove(CSS_CLASSES.PRICE_UPDATE_FALL),
        UI_CONSTANTS.PRICE_UPDATE_DURATION
      );
    }
  }
  priceCell.textContent = formattedPrice;
}

/**
 * 전일대비 정보 업데이트
 * @param {HTMLElement} changeCell - 전일대비 셀 요소
 * @param {Object} data - 주식 데이터
 */
function updateChangeInfo(changeCell, data) {
  changeCell.innerHTML = `
    <div class="change-rate ${getChangeClass(
      data.change_rate
    )}">${getChangeRateText(data.change_rate)}</div>
    <div class="change-price ${getChangeClass(data.change_rate)}">
      <span class="arrow">${getChangeArrow(data.change_price)}</span>
      ${formatNumber(Math.abs(data.change_price))}
    </div>
  `;
}

/**
 * 정렬 아이콘 생성
 * @param {string} key - 정렬 키
 * @returns {string} 정렬 아이콘 HTML
 */
export function getSortIcon(key) {
  if (!key) return "";

  const isActive = sortKey === key;
  let iconClass = CSS_CLASSES.SORT_ICON;

  if (isActive) {
    iconClass =
      sortOrder === SORT_CONSTANTS.ASC
        ? "fas fa-sort-up sort-icon sort-active"
        : "fas fa-sort-down sort-icon sort-active";
  }

  return `<i class="${iconClass}"></i>`;
}

/**
 * 주식 데이터 정렬
 * @param {string} key - 정렬 키
 * @param {string} market - 마켓 코드
 */
export function sortStocks(key, market = MARKET_CONSTANTS.DEFAULT_MARKET) {
  // 정렬 순서 토글
  if (sortKey === key) {
    sortOrder =
      sortOrder === SORT_CONSTANTS.ASC
        ? SORT_CONSTANTS.DESC
        : SORT_CONSTANTS.ASC;
  } else {
    sortKey = key;
    sortOrder = SORT_CONSTANTS.DESC;
  }

  // 현재 모드에 따라 다른 데이터를 정렬
  const stocksToSort = window.showingFavorites
    ? favoriteStocks
    : filteredStocks;

  // 즐겨찾기 모드이고 즐겨찾기 목록이 비어있으면 정렬하지 않음
  if (window.showingFavorites && isEmptyArray(favoriteStocks)) {
    return; // 안내문구 유지
  }

  // 데이터 정렬
  sortStockData(stocksToSort, key);

  currentPage = 1;

  // 현재 모드에 따라 다른 데이터를 렌더링
  const dataToRender = window.showingFavorites
    ? favoriteStocks
    : filteredStocks;
  renderTable(dataToRender, false, market);

  updateHeaderArrows();
}

/**
 * 주식 데이터 정렬 로직
 * @param {Array} stocks - 정렬할 주식 배열
 * @param {string} key - 정렬 키
 */
function sortStockData(stocks, key) {
  stocks.sort((a, b) => {
    const aData = realTimeData.get(a.code) || a;
    const bData = realTimeData.get(b.code) || b;

    if (aData[key] < bData[key])
      return sortOrder === SORT_CONSTANTS.ASC ? -1 : 1;
    if (aData[key] > bData[key])
      return sortOrder === SORT_CONSTANTS.ASC ? 1 : -1;
    return 0;
  });
}

/**
 * 필터링된 주식 데이터 설정
 * @param {Array} stocks - 주식 데이터 배열
 */
export function setFilteredStocks(stocks) {
  filteredStocks = stocks;
  currentPage = 1;
  // 구독 요청은 handleRowVisibility에서만 처리
}

/**
 * 실시간 데이터 구독 업데이트
 * @param {Array} stockCodes - 구독할 주식 코드 배열
 */
async function updateRealTimeSubscriptions(stockCodes) {
  try {
    // 최대 41개까지만 구독 요청
    const limitedCodes = Array.from(stockCodes).slice(
      0,
      API_CONSTANTS.MAX_SUBSCRIPTIONS
    );
    // 백그라운드에 실시간 데이터 구독 업데이트 요청
    await chrome.runtime.sendMessage({
      type: "START_REAL_TIME",
      data: limitedCodes,
    });
  } catch (error) {
    console.error("실시간 데이터 구독 설정 실패:", error);
  }
}

/**
 * 필터링된 주식 데이터 반환
 * @returns {Array} 필터링된 주식 데이터 배열
 */
export function getFilteredStocks() {
  return filteredStocks;
}

/**
 * 즐겨찾기 주식 데이터 설정
 * @param {Array} stocks - 즐겨찾기 주식 데이터 배열
 */
export function setFavoriteStocks(stocks) {
  favoriteStocks = stocks;
}

/**
 * 즐겨찾기 주식 데이터 반환
 * @returns {Array} 즐겨찾기 주식 데이터 배열
 */
export function getFavoriteStocks() {
  return favoriteStocks;
}

/**
 * 실시간 데이터 설정
 * @param {string} code - 주식 코드
 * @param {Object} data - 실시간 데이터
 */
export function setRealTimeData(code, data) {
  realTimeData.set(code, {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 실시간 데이터 반환
 * @returns {Map} 실시간 데이터 맵
 */
export function getRealTimeData() {
  return realTimeData;
}

/**
 * 현재 페이지 반환
 * @returns {number} 현재 페이지 번호
 */
export function getCurrentPage() {
  return currentPage;
}

/**
 * 현재 페이지 설정
 * @param {number} page - 페이지 번호
 */
export function setCurrentPage(page) {
  currentPage = page;
}

// 스크롤 이벤트에도 구독 갱신
const tableBody = document.querySelector(".table-body");
if (tableBody) {
  tableBody.addEventListener("scroll", () => {
    setupRowObservers();
  });
}
