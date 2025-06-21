// background.js - 한국투자증권 Open API 연동

// API 설정
const API_CONFIG = {
  APP_KEY: "PSt13mFcGxsWaa7rsELOKngU9uLOVSgeVnpO",
  APP_SECRET:
    "Cud3wKOeN009J8YJ+sh3tCrsUlav6iQNZ79Ume4QKfcE16yq9kL8MZ8Mwb5r4Q7t+kkyVbgNRwKx3zXlM+EK3nueUJpVxGOfxWOXI9obAzINPnmfMR96ibD6Vzb3ED4fCJ/bdJhfz+yTR5+sY0TLf7iSf0CIULmTY4MTDCzpfcgtHbptL3I=",
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000",
};

// API 엔드포인트
const API_ENDPOINTS = {
  TOKEN: "/oauth2/tokenP",
  APPROVAL_KEY: "/oauth2/Approval",
  STOCK_PRICE: "/uapi/domestic-stock/v1/quotations/inquire-price",
  TOP_RANK: "/uapi/domestic-stock/v1/quotations/volume-rank",
};

// --- 토큰 및 키 관리 ---
let accessToken = null;
let tokenExpiry = null;
let approvalKey = null;
let approvalKeyExpiry = null;
let tokenRequestPromise = null;

async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }
  const storedToken = await chrome.storage.local.get([
    "accessToken",
    "tokenExpiry",
  ]);
  if (
    storedToken.accessToken &&
    storedToken.tokenExpiry &&
    Date.now() < storedToken.tokenExpiry
  ) {
    accessToken = storedToken.accessToken;
    tokenExpiry = storedToken.tokenExpiry;
    return accessToken;
  }

  if (tokenRequestPromise) return tokenRequestPromise;

  tokenRequestPromise = (async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            appkey: API_CONFIG.APP_KEY,
            appsecret: API_CONFIG.APP_SECRET,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(
          `토큰 발급 실패: ${data.error_description || response.statusText}`
        );
      }
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      await chrome.storage.local.set({ accessToken, tokenExpiry });
      return accessToken;
    } finally {
      tokenRequestPromise = null;
    }
  })();
  return tokenRequestPromise;
}

async function getApprovalKey() {
  if (approvalKey && approvalKeyExpiry && Date.now() < approvalKeyExpiry) {
    return approvalKey;
  }
  const storedKey = await chrome.storage.local.get([
    "approvalKey",
    "approvalKeyExpiry",
  ]);
  if (
    storedKey.approvalKey &&
    storedKey.approvalKeyExpiry &&
    Date.now() < storedKey.approvalKeyExpiry
  ) {
    approvalKey = storedKey.approvalKey;
    approvalKeyExpiry = storedKey.approvalKeyExpiry;
    return approvalKey;
  }

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.APPROVAL_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: API_CONFIG.APP_KEY,
          secretkey: API_CONFIG.APP_SECRET,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok || !data.approval_key) {
      throw new Error(
        `실시간 접속키 발급 실패: ${
          data.error_description || response.statusText
        }`
      );
    }
    approvalKey = data.approval_key;
    approvalKeyExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24시간
    await chrome.storage.local.set({ approvalKey, approvalKeyExpiry });
    return approvalKey;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// --- API 호출 함수 ---
