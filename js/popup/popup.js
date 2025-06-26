// popup.js - 메인 팝업 로직

import {
  renderTableHeader,
  setRealTimeData,
  updateStockRow,
  renderTable,
  getFilteredStocks,
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

let showingFavorites = false;
let currentMarket = "KOSPI";

// 초기화 함수
async function initialRender() {
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
    // 즐겨찾기 버튼 상태 초기화
    if (favBtn) {
      favBtn.classList.remove("active");
    }
    showingFavorites = false;
  });

  // 검색 이벤트 (디바운싱 적용)
  const debouncedFilterStocks = debounceSearch(
    () => filterStocks(searchInput, marketSelect, stockSymbols),
    500
  );
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
      const allStocks = getFilteredStocks();
      if (!showingFavorites) {
        const favorites = getFavorites(currentMarket);
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
        if (allFavoriteStocks.length === 0) {
          // 즐겨찾기 데이터가 없을 때 안내 문구와 전체보기 버튼 표시
          const tbody = document.getElementById("stock-tbody");
          tbody.innerHTML = `<tr><td colspan="4"><div class="empty-favorites-container"><div class="empty-favorites-text">즐겨찾기한 종목이 없습니다.</div><button id="back-to-all-btn" class="btn-back-all">전체보기</button></div></td></tr>`;
          favBtn.classList.add("active");
          showingFavorites = true;
          // 전체보기 버튼 이벤트
          document.getElementById("back-to-all-btn").onclick = () => {
            renderTable(allStocks, false, currentMarket);
            favBtn.classList.remove("active");
            showingFavorites = false;
          };
          return;
        }
        renderTable(allFavoriteStocks, false, currentMarket);
        favBtn.classList.add("active");
        showingFavorites = true;
      } else {
        renderTable(allStocks, false, currentMarket);
        favBtn.classList.remove("active");
        showingFavorites = false;
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
