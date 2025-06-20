import { stocks } from "./mockStocks.js";

// 정렬 상태
let sortKey = null;
let sortOrder = "desc"; // 'asc' or 'desc'

// 무한 스크롤 관련
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredStocks = stocks;

const headerDefs = [
  { label: "종목명", key: null },
  { label: "현재가", key: "price" },
  { label: "전일대비", key: "change_rate" },
  { label: "거래대금", key: "volume" },
];

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
function getSortIcon(key) {
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
        ${formatNumber(Math.abs(stock.price))}
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

function renderTableHeader() {
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

function updateHeaderArrows() {
  const ths = document.querySelectorAll(".stock-table th");
  headerDefs.forEach((h, idx) => {
    if (!h.key) return;
    ths[idx].innerHTML = h.label + getSortIcon(h.key);
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
  updateHeaderArrows();
}

// 검색 및 마켓 선택 기능
const searchInput = document.getElementById("search");
const marketSelect = document.getElementById("market-select");

function filterStocks() {
  const keyword = searchInput.value.trim();
  const market = marketSelect.value;
  filteredStocks = stocks.filter(
    (s) =>
      s.market === market &&
      (s.name.includes(keyword) || s.code.includes(keyword))
  );
  if (sortKey) {
    sortStocks(sortKey);
  } else {
    currentPage = 1;
    renderTable(filteredStocks.slice(0, PAGE_SIZE));
    updateHeaderArrows();
  }
}

searchInput.addEventListener("input", filterStocks);
marketSelect.addEventListener("change", filterStocks);

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
  renderTableHeader();
  filteredStocks = stocks.filter((s) => s.market === marketSelect.value);
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
  updateHeaderArrows();
}
initialRender();
