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

// 실시간 데이터 업데이트 리스너 (가장 먼저 설정)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REAL_TIME_UPDATE") {
    setRealTimeData(message.data.code, message.data);
    updateStockRow(message.data.code);
  }
});

window.showingFavorites = false;
let currentMarket = "KOSPI";

// 서버 연결 상태 확인
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
        // 서버 연결 실패 시 사용자에게 알림
        showServerStatus({
          server: "disconnected",
          error: "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.",
        });
      }
    } else {
      console.error("서버 연결 테스트 실패:", response.error);
      showServerStatus({
        server: "disconnected",
        error: response.error,
      });
    }
  } catch (error) {
    console.error("서버 연결 확인 중 오류:", error);
    showServerStatus({
      server: "disconnected",
      error: "서버 연결 확인 중 오류가 발생했습니다.",
    });
  }
}

// 초기화 함수
async function initialRender() {
  // 서버 연결 상태 확인
  await checkServerConnection();

  renderTableHeader(currentMarket);
  const marketSelect = document.getElementById("market-select");
  currentMarket = marketSelect.value;
  await filterByMarket(marketSelect);
}

// 이벤트 리스너 설정
function setupEventListeners() {
  const marketSelect = document.getElementById("market-select");
  const searchInput = document.getElementById("search");
  const favBtn = document.getElementById("show-favorites-btn");

  // 마켓 선택 이벤트
  marketSelect.addEventListener("change", () => {
    currentMarket = marketSelect.value;
    renderTableHeader(currentMarket);
    filterByMarket(marketSelect);
    if (favBtn) {
      favBtn.classList.remove("active");
    }
    window.showingFavorites = false;
  });

  // 검색 모드 상태 추가
  window.isSearchMode = false;

  // 검색 이벤트 (디바운싱 적용)
  const debouncedFilterStocks = debounceSearch(async () => {
    const keyword = searchInput.value.trim().toLowerCase();

    if (window.showingFavorites) {
      if (keyword) {
        // 검색어가 있으면 즐겨찾기 내에서 검색
        window.isSearchMode = true;
        searchInFavorites(keyword);
      } else {
        // 검색어가 없으면 일반 즐겨찾기 표시
        window.isSearchMode = false;
        showAllFavorites();
      }
    } else {
      // 전체보기(홈화면)에서 검색어가 비어있으면 전체 리스트를 다시 불러오도록 수정
      if (!keyword) {
        filterStocks(searchInput, marketSelect, stockSymbols);
        return;
      }
      // 기존 전체검색 로직
      filterStocks(searchInput, marketSelect, stockSymbols);
    }
  }, 500);

  // 즐겨찾기 내에서 검색하는 함수
  async function searchInFavorites(keyword) {
    const favorites = getFavorites(currentMarket);
    if (!favorites || favorites.length === 0) {
      // 즐겨찾기가 비어있으면 검색 결과도 없음
      setFavoriteStocks([]);
      renderTable([], false, currentMarket);
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
        m.fetchStockData(codesNotInTable, currentMarket)
      );
      // 심볼 이름 매핑
      const marketSymbols = stockSymbols[currentMarket] || [];
      favoriteStocksNotInTable = fetched.map((d) => {
        const code = d.stck_shrn_iscd || d.code;
        const symbol = marketSymbols.find((s) => s.code === code);
        return {
          code,
          name: symbol ? symbol.name : "",
          market: currentMarket,
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
        stock.name.toLowerCase().includes(keyword) ||
        stock.code.includes(keyword)
    );

    setFavoriteStocks(filteredFavorites);
    renderTable(filteredFavorites, false, currentMarket);
  }

  // 모든 즐겨찾기 표시하는 함수
  async function showAllFavorites() {
    const favorites = getFavorites(currentMarket);
    if (!favorites || favorites.length === 0) {
      // 즐겨찾기 데이터가 없을 때 안내 문구와 전체보기 버튼 표시
      const tbody = document.getElementById("stock-tbody");
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-favorites-container"><div class="empty-favorites-text">즐겨찾기한 종목이 없습니다.</div><button id="back-to-all-btn" class="btn-back-all">전체보기</button></div></td></tr>`;
      favBtn.classList.add("active");
      setFavoriteStocks([]); // 빈 배열로 설정
      document.getElementById("back-to-all-btn").onclick = () => {
        if (searchInput) {
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
        }
        favBtn.classList.remove("active");
        window.showingFavorites = false;
      };
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
    const marketSymbols = (stockSymbols[currentMarket] || []).map(
      (s) => s.code
    );
    const codesInMarket = codesNotInTable.filter((code) =>
      marketSymbols.includes(code)
    );
    if (codesInMarket.length > 0) {
      const fetched = await import("./dataManager.js").then((m) =>
        m.fetchStockData(codesInMarket, currentMarket)
      );
      favoriteStocksNotInTable = fetched.map((d) => {
        const code = d.stck_shrn_iscd || d.code;
        const symbol = (stockSymbols[currentMarket] || []).find(
          (s) => s.code === code
        );
        return {
          code,
          name: symbol ? symbol.name : "",
          market: currentMarket,
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
    renderTable(sortedFavoriteStocks, false, currentMarket);
    favBtn.classList.add("active");
  }
  searchInput.addEventListener("input", debouncedFilterStocks);

  // 페이지 언로드시 실시간 데이터 중지
  window.addEventListener("beforeunload", () => {
    stopRealTimeData();
  });

  // 검색창 전체삭제(X) 버튼 기능
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

  // 즐겨찾기 버튼 토글 기능
  if (favBtn) {
    favBtn.addEventListener("click", async () => {
      const searchInput = document.getElementById("search");
      if (!window.showingFavorites) {
        // 즐겨찾기 모드로 전환
        window.showingFavorites = true;
        window.isSearchMode = false;
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
        window.showingFavorites = false;
        window.isSearchMode = false;

        // 메인 데이터가 있으면 바로 표시, 없으면 API 호출
        const existingData = getFilteredStocks();
        if (existingData.length > 0) {
          renderTable(existingData, false, currentMarket);
        } else {
          filterByMarket(marketSelect);
        }
      }
    });
  }
}

// 초기화 실행
document.addEventListener("DOMContentLoaded", () => {
  initialRender();
  setupEventListeners();
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.focus();
  }
});
