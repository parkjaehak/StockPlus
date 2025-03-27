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

//웹소켓 연결
function webSocketConfig() {
  var maxRetries = 10;
  var retryCount = 0;

  function connect(websoccketServer) {
    if (websocket) {
      websocket.close();
    }

    websocket = new WebSocket(websoccketServer);
    websocket.binaryType = "arraybuffer";

    websocket.onopen = function (evt) {
      onOpen(evt);
      retryCount = 0;
    };

    websocket.onclose = function (e) {};

    websocket.onmessage = function (evt) {
      onMessage(evt);
    };

    websocket.onerror = function (e) {
      console.log("Connection Error", e);
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Reconnecting in ${retryCount} seconds...`);
        setTimeout(function () {
          connect(upbitWebsocketServer);
        }, 100);
      } else {
        console.log("Max retries reached. Could not connect to WebSocket.");
        var marketMode = document
          .getElementsByName("market-mode")[0]
          .value.toLowerCase();
        connect(barakWebsocketServer + "/" + marketMode);
      }
    };
  }

  connect(upbitWebsocketServer);
}

async function onOpen() {
  var code = [];
  for (i = 0; i < globalData.length; i++) {
    code.push(globalData[i].market);
  }

  var marketMode = await getObjectFromLocalStorage("marketMode");
  if (marketMode == "BTC") code.unshift("KRW-BTC");

  var msg = [
    { ticket: generateRandomValue() },
    {
      type: "ticker",
      codes: code,
    },
  ];

  msg = JSON.stringify(msg);
  websocket.send(msg);
}
