const apiKey = "YOUR_KOREAINVEST_API_KEY";
const apiUrl = "https://openapi.koreainvestment.com:9443";
const fetchOption = { mode: "cors", credentials: "omit" };
let globalData = [];

//크롬 확장 저장소에서 데이터 가져오기
async function fetchStockPrices() {
  try {
    const response = await fetch(
      `${apiUrl}/uapi/domestic-stock/v1/quotations/inquire-price`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
      }
    );
    const data = await response.json();
    if (data && data.output) {
      globalData = data.output;
      updateTable(globalData);
    }
  } catch (error) {
    console.error("Error fetching stock prices:", error);
  }
}

//크롬 확장 저장소에 데이터 저장

function updateTable(stockData) {
  let table = document.getElementById("stockTable");
  table.innerHTML =
    "<tr><th>종목</th><th>현재가</th><th>전일 대비</th><th>거래량</th></tr>";
  stockData.forEach((stock) => {
    let row = table.insertRow();
    row.insertCell(0).innerText = stock.stock_name;
    row.insertCell(1).innerText = stock.trade_price.toLocaleString("ko-KR");
    row.insertCell(2).innerText = `${stock.change_rate.toFixed(2)}%`;
    row.insertCell(3).innerText = stock.trade_volume.toLocaleString("ko-KR");
  });
}

// 일정 주기마다 업데이트 (5초마다)
setInterval(fetchStockPrices, 5000);
fetchStockPrices();
