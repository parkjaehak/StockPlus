// 한국투자증권 Open API 설정
const API_CONFIG = {
  APP_KEY: "PSt13mFcGxsWaa7rsELOKngU9uLOVSgeVnpO",
  APP_SECRET:
    "Cud3wKOeN009J8YJ+sh3tCrsUlav6iQNZ79Ume4QKfcE16yq9kL8MZ8Mwb5r4Q7t+kkyVbgNRwKx3zXlM+EK3nueUJpVxGOfxWOXI9obAzINPnmfMR96ibD6Vzb3ED4fCJ/bdJhfz+yTR5+sY0TLf7iSf0CIULmTY4MTDCzpfcgtHbptL3I=",
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000", // WebSocket URL (실전투자)
  REAL_URL: "ws://ops.koreainvestment.com:21000", // 실시간 URL (실전투자)
};

// API 엔드포인트
const API_ENDPOINTS = {
  TOKEN: "/oauth2/tokenP",
  STOCK_PRICE: "/uapi/domestic-stock/v1/quotations/inquire-price",
  STOCK_LIST: "/uapi/domestic-stock/v1/quotations/inquire-price",
  REAL_TIME: "/uapi/domestic-stock/v1/quotations/inquire-price",
};

// 토큰 관리
let accessToken = null;
let tokenExpiry = null;

// API 인증 토큰 발급
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: API_CONFIG.APP_KEY,
          appsecret: API_CONFIG.APP_SECRET,
        }),
      }
    );

    const data = await response.json();

    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + data.expires_in * 1000;
      return accessToken;
    } else {
      throw new Error("토큰 발급 실패: " + JSON.stringify(data));
    }
  } catch (error) {
    console.error("토큰 발급 중 오류:", error);
    throw error;
  }
}

// 주식 시세 조회
async function getStockPrice(stockCode) {
  try {
    const token = await getAccessToken();

    // URL 파라미터 구성
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: "J", // 코스피
      FID_INPUT_ISCD: stockCode,
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.STOCK_PRICE}?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          appkey: API_CONFIG.APP_KEY,
          appsecret: API_CONFIG.APP_SECRET,
          tr_id: "FHKST01010100", // 주식 현재가 시세
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("주식 시세 조회 중 오류:", error);
    throw error;
  }
}

// 여러 주식 시세 조회
async function getMultipleStockPrices(stockCodes) {
  const promises = stockCodes.map((code) => getStockPrice(code));
  return Promise.all(promises);
}

// WebSocket 연결을 위한 실시간 데이터 처리
class RealTimeDataManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.subscribedStocks = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(API_CONFIG.REAL_URL);

      this.ws.onopen = () => {
        console.log("WebSocket 연결 성공");
        this.isConnected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleRealTimeData();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket 오류:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket 연결 종료");
        this.isConnected = false;
      };
    });
  }

  subscribeToStock(stockCode) {
    if (!this.isConnected) {
      console.error("WebSocket이 연결되지 않았습니다.");
      return;
    }

    const message = {
      header: {
        approval_key: API_CONFIG.APP_KEY,
        custtype: "P",
        tr_type: "1",
        "content-type": "utf-8",
      },
      body: {
        input: {
          tr_id: "H0_ASPWDD00100000",
          tr_key: stockCode,
        },
      },
    };

    this.ws.send(JSON.stringify(message));
    this.subscribedStocks.add(stockCode);
  }

  handleRealTimeData(data) {
    // 실시간 데이터를 popup으로 전송
    chrome.runtime.sendMessage({
      type: "REAL_TIME_DATA",
      data: data,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 전역 실시간 데이터 매니저 인스턴스
const realTimeManager = new RealTimeDataManager();

export {
  API_CONFIG,
  getAccessToken,
  getStockPrice,
  getMultipleStockPrices,
  realTimeManager,
};