async function fetchTopRankedStocks(marketCode = "KOSPI") {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    fid_cond_mrkt_div_code: "J",
    fid_cond_scr_div_code: "20174",
    fid_input_iscd: marketCode === "KOSPI" ? "0001" : "1001",
    fid_div_cls_code: "0",
    fid_blng_cls_code: "0",
    fid_trgt_cls_code: "111111111",
    fid_trgt_exls_cls_code: "0000000000",
    fid_input_price_1: "",
    fid_input_price_2: "",
    fid_vol_cnt: "",
    fid_input_date_1: "",
  });

  const response = await fetch(
    `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TOP_RANK}?${params}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        appkey: API_CONFIG.APP_KEY,
        appsecret: API_CONFIG.APP_SECRET,
        tr_id: "FHPST01740000",
      },
    }
  );
  if (!response.ok) throw new Error(`HTTP 오류! status: ${response.status}`);
  const data = await response.json();
  if (data.rt_cd !== "0") throw new Error(`API 오류: ${data.msg1}`);
  return data.output;
}

// --- WebSocket 관리 ---
class RealTimeManager {
  constructor() {
    this.ws = null;
    this.subscribedStocks = new Set();
    this.reconnectAttempts = 0;
  }

  connect(key) {
    if (this.ws) this.ws.close();

    this.ws = new WebSocket(API_CONFIG.WS_URL);

    this.ws.onopen = () => {
      console.log("WebSocket 연결 성공.");
      this.reconnectAttempts = 0;
      this.subscribedStocks.forEach((code) => this.subscribe(code, key));
    };

    this.ws.onmessage = (event) => {
      if (event.data.startsWith("{")) {
        const data = JSON.parse(event.data);
        if (data.header && data.header.tr_id === "PINGPONG") {
          this.ws.send(event.data);
        }
        return;
      }
      this.parseRealTimeData(event.data);
    };

    this.ws.onclose = () => {
      console.log("WebSocket 연결 종료.");
      if (this.reconnectAttempts < 5) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(key), 5000);
      }
    };

    this.ws.onerror = (error) => console.error("WebSocket 오류:", error);
  }

  parseRealTimeData(dataStr) {
    const [headerPart, bodyPart] = dataStr.split("|").slice(1);
    if (!bodyPart) return;

    const headerFields = headerPart.split("^");
    const bodyFields = bodyPart.split("^");
    const trId = headerFields[1];

    if (trId === "H0STCNT0") {
      // 주식체결
      const parsedData = {
        code: headerFields[0].trim(),
        price: parseFloat(bodyFields[1]),
        change_price: parseFloat(bodyFields[2]),
        change_rate: parseFloat(bodyFields[4]),
        volume: parseFloat(bodyFields[5]),
      };
      chrome.runtime.sendMessage({
        type: "REAL_TIME_UPDATE",
        data: parsedData,
      });
    }
  }

  subscribe(stockCode, key) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        header: {
          approval_key: key,
          custtype: "P",
          tr_type: "1",
          "content-type": "utf-8",
        },
        body: { input: { tr_id: "H0STCNT0", tr_key: stockCode } },
      });
      this.ws.send(message);
      this.subscribedStocks.add(stockCode);
    }
  }

  unsubscribe(stockCode, key) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        header: {
          approval_key: key,
          custtype: "P",
          tr_type: "2",
          "content-type": "utf-8",
        },
        body: { input: { tr_id: "H0STCNT0", tr_key: stockCode } },
      });
      this.ws.send(message);
      this.subscribedStocks.delete(stockCode);
    }
  }

  updateSubscriptions(newStockCodes, key) {
    const newSet = new Set(newStockCodes);
    const oldSet = this.subscribedStocks;

    const toUnsubscribe = [...oldSet].filter((code) => !newSet.has(code));
    const toSubscribe = [...newSet].filter((code) => !oldSet.has(code));

    toUnsubscribe.forEach((code) => this.unsubscribe(code, key));
    toSubscribe.forEach((code) => this.subscribe(code, key));
  }
}

const realTimeManager = new RealTimeManager();

// --- 메시지 리스너 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actions = {
    GET_TOP_VOLUME_STOCKS: async (msg) =>
      fetchTopRankedStocks(msg.data.marketCode),
    START_REAL_TIME: async (msg) => {
      const key = await getApprovalKey();
      if (!key) throw new Error("실시간 접속키를 가져올 수 없습니다.");
      if (
        !realTimeManager.ws ||
        realTimeManager.ws.readyState !== WebSocket.OPEN
      ) {
        realTimeManager.connect(key);
      }
      realTimeManager.updateSubscriptions(msg.data, key);
      return { success: true };
    },
    STOP_REAL_TIME: () => {
      if (realTimeManager.ws) realTimeManager.ws.close();
      return { success: true };
    },
    GET_MULTIPLE_STOCKS: async (msg) => {
      const { stockCodes, marketCode } = msg.data;
      const token = await getAccessToken();
      const results = [];
      for (const code of stockCodes) {
        // FHKST01010100: 주식 현재가 시세
        const params = new URLSearchParams({
          FID_COND_MRKT_DIV_CODE: "J", // 전체 시장
          FID_INPUT_ISCD: code,
        });
        const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.STOCK_PRICE}?${params}`;
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`,
            appkey: API_CONFIG.APP_KEY,
            appsecret: API_CONFIG.APP_SECRET,
            tr_id: "FHKST01010100",
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.output) {
            results.push(data.output);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100)); // API Rate limit
      }
      return results;
    },
  };

  const action = actions[message.type];
  if (action) {
    action(message)
      .then((response) => sendResponse({ success: true, data: response }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 응답
  }
});
