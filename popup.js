import { stocks } from "./js/mockStocks.js";

// 정렬 상태
let sortKey = null;
let sortOrder = "desc"; // 'asc' or 'desc'

// 무한 스크롤 관련
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredStocks = stocks;

function formatNumber(num) {
  return Number(num).toLocaleString();
}
function getChangeClass(rate) {
  if (rate > 0) return "text-rise";
  if (rate < 0) return "text-fall";
  return "text-even";
}
function formatVolume(val) {
  return (val / 100000000).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}
function getSortArrow(key) {
  if (sortKey !== key) return "";
  return sortOrder === "asc" ? " ▲" : " ▼";
}
function renderTable(data, append = false) {
  const tbody = document.getElementById("stock-tbody");
  if (!append) tbody.innerHTML = "";
  data.forEach((stock) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="stock-name">${stock.name}</div>
        <div class="stock-code">${stock.code}</div>
      </td>
      <td class="${getChangeClass(stock.change_rate)}">
        ${
          stock.change_rate > 0 ? "+" : stock.change_rate < 0 ? "-" : ""
        }${formatNumber(Math.abs(stock.price))}
      </td>
      <td class="${getChangeClass(stock.change_rate)}">
        <div>${
          stock.change_rate > 0 ? "+" : stock.change_rate < 0 ? "-" : ""
        }${Math.abs(stock.change_rate).toFixed(2)}%</div>
        <div class="sub">${
          stock.change_price > 0 ? "+" : stock.change_price < 0 ? "-" : ""
        }${formatNumber(Math.abs(stock.change_price))}</div>
      </td>
      <td>${formatVolume(stock.volume)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 정렬 함수
function sortStocks(key) {
  if (sortKey === key) {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortOrder = "desc";
  }
  filteredStocks.sort((a, b) => {
    if (a[key] < b[key]) return sortOrder === "asc" ? -1 : 1;
    if (a[key] > b[key]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
}

// 검색 및 마켓 선택 기능
const searchInput = document.getElementById("search");
const marketSelect = document.getElementById("market-select");

function filterStocks() {
  const keyword = searchInput.value.trim();
  filteredStocks = stocks.filter(
    (s) => s.name.includes(keyword) || s.code.includes(keyword)
  );
  if (sortKey) {
    sortStocks(sortKey);
  } else {
    currentPage = 1;
    renderTable(filteredStocks.slice(0, PAGE_SIZE));
  }
}

searchInput.addEventListener("input", filterStocks);
marketSelect.addEventListener("change", filterStocks);

// 테이블 헤더 클릭 시 정렬
const ths = document.querySelectorAll(".stock-table th");
ths[1].addEventListener("click", () => sortStocks("price"));
ths[2].addEventListener("click", () => sortStocks("change_rate"));
ths[3].addEventListener("click", () => sortStocks("volume"));

// 정렬 화살표 표시
function updateHeaderArrows() {
  ths[1].textContent = "현재가" + getSortArrow("price");
  ths[2].textContent = "전일대비" + getSortArrow("change_rate");
  ths[3].textContent = "거래대금" + getSortArrow("volume");
}

// 정렬 시 헤더 업데이트
ths.forEach((th, idx) => {
  if (idx > 0) {
    th.addEventListener("click", updateHeaderArrows);
  }
});

// 무한 스크롤 구현
const tbody = document.getElementById("stock-tbody");
const observerTarget = document.createElement("div");
tbody.parentNode.appendChild(observerTarget);

const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    loadMore();
  }
});
observer.observe(observerTarget);

function loadMore() {
  const total = filteredStocks.length;
  const nextPage = currentPage + 1;
  const start = currentPage * PAGE_SIZE;
  const end = nextPage * PAGE_SIZE;
  if (start >= total) return;
  renderTable(filteredStocks.slice(start, end), true);
  currentPage = nextPage;
}

// 초기 렌더링
function initialRender() {
  filteredStocks = stocks;
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
  updateHeaderArrows();
}
initialRender();
