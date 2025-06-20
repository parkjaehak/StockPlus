// Mock 데이터
const stocks = [
  {
    name: "삼성전자",
    code: "005930",
    price: 82000,
    change_rate: 1.23,
    change_price: 1000,
    volume: 125000000000,
  },
  {
    name: "카카오",
    code: "035720",
    price: 61000,
    change_rate: -0.85,
    change_price: -520,
    volume: 43000000000,
  },
  {
    name: "LG에너지솔루션",
    code: "373220",
    price: 410000,
    change_rate: 0,
    change_price: 0,
    volume: 9800000000,
  },
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
function renderTable(data) {
  const tbody = document.getElementById("stock-tbody");
  tbody.innerHTML = "";
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

// 검색 및 마켓 선택 기능
const searchInput = document.getElementById("search");
const marketSelect = document.getElementById("market-select");

function filterStocks() {
  const keyword = searchInput.value.trim();
  // 마켓 선택은 추후 확장 가능
  const filtered = stocks.filter(
    (s) => s.name.includes(keyword) || s.code.includes(keyword)
  );
  renderTable(filtered);
}

searchInput.addEventListener("input", filterStocks);
marketSelect.addEventListener("change", filterStocks);

// 초기 렌더링
renderTable(stocks);
