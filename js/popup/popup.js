// popup.js - 메인 팝업 로직

import {
  renderTableHeader,
  loadMore,
  setRealTimeData,
  updateStockRow,
} from "./uiManager.js";
import {
  filterStocks,
  filterByMarket,
  stopRealTimeData,
  debounceSearch,
} from "./dataManager.js";
import { stockSymbols } from "./stockSymbols.js";

// 실시간 데이터 업데이트 리스너 (가장 먼저 설정)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REAL_TIME_UPDATE") {
    setRealTimeData(message.data.code, message.data);
    updateStockRow(message.data.code);
  }
});

// 초기화 함수
async function initialRender() {
  renderTableHeader();
  await filterByMarket(document.getElementById("market-select"));
}

// 이벤트 리스너 설정
function setupEventListeners() {
  const marketSelect = document.getElementById("market-select");
  const searchInput = document.getElementById("search");

  // 마켓 선택 이벤트
  marketSelect.addEventListener("change", () => filterByMarket(marketSelect));

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
}

// 초기화 실행
document.addEventListener("DOMContentLoaded", () => {
  initialRender();
  setupEventListeners();
});
