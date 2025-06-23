// uiManager.js - UI 관리 및 렌더링

// 정렬 상태
let sortKey = null;
let sortOrder = "desc"; // 'asc' or 'desc'

// 무한 스크롤 관련
const PAGE_SIZE = 20;
let currentPage = 1;
let filteredStocks = [];
let realTimeData = new Map();

const headerDefs = [
  { label: "종목명", key: null },
  { label: "현재가", key: "price" },
  { label: "전일대비", key: "change_rate" },
  { label: "거래량", key: "volume" },
];

// 테이블 렌더링
export function renderTable(data, append = false) {
  const tbody = document.getElementById("stock-tbody");
  if (!append) tbody.innerHTML = "";

  data.forEach((stock) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-code", stock.code);

    // 실시간 데이터가 있으면 사용, 없으면 기본 데이터 사용
    const displayData = realTimeData.get(stock.code) || stock;

    tr.innerHTML = `
      <td>
        <div class="stock-name">${stock.name}</div>
        <div class="stock-code">${stock.code}</div>
      </td>
      <td class="${getChangeClass(displayData.change_rate)}">
        ${formatNumber(Math.abs(displayData.price))}
      </td>
      <td>
        <div class="${getChangeClass(displayData.change_rate)} change-rate">
          <span>${
            displayData.change_rate > 0
              ? "+"
              : displayData.change_rate < 0
              ? "-"
              : ""
          }${Math.abs(displayData.change_rate).toFixed(2)}%</span>
        </div>
          <div class="${getChangeClass(displayData.change_rate)} change-price">
          <span class="arrow">${
            displayData.change_price > 0
              ? "▲"
              : displayData.change_price < 0
              ? "▼"
              : ""
          }</span>
          <span class="change-price">${formatNumber(
            Math.abs(displayData.change_price)
          )}</span>
        </div>
      </td>
      <td class="volume">${formatVolume(displayData.volume)}</td>
    `;
    tbody.appendChild(tr);
  });
}

//헤더 렌더링
export function renderTableHeader() {
  const thead = document.querySelector(".stock-table thead tr");
  thead.innerHTML = "";
  headerDefs.forEach((h, idx) => {
    const th = document.createElement("th");
    th.innerHTML = h.label + (h.key ? getSortIcon(h.key) : "");
    if (h.key) {
      th.classList.add("sortable");
      th.dataset.key = h.key;
      th.addEventListener("click", () => sortStocks(h.key));
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

  // 가격 업데이트
  priceCell.textContent = formatNumber(data.price);

  // 전일대비 업데이트
  changeCell.innerHTML = `
    <div>${
      data.change_rate > 0 ? "+" : data.change_rate < 0 ? "-" : ""
    }${Math.abs(data.change_rate).toFixed(2)}%</div>
    <div class="sub">${
      data.change_price > 0 ? "+" : data.change_price < 0 ? "-" : ""
    }${formatNumber(Math.abs(data.change_price))}</div>
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
export function sortStocks(key) {
  if (sortKey === key) {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortOrder = "desc";
  }
  filteredStocks.sort((a, b) => {
    const aData = realTimeData.get(a.code) || a;
    const bData = realTimeData.get(b.code) || b;

    if (aData[key] < bData[key]) return sortOrder === "asc" ? -1 : 1;
    if (aData[key] > bData[key]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
  updateHeaderArrows();
}

// 무한 스크롤
export function loadMore() {
  const total = filteredStocks.length;
  const nextPage = currentPage + 1;
  const start = currentPage * PAGE_SIZE;
  const end = nextPage * PAGE_SIZE;

  if (start >= total) {
    console.log("모든 데이터를 로드했습니다.");
    return;
  }

  console.log(
    `추가 데이터 로드: ${start + 1}~${Math.min(end, total)} / ${total}`
  );
  renderTable(filteredStocks.slice(start, end), true);
  currentPage = nextPage;
}

// 데이터 관리 함수들
export function setFilteredStocks(stocks) {
  filteredStocks = stocks;
  currentPage = 1;
}

export function getFilteredStocks() {
  return filteredStocks;
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
