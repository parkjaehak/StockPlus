// popup.js - 메인 팝업 로직

import {
  renderTableHeader,
  setRealTimeData,
  updateStockRow,
  renderTable,
  getFilteredStocks,
  updateHeaderArrows,
  setFavoriteStocks,
  showServerStatus,
} from "./uiManager.js";
import {
  filterStocks,
  filterByMarket,
  stopRealTimeData,
  debounceSearch,
  getFavorites,
} from "./dataManager.js";
import { stockSymbols } from "./stockSymbols.js";
import {
  MARKET_CONSTANTS,
  ERROR_MESSAGES,
  API_CONSTANTS,
} from "../constants.js";

// 실시간 데이터 업데이트 리스너 (가장 먼저 설정)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REAL_TIME_UPDATE") {
    setRealTimeData(message.data.code, message.data);
    updateStockRow(message.data.code);
  }
});

// 전역 상태 관리
const APP_STATE = {
  showingFavorites: false,
  isSearchMode: false,
  currentMarket: MARKET_CONSTANTS.DEFAULT_MARKET,
};

// 기존 호환성을 위한 전역 변수
let currentMarket = MARKET_CONSTANTS.DEFAULT_MARKET;

// 상태 업데이트 함수들
function setShowingFavorites(value) {
  APP_STATE.showingFavorites = value;
  window.showingFavorites = value; // 기존 호환성 유지
}

function setSearchMode(value) {
  APP_STATE.isSearchMode = value;
  window.isSearchMode = value; // 기존 호환성 유지
}

function setCurrentMarket(market) {
  APP_STATE.currentMarket = market;
  currentMarket = market; // 기존 호환성 유지
}

/**
 * 서버 연결 상태 확인
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function checkServerConnection() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_CONNECTION",
    });

    if (response.success) {
      const status = response.data;
      showServerStatus(status);

      if (status.server === "disconnected") {
        console.error("서버 연결 실패:", status.error);
        showServerStatus({
          server: "disconnected",
          error: ERROR_MESSAGES.SERVER_CONNECTION_FAILED,
        });
        return false;
      }
      return true;
    } else {
      console.error("서버 연결 테스트 실패:", response.error);
      showServerStatus({
        server: "disconnected",
        error: response.error,
      });
      return false;
    }
  } catch (error) {
    console.error("서버 연결 확인 중 오류:", error);
    showServerStatus({
      server: "disconnected",
      error: "서버 연결 확인 중 오류가 발생했습니다.",
    });
    return false;
  }
}

/**
 * 초기화 함수
 */
async function initialRender() {
  // 서버 연결 상태 확인
  const isConnected = await checkServerConnection();

  // 서버 연결 실패해도 UI는 초기화
  initializeUI();

  if (isConnected) {
    await loadInitialData();
  }
}

/**
 * UI 초기화
 */
function initializeUI() {
  renderTableHeader(APP_STATE.currentMarket);

  const marketSelect = document.getElementById("market-select");
  if (marketSelect) {
    setCurrentMarket(marketSelect.value);
  }
}

/**
 * 초기 데이터 로드
 */
async function loadInitialData() {
  const marketSelect = document.getElementById("market-select");
  if (marketSelect) {
    await filterByMarket(marketSelect);
  }
}

/**
 * 마켓 변경 핸들러
 */
async function handleMarketChange() {
  const marketSelect = document.getElementById("market-select");
  const favBtn = document.getElementById("show-favorites-btn");

  setCurrentMarket(marketSelect.value);
  renderTableHeader(APP_STATE.currentMarket);
  await filterByMarket(marketSelect);

  if (favBtn) {
    favBtn.classList.remove("active");
  }
  setShowingFavorites(false);
}

/**
 * 검색 핸들러
 */
async function handleSearch() {
  const searchInput = document.getElementById("search");
  const marketSelect = document.getElementById("market-select");
  const keyword = searchInput.value.trim().toLowerCase();

  if (APP_STATE.showingFavorites) {
    if (keyword) {
      // 검색어가 있으면 즐겨찾기 내에서 검색
      setSearchMode(true);
      await searchInFavorites(keyword);
    } else {
      // 검색어가 없으면 일반 즐겨찾기 표시
      setSearchMode(false);
      await showAllFavorites();
    }
  } else {
    // 전체보기(홈화면)에서 검색어가 비어있으면 전체 리스트를 다시 불러오도록 수정
    if (!keyword) {
      await filterStocks(searchInput, marketSelect, stockSymbols);
      return;
    }
    // 기존 전체검색 로직
    await filterStocks(searchInput, marketSelect, stockSymbols);
  }
}

