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

// 초기화 함수
async function initialRender() {
  renderTableHeader();
  await filterByMarket(document.getElementById("market-select"));
}

// 실시간 데이터 업데이트 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REAL_TIME_UPDATE") {
    console.log("실시간 데이터 수신 (popup):", message.data);
    const { code, price, change_rate, change_price, volume } = message.data;

    // 실시간 데이터 저장
    setRealTimeData(code, {
      price,
      change_rate,
      change_price,
      volume,
    });

    // UI 업데이트
    updateStockRow(code);
  }
});

// 이벤트 리스너 설정
function setupEventListeners() {
  const marketSelect = document.getElementById("market-select");
  const searchInput = document.getElementById("search");
  const tableContainer = document.querySelector(".table-container");

  // 마켓 선택 이벤트
  marketSelect.addEventListener("change", () => filterByMarket(marketSelect));

  // 검색 이벤트 (디바운싱 적용)
  const debouncedFilterStocks = debounceSearch(
    () => filterStocks(searchInput, marketSelect, stockSymbols),
    500
  );
  searchInput.addEventListener("input", debouncedFilterStocks);

  // 무한 스크롤 이벤트
  tableContainer.addEventListener("scroll", (e) => {
    if (
      e.target.scrollTop + e.target.clientHeight >=
      e.target.scrollHeight - 10
    ) {
      loadMore();
    }
  });

  // 페이지 언로드시 실시간 데이터 중지
  window.addEventListener("beforeunload", () => {
    stopRealTimeData();
  });
}

// 무한 스크롤 옵저버 설정
function setupInfiniteScroll() {
  const tbody = document.getElementById("stock-tbody");
  const observerTarget = document.createElement("div");
  tbody.parentNode.appendChild(observerTarget);

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  });
  observer.observe(observerTarget);
}

// 초기화 실행
document.addEventListener("DOMContentLoaded", () => {
  initialRender();
  setupEventListeners();
  setupInfiniteScroll();
});
