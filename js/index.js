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

// 숫자 포맷
function formatNumber(num) {
  return Number(num).toLocaleString();
}

// 전일대비 등락 색상
function getChangeClass(rate) {
  if (rate > 0) return "text-rise";
  if (rate < 0) return "text-fall";
  return "text-even";
}

// 억 단위 변환
function formatVolume(val) {
  return (val / 100000000).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

// 테이블 렌더링
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

// 렌더링 실행
renderTable(stocks);