/**
 * 즐겨찾기 내에서 검색하는 함수
 */
async function searchInFavorites(keyword) {
  const favorites = getFavorites(APP_STATE.currentMarket);
  if (!favorites || favorites.length === 0) {
    // 즐겨찾기가 비어있으면 검색 결과도 없음
    setFavoriteStocks([]);
    renderTable([], false, APP_STATE.currentMarket);
    return;
  }

  const allStocks = getFilteredStocks();
  // 1. 테이블에 있는 즐겨찾기 종목
  const favoriteStocksInTable = allStocks.filter((stock) =>
    favorites.includes(stock.code)
  );
  // 2. 테이블에 없는 즐겨찾기 종목 코드
  const codesInTable = allStocks.map((stock) => stock.code);
  const codesNotInTable = favorites.filter(
    (code) => !codesInTable.includes(code)
  );
  // 3. 없는 종목은 API로 조회
  let favoriteStocksNotInTable = [];
  if (codesNotInTable.length > 0) {
    const fetched = await import("./dataManager.js").then((m) =>
      m.fetchStockData(codesNotInTable, APP_STATE.currentMarket)
    );
    // 심볼 이름 매핑
    const marketSymbols = stockSymbols[APP_STATE.currentMarket] || [];
    favoriteStocksNotInTable = fetched.map((d) => {
      const code = d.stck_shrn_iscd || d.code;
      const symbol = marketSymbols.find((s) => s.code === code);
      return {
        code,
        name: symbol ? symbol.name : "",
        market: APP_STATE.currentMarket,
        price: parseFloat(d.stck_prpr || d.price) || 0,
        change_rate: parseFloat(d.prdy_ctrt || d.chgrate) || 0,
        change_price: parseFloat(d.prdy_vrss || d.change) || 0,
        volume: parseFloat(d.acml_vol || d.volume) || 0,
      };
    });
  }
  // 4. 전체 즐겨찾기 종목 합치기
  const allFavoriteStocks = favoriteStocksInTable.concat(
    favoriteStocksNotInTable
  );
  // 5. 즐겨찾기 배열 순서대로 정렬 (등록한 순서대로 위에서부터 아래로)
  const sortedFavoriteStocks = favorites
    .map((favoriteCode) => {
      const stock = allFavoriteStocks.find((s) => s.code === favoriteCode);
      return stock;
    })
    .filter(Boolean); // undefined 제거

  // 6. 검색어로 필터링
  const filteredFavorites = sortedFavoriteStocks.filter(
    (stock) =>
      stock.name.toLowerCase().includes(keyword) || stock.code.includes(keyword)
  );

  setFavoriteStocks(filteredFavorites);
  renderTable(filteredFavorites, false, APP_STATE.currentMarket);
}

/**
 * 모든 즐겨찾기 표시하는 함수
 */
async function showAllFavorites() {
  const favorites = getFavorites(APP_STATE.currentMarket);
  if (!favorites || favorites.length === 0) {
    // 즐겨찾기 데이터가 없을 때 안내 문구와 전체보기 버튼 표시
    showEmptyFavoritesMessage();
    return;
  }

  const allStocks = getFilteredStocks();
  // 1. 이미 로드된 데이터(시가총액 상위 100개)에서 즐겨찾기 필터링
  const favoriteStocksInTable = allStocks.filter((stock) =>
    favorites.includes(stock.code)
  );
  // 2. 즐겨찾기 코드 중 테이블에 없는 종목만 추출
  const codesInTable = allStocks.map((stock) => stock.code);
  const codesNotInTable = favorites.filter(
    (code) => !codesInTable.includes(code)
  );
  // 3. 없는 종목만 API 호출 (현재 마켓만)
  let favoriteStocksNotInTable = [];
  const marketSymbols = (stockSymbols[APP_STATE.currentMarket] || []).map(
    (s) => s.code
  );
  const codesInMarket = codesNotInTable.filter((code) =>
    marketSymbols.includes(code)
  );
  if (codesInMarket.length > 0) {
    const fetched = await import("./dataManager.js").then((m) =>
      m.fetchStockData(codesInMarket, APP_STATE.currentMarket)
    );
    favoriteStocksNotInTable = fetched.map((d) => {
      const code = d.stck_shrn_iscd || d.code;
      const symbol = (stockSymbols[APP_STATE.currentMarket] || []).find(
        (s) => s.code === code
      );
      return {
        code,
        name: symbol ? symbol.name : "",
        market: APP_STATE.currentMarket,
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
    .filter(Boolean); // undefined 제거

  setFavoriteStocks(sortedFavoriteStocks); // 즐겨찾기 목록 설정
  renderTable(sortedFavoriteStocks, false, APP_STATE.currentMarket);

  const favBtn = document.getElementById("show-favorites-btn");
  if (favBtn) {
    favBtn.classList.add("active");
  }
}

/**
 * 빈 즐겨찾기 메시지 표시
 */
function showEmptyFavoritesMessage() {
  const tbody = document.getElementById("stock-tbody");
  const favBtn = document.getElementById("show-favorites-btn");
  const searchInput = document.getElementById("search");

  tbody.innerHTML = `<tr><td colspan="4"><div class="empty-favorites-container"><div class="empty-favorites-text">즐겨찾기한 종목이 없습니다.</div><button id="back-to-all-btn" class="btn-back-all">전체보기</button></div></td></tr>`;
  favBtn.classList.add("active");
  setFavoriteStocks([]); // 빈 배열로 설정

  document.getElementById("back-to-all-btn").onclick = () => {
    if (searchInput) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
    }
    favBtn.classList.remove("active");
    setShowingFavorites(false);
  };
}

/**
 * 즐겨찾기 토글 핸들러
 */
async function handleFavoriteToggle() {
  const searchInput = document.getElementById("search");
  const favBtn = document.getElementById("show-favorites-btn");
  const marketSelect = document.getElementById("market-select");

  if (!APP_STATE.showingFavorites) {
    // 즐겨찾기 모드로 전환
    setShowingFavorites(true);
    setSearchMode(false);
    if (searchInput) {
      searchInput.value = "";
    }
    await showAllFavorites();
  } else {
    // 메인 모드로 전환
    if (searchInput) {
      searchInput.value = "";
    }
    favBtn.classList.remove("active");
    setShowingFavorites(false);
    setSearchMode(false);

    // 메인 데이터가 있으면 바로 표시, 없으면 API 호출
    const existingData = getFilteredStocks();
    if (existingData.length > 0) {
      renderTable(existingData, false, APP_STATE.currentMarket);
    } else {
      await filterByMarket(marketSelect);
    }
  }
}

/**
 * 검색창 전체삭제 버튼 설정
 */
function setupSearchClearButton() {
  const searchInput = document.getElementById("search");
  const searchClear = document.getElementById("search-clear");

  if (searchInput && searchClear) {
    searchInput.addEventListener("input", function () {
      searchClear.style.display = this.value ? "block" : "none";
    });

    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.focus();
    });
  }
}

/**
 * 리소스 정리 함수
 * 메모리 누수 방지를 위한 정리 작업
 */
function cleanupResources() {
  // 실시간 데이터 중지
  stopRealTimeData();

  // 캐시 무효화
  import("../utils.js")
    .then(({ invalidateCache }) => {
      invalidateCache();
    })
    .catch(console.error);

  // 이벤트 리스너 정리
  const searchInput = document.getElementById("search");
  const marketSelect = document.getElementById("market-select");
  const favBtn = document.getElementById("show-favorites-btn");

  if (searchInput) {
    searchInput.removeEventListener("input", debouncedFilterStocks);
  }

  if (marketSelect) {
    marketSelect.removeEventListener("change", handleMarketChange);
  }

  if (favBtn) {
    favBtn.removeEventListener("click", handleFavoriteToggle);
  }

  console.log("리소스 정리 완료");
}

// 이벤트 리스너 설정
function setupEventListeners() {
  const marketSelect = document.getElementById("market-select");
  const searchInput = document.getElementById("search");
  const favBtn = document.getElementById("show-favorites-btn");

  // 마켓 선택 이벤트
  marketSelect.addEventListener("change", handleMarketChange);

  // 검색 이벤트 (디바운싱 적용)
  const debouncedFilterStocks = debounceSearch(
    handleSearch,
    API_CONSTANTS.DEBOUNCE_DELAY
  );
  searchInput.addEventListener("input", debouncedFilterStocks);

  // 페이지 언로드시 정리 작업
  window.addEventListener("beforeunload", cleanupResources);

  // 검색창 전체삭제(X) 버튼 기능
  setupSearchClearButton();

  // 즐겨찾기 버튼 토글 기능
  if (favBtn) {
    favBtn.addEventListener("click", handleFavoriteToggle);
  }
}

/**
 * 앱 초기화
 */
function initializeApp() {
  initialRender();
  setupEventListeners();
  focusSearchInput();
}

/**
 * 검색창 포커스
 */
function focusSearchInput() {
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.focus();
  }
}

// 초기화 실행
document.addEventListener("DOMContentLoaded", initializeApp);
