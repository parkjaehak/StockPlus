// background.js - 한국투자증권 Open API 연동

// API 설정
const API_CONFIG = {
  APP_KEY: "PSt13mFcGxsWaa7rsELOKngU9uLOVSgeVnpO",
  APP_SECRET:
    "Cud3wKOeN009J8YJ+sh3tCrsUlav6iQNZ79Ume4QKfcE16yq9kL8MZ8Mwb5r4Q7t+kkyVbgNRwKx3zXlM+EK3nueUJpVxGOfxWOXI9obAzINPnmfMR96ibD6Vzb3ED4fCJ/bdJhfz+yTR5+sY0TLf7iSf0CIULmTY4MTDCzpfcgtHbptL3I=",
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000",
  REAL_URL: "ws://ops.koreainvestment.com:21000",
};

// API 엔드포인트
const API_ENDPOINTS = {
  TOKEN: "/oauth2/tokenP",
  STOCK_PRICE: "/uapi/domestic-stock/v1/quotations/inquire-price",
  VOLUME_RANK: "/uapi/domestic-stock/v1/quotations/volume-rank",
};

// 토큰 관리
let accessToken = null;
let tokenExpiry = null;
let tokenRequestPromise = null; // 토큰 발급 요청을 추적

// API 인증 토큰 발급
async function getAccessToken() {
  // 1. 메모리 캐시 확인
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // 2. chrome.storage에서 유효한 토큰 확인
  try {
    const storedTokenInfo = await chrome.storage.local.get([
      "accessToken",
      "tokenExpiry",
    ]);
    if (
      storedTokenInfo.accessToken &&
      storedTokenInfo.tokenExpiry &&
      Date.now() < storedTokenInfo.tokenExpiry
    ) {
      console.log("저장된 토큰을 사용합니다.");
      accessToken = storedTokenInfo.accessToken;
      tokenExpiry = storedTokenInfo.tokenExpiry;
      return accessToken;
    }
  } catch (e) {
    console.error("Storage에서 토큰 로딩 중 오류:", e);
  }

  // 3. 토큰 발급 요청이 이미 진행 중인지 확인
  if (tokenRequestPromise) {
    console.log("토큰 발급 요청이 진행 중입니다. 기존 요청을 기다립니다.");
    return await tokenRequestPromise;
  }

  // 4. 새로운 토큰 발급 요청 시작
  tokenRequestPromise = (async () => {
    try {
      console.log("새로운 토큰 발급 요청 시작...");
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
        // 실제 만료 시간보다 5분 일찍 만료되도록 설정하여 안정성 확보
        tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

        await chrome.storage.local.set({ accessToken, tokenExpiry });

        console.log("토큰 발급 및 저장 성공:", {
          expires_in: data.expires_in,
          expiry_time: new Date(tokenExpiry).toLocaleString(),
        });
        return accessToken;
      } else {
        throw new Error("토큰 발급 실패: " + JSON.stringify(data));
      }
    } catch (error) {
      console.error("토큰 발급 중 오류:", error);
      // 오류 발생 시 저장된 토큰 정보 삭제
      await chrome.storage.local.remove(["accessToken", "tokenExpiry"]);
      accessToken = null;
      tokenExpiry = null;
      throw error;
    } finally {
      // 요청 완료 후 Promise 초기화
      tokenRequestPromise = null;
    }
  })();

  return await tokenRequestPromise;
}

// 실시간 접속키 발급
async function getApprovalKey() {
  try {
    console.log("실시간 접속키 발급 시도...");
    console.log("API 키 확인:", {
      appkey: API_CONFIG.APP_KEY ? "설정됨" : "설정되지 않음",
      secretkey: API_CONFIG.APP_SECRET ? "설정됨" : "설정되지 않음",
    });

    // 가능한 엔드포인트들
    const endpoints = [
      "/oauth2/Approval",
      "/oauth2/approval",
      "/oauth2/tokenP/approval",
      "/oauth2/approval/token",
      "/oauth2/realtime/approval",
    ];

    // 가능한 파라미터 조합들
    const paramCombinations = [
      {
        grant_type: "client_credentials",
        appkey: API_CONFIG.APP_KEY,
        secretkey: API_CONFIG.APP_SECRET,
      },
      {
        grant_type: "client_credentials",
        appkey: API_CONFIG.APP_KEY,
        appsecret: API_CONFIG.APP_SECRET,
      },
      {
        grant_type: "client_credentials",
        app_key: API_CONFIG.APP_KEY,
        app_secret: API_CONFIG.APP_SECRET,
      },
    ];

    for (const endpoint of endpoints) {
      for (const params of paramCombinations) {
        try {
          console.log(`엔드포인트 시도: ${endpoint}`);
          console.log("파라미터:", JSON.stringify(params, null, 2));

          const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
          });

          console.log("응답 상태:", response.status, response.statusText);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("HTTP 오류 응답:", errorText);
            continue; // 다음 조합 시도
          }

          const data = await response.json();
          console.log("응답 데이터:", data);
          console.log("응답 데이터 구조:", {
            output: data.output,
            outputLength: data.output ? data.output.length : "undefined",
            outputType: typeof data.output,
            hasOutput: "output" in data,
            hasOutput2: "output2" in data,
            keys: Object.keys(data),
          });

          // approval_key가 있으면 그것을 사용
          if (data.approval_key) {
            console.log("실시간 접속키 발급 성공:", data.approval_key);
            return data.approval_key;
          }

          // approval_key가 없고 access_token이 있으면 경고
          if (data.access_token) {
            console.warn(
              "access_token은 받았지만 approval_key가 없습니다. 실시간 데이터가 작동하지 않을 수 있습니다."
            );
            return data.access_token;
          }
        } catch (error) {
          console.error(`엔드포인트 ${endpoint} 시도 실패:`, error.message);
          continue; // 다음 조합 시도
        }
      }
    }

    throw new Error("모든 엔드포인트와 파라미터 조합 시도 실패");
  } catch (error) {
    console.error("실시간 접속키 발급 중 오류:", error);
    throw error;
  }
}

// 주식 시세 조회
async function getStockPrice(stockCode, marketCode) {
  const token = await getAccessToken();
  return getStockPriceWithToken(stockCode, marketCode, token);
}

// 토큰을 받아서 주식 시세 조회 (내부 함수)
async function getStockPriceWithToken(stockCode, marketCode, token) {
  try {
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: marketCode,
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
    console.log(`주식 시세 조회 결과 (${stockCode}):`, data);
    return data;
  } catch (error) {
    console.error(`주식 ${stockCode} 시세 조회 중 오류:`, error);
    throw error;
  }
}

// 여러 주식 시세 조회
async function getMultipleStockPrices(stockCodes, marketCode) {
  try {
    // 토큰을 한 번만 발급받음
    const token = await getAccessToken();

    // API 요청을 순차적으로 처리하여 서버 부하 감소
    const results = [];
    for (const code of stockCodes) {
      try {
        const result = await getStockPriceWithToken(code, marketCode, token);
        results.push(result);
        // 요청 간격 조절 (100ms)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`주식 ${code} 조회 실패:`, error);
        results.push({ error: error.message, code });
      }
    }
    return results;
  } catch (error) {
    console.error("여러 주식 시세 조회 중 오류:", error);
    throw error;
  }
}

// 거래량 순위 조회
async function fetchTopVolumeStocks(marketCode = "KOSPI") {
  const token = await getAccessToken();
  const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.VOLUME_RANK}`;

  // 한국투자증권 API 문서에 따른 올바른 파라미터
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: marketCode === "KOSPI" ? "J" : "K", // J: KOSPI, K: KOSDAQ
    FID_COND_SCR_DIV_CODE: "20171", // 거래량 순위 화면
    FID_INPUT_ISCD: "0000", // 전체
    FID_DIV_CLS_CODE: "0", // 전체
    FID_BLNG_CLS_CODE: "0", // 평균거래량
    FID_TRGT_CLS_CODE: "111111111", // 모든 증거금 비율
    FID_TRGT_EXLS_CLS_CODE: "0000000000", // 제외 대상 없음
    FID_INPUT_PRICE_1: "", // 전체 가격
    FID_INPUT_PRICE_2: "", // 전체 가격
    FID_VOL_CNT: "", // 전체 거래량
    FID_INPUT_DATE_1: "", // 공란
  });

  console.log("거래량 순위 조회 요청 파라미터:", params.toString());

  const response = await fetch(`${url}?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: API_CONFIG.APP_KEY,
      appsecret: API_CONFIG.APP_SECRET,
      tr_id: "FHPST01710000",
    },
  });

  console.log("응답 상태:", response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP 오류! status: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("응답 데이터:", data);
  console.log("응답 데이터 구조:", {
    output: data.output,
    outputLength: data.output ? data.output.length : "undefined",
    outputType: typeof data.output,
    hasOutput: "output" in data,
    hasOutput2: "output2" in data,
    keys: Object.keys(data),
  });

  if (data.rt_cd !== "0") {
    throw new Error(`API 오류: ${data.msg1}`);
  }

  console.log("거래량 순위 조회 성공!");
  // 거래량 상위 종목 목록 반환 (output에 있음)
  return data.output;
}

// WebSocket 실시간 데이터 관리
class RealTimeDataManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.subscribedStocks = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`WebSocket 연결 시도: ${API_CONFIG.REAL_URL}`);
        this.ws = new WebSocket(API_CONFIG.REAL_URL);

        this.ws.onopen = () => {
          console.log("WebSocket 연결 성공");
          this.isConnected = true;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleRealTimeData(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket 오류:", error);
          console.error("WebSocket 오류 상세:", {
            type: error.type,
            message: error.message,
            target: error.target,
          });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket 연결 종료:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          this.isConnected = false;
        };
      } catch (error) {
        console.error("WebSocket 연결 생성 오류:", error);
        reject(error);
      }
    });
  }

  subscribeToStock(stockCode, approval_key) {
    if (!this.isConnected || !this.ws) {
      console.error("WebSocket이 연결되지 않았습니다.");
      return;
    }

    try {
      // 한국투자증권 Open API 실시간 구독 메시지 형식
      // 여러 tr_id를 시도하여 실제 데이터를 받을 수 있는 tr_id 찾기
      const trIds = [
        "H0STCNT0", // 주식 체결
        "H0STASP0", // 주식 호가
        "H1_", // 주식 현재가
        "FHKST01010300", // 주식 현재가 체결 (REST API와 동일한 형식)
        "H0STCNT1", // 주식 체결 통보
        "H0STASP1", // 주식 호가 통보
      ];

      // 첫 번째 tr_id로 구독 시도
      const tr_id = trIds[0]; // H0STCNT0

      const message = {
        header: {
          approval_key: approval_key, // 또는 access_token
          custtype: "P",
          tr_type: "1", // 1: 등록
          "content-type": "utf-8",
        },
        body: {
          input: {
            tr_id: tr_id,
            tr_key: stockCode,
          },
        },
      };

      console.log(`주식 구독 메시지 전송 (${tr_id}): ${stockCode}`, {
        ...message,
        header: {
          ...message.header,
          approval_key: approval_key ? "***" : "undefined",
        },
      });
      this.ws.send(JSON.stringify(message));
      this.subscribedStocks.add(stockCode);
      console.log(`주식 구독 완료: ${stockCode}`);
    } catch (error) {
      console.error("주식 구독 오류:", error);
    }
  }

  unsubscribeFromStock(stockCode, approval_key) {
    if (!this.isConnected || !this.ws) {
      console.error("WebSocket이 연결되지 않았습니다.");
      return;
    }

    try {
      // 구독 해제 메시지 (tr_type: "2")
      const message = {
        header: {
          approval_key: approval_key, // 또는 access_token
          custtype: "P",
          tr_type: "2", // 2: 해제
          "content-type": "utf-8",
        },
        body: {
          input: {
            tr_id: "H0STCNT0",
            tr_key: stockCode,
          },
        },
      };

      console.log(`주식 구독 해제 전송: ${stockCode}`);
      this.ws.send(JSON.stringify(message));
      this.subscribedStocks.delete(stockCode);
    } catch (error) {
      console.error("주식 구독 해제 오류:", error);
    }
  }

  handleRealTimeData(message) {
    try {
      console.log("WebSocket 메시지 수신:", message);

      // 1. JSON 형식 메시지 처리 (초기 응답, PINGPONG 등)
      if (message.startsWith("{")) {
        const data = JSON.parse(message);

        if (data.header && data.header.tr_id === "PINGPONG") {
          console.log("Ping-Pong 수신. 연결 유지.");
          return;
        }

        if (data.body && data.body.rt_cd !== "0") {
          console.error("실시간 오류 수신:", data.body.msg1);
          return;
        }

        if (data.body && data.body.rt_cd === "0") {
          console.log("실시간 구독 성공:", data.header.tr_key);
          return;
        }

        console.log("기타 JSON 메시지 수신:", data);
        return;
      }

      // 2. 파이프(|)로 구분된 실시간 데이터 처리
      const parts = message.split("|");
      console.log("파이프로 구분된 데이터:", parts);

      if (parts.length < 4) {
        console.warn("처리할 수 없는 실시간 데이터 형식:", message);
        return;
      }

      const flag = parts[0]; // 0: 성공
      const tr_id = parts[1]; // H0STASP0 (주식 호가) 또는 H0STCNT0 (주식 체결)
      const dataFieldsStr = parts[3];

      console.log(`실시간 데이터 분석: flag=${flag}, tr_id=${tr_id}`);

      if (flag !== "0") {
        console.warn("오류 수신 (실시간):", message);
        return;
      }

      // H0STASP0 (주식 호가) 데이터 처리
      if (tr_id === "H0STASP0") {
        const dataFields = dataFieldsStr.split("^");
        const stockCode = dataFields[0]; // 종목코드
        const price = dataFields[2]; // 현재가 (호가 데이터에는 현재가가 없음, 가장 가까운 매도/매수 호가 사용 필요)

        // 호가 데이터에는 현재가, 등락률 등이 없으므로,
        // 현재가, 전일대비, 거래대금 필드는 REST API로 가져온 초기값을 유지하거나
        // 별도의 '주식체결' 구독을 통해 업데이트해야 합니다.
        // 여기서는 UI 업데이트를 위해 임시로 기존 데이터를 유지하도록 처리합니다.
        console.log(
          `주식호가 데이터 수신 (${stockCode}):`,
          dataFields.slice(1, 21)
        );
        return; // 호가 데이터는 화면에 직접 반영하지 않음
      }

      // H0STCNT0 (주식 체결) 데이터 처리
      if (tr_id === "H0STCNT0") {
        const dataFields = dataFieldsStr.split("^");
        const stockCode = dataFields[0]; // 종목코드
        const price = dataFields[2]; // 현재가
        const sign = dataFields[3]; // 전일대비부호
        const change_price = dataFields[4]; // 전일대비
        const change_rate = dataFields[5]; // 전일대비율
        const volume = dataFields[10]; // 누적거래량

        const realTimeData = {
          price: parseFloat(price) || 0,
          change_rate: parseFloat(change_rate) || 0,
          change_price: parseFloat(change_price) || 0,
          volume: parseFloat(volume) || 0,
          timestamp: Date.now(),
        };

        // 4:하한, 5:하락일 경우 음수 처리
        if (sign === "4" || sign === "5") {
          realTimeData.change_price = -Math.abs(realTimeData.change_price);
          realTimeData.change_rate = -Math.abs(realTimeData.change_rate);
        }

        console.log(`실시간 데이터 처리 (${stockCode}):`, realTimeData);

        // popup으로 실시간 데이터 전송
        chrome.runtime
          .sendMessage({
            type: "REAL_TIME_UPDATE",
            data: {
              code: stockCode,
              ...realTimeData,
            },
          })
          .catch((error) => {
            if (!error.message.includes("Receiving end does not exist")) {
              console.error("실시간 데이터 전송 오류:", error);
            }
          });
        return;
      }

      // H1_ (주식 현재가) 데이터 처리
      if (tr_id === "H1_") {
        const dataFields = dataFieldsStr.split("^");
        const stockCode = dataFields[0]; // 종목코드
        const price = dataFields[2]; // 현재가
        const sign = dataFields[3]; // 전일대비부호
        const change_price = dataFields[4]; // 전일대비
        const change_rate = dataFields[5]; // 전일대비율
        const volume = dataFields[10]; // 누적거래량

        const realTimeData = {
          price: parseFloat(price) || 0,
          change_rate: parseFloat(change_rate) || 0,
          change_price: parseFloat(change_price) || 0,
          volume: parseFloat(volume) || 0,
          timestamp: Date.now(),
        };

        // 4:하한, 5:하락일 경우 음수 처리
        if (sign === "4" || sign === "5") {
          realTimeData.change_price = -Math.abs(realTimeData.change_price);
          realTimeData.change_rate = -Math.abs(realTimeData.change_rate);
        }

        console.log(`실시간 데이터 처리 (${stockCode}):`, realTimeData);

        // popup으로 실시간 데이터 전송
        chrome.runtime
          .sendMessage({
            type: "REAL_TIME_UPDATE",
            data: {
              code: stockCode,
              ...realTimeData,
            },
          })
          .catch((error) => {
            if (!error.message.includes("Receiving end does not exist")) {
              console.error("실시간 데이터 전송 오류:", error);
            }
          });
        return;
      }

      // FHKST01010300 (주식 현재가 체결) 데이터 처리
      if (tr_id === "FHKST01010300") {
        const dataFields = dataFieldsStr.split("^");
        const stockCode = dataFields[0]; // 종목코드
        const price = dataFields[2]; // 현재가
        const sign = dataFields[3]; // 전일대비부호
        const change_price = dataFields[4]; // 전일대비
        const change_rate = dataFields[5]; // 전일대비율
        const volume = dataFields[10]; // 누적거래량

        const realTimeData = {
          price: parseFloat(price) || 0,
          change_rate: parseFloat(change_rate) || 0,
          change_price: parseFloat(change_price) || 0,
          volume: parseFloat(volume) || 0,
          timestamp: Date.now(),
        };

        // 4:하한, 5:하락일 경우 음수 처리
        if (sign === "4" || sign === "5") {
          realTimeData.change_price = -Math.abs(realTimeData.change_price);
          realTimeData.change_rate = -Math.abs(realTimeData.change_rate);
        }

        console.log(`실시간 데이터 처리 (${stockCode}):`, realTimeData);

        // popup으로 실시간 데이터 전송
        chrome.runtime
          .sendMessage({
            type: "REAL_TIME_UPDATE",
            data: {
              code: stockCode,
              ...realTimeData,
            },
          })
          .catch((error) => {
            if (!error.message.includes("Receiving end does not exist")) {
              console.error("실시간 데이터 전송 오류:", error);
            }
          });
        return;
      }

      console.warn("처리되지 않은 tr_id:", tr_id, "원본 메시지:", message);
    } catch (error) {
      console.error(
        "WebSocket 메시지 처리 중 심각한 오류:",
        error,
        "원본 메시지:",
        message
      );
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedStocks.clear();
  }
}

// 실시간 데이터 저장소
let realTimeData = new Map();
let isRealTimeConnected = false;
const realTimeManager = new RealTimeDataManager();

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("백그라운드 스크립트 메시지 수신:", message);

  switch (message.type) {
    case "GET_TOP_VOLUME_STOCKS":
      fetchTopVolumeStocks(message.data.marketCode)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // 비동기 응답
    case "GET_STOCK_DATA":
      handleGetStockData(message.data, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    case "GET_MULTIPLE_STOCKS":
      const { stockCodes, marketCode } = message.data;
      handleGetMultipleStocks(stockCodes, marketCode, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    case "START_REAL_TIME":
      handleStartRealTime(message.data, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    case "STOP_REAL_TIME":
      handleStopRealTime(sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    case "UPDATE_API_KEYS":
      handleUpdateApiKeys(message.data, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
  }
});

// 단일 주식 데이터 조회
async function handleGetStockData(stockCode, sendResponse) {
  try {
    // 단일 조회는 시장 코드를 'J'(전체)로 고정하거나 필요에 따라 수정
    const data = await getStockPrice(stockCode, "J");
    sendResponse({ success: true, data: data });
  } catch (error) {
    console.error("주식 데이터 조회 처리 중 오류:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 여러 주식 데이터 조회
async function handleGetMultipleStocks(stockCodes, marketCode, sendResponse) {
  try {
    const data = await getMultipleStockPrices(stockCodes, marketCode);
    sendResponse({ success: true, data: data });
  } catch (error) {
    console.error("여러 주식 데이터 조회 처리 중 오류:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 실시간 데이터 시작
async function handleStartRealTime(stockCodes, sendResponse) {
  try {
    console.log("실시간 데이터 관리 시작:", stockCodes);

    // API 키 확인
    if (!API_CONFIG.APP_KEY || !API_CONFIG.APP_SECRET) {
      const errorMsg =
        "API 키가 설정되지 않았습니다. 팝업에서 API 키를 설정해주세요.";
      console.error(errorMsg);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    // WebSocket 연결
    if (!isRealTimeConnected) {
      console.log("WebSocket 연결 시도...");
      try {
        await realTimeManager.connect();
        isRealTimeConnected = true;
        console.log("WebSocket 연결 성공");
      } catch (error) {
        const errorMsg = `WebSocket 연결 실패: ${error.message}`;
        console.error(errorMsg);
        sendResponse({ success: false, error: errorMsg });
        return;
      }
    }

    // 실시간 접속키 또는 access_token 발급
    let approval_key = null;
    try {
      console.log("실시간 접속키 발급 시도...");
      approval_key = await getApprovalKey();
      if (!approval_key) {
        throw new Error("실시간 접속키 발급에 실패했습니다.");
      }
      console.log("실시간 접속키 발급 성공");
    } catch (error) {
      console.warn(
        "실시간 접속키 발급 실패, access_token 사용:",
        error.message
      );
      // 실시간 접속키 발급 실패 시 access_token 사용
      try {
        approval_key = await getAccessToken();
        console.log("access_token 사용:", approval_key ? "성공" : "실패");
      } catch (tokenError) {
        const errorMsg = `토큰 발급 실패: ${tokenError.message}`;
        console.error(errorMsg);
        sendResponse({ success: false, error: errorMsg });
        return;
      }
    }

    if (!approval_key) {
      const errorMsg = "실시간 데이터 구독을 위한 키를 발급받을 수 없습니다.";
      console.error(errorMsg);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    const newStockSet = new Set(stockCodes);
    const currentStockSet = new Set(realTimeManager.subscribedStocks);

    const toUnsubscribe = [...currentStockSet].filter(
      (code) => !newStockSet.has(code)
    );
    if (toUnsubscribe.length > 0) {
      console.log("구독 해지:", toUnsubscribe);
      toUnsubscribe.forEach((code) => {
        realTimeManager.unsubscribeFromStock(code, approval_key);
      });
    }

    const toSubscribe = [...newStockSet].filter(
      (code) => !currentStockSet.has(code)
    );
    if (toSubscribe.length > 0) {
      console.log("신규 구독:", toSubscribe);
      toSubscribe.forEach((code) => {
        realTimeManager.subscribeToStock(code, approval_key);
      });
    }

    const newRealTimeData = new Map();
    stockCodes.forEach((code) => {
      newRealTimeData.set(
        code,
        realTimeData.get(code) || {
          price: 0,
          change_rate: 0,
          change_price: 0,
          volume: 0,
          timestamp: Date.now(),
        }
      );
    });
    realTimeData = newRealTimeData;

    console.log("실시간 데이터 구독 관리 완료");
    console.log("sendResponse 호출 전");
    const response = { success: true, message: "실시간 데이터 구독 관리 완료" };
    console.log("전송할 응답:", response);
    sendResponse(response);
    console.log("sendResponse 호출 완료");
  } catch (error) {
    console.error("실시간 데이터 처리 시작 중 오류:", error);
    console.log("오류 발생 시 sendResponse 호출 전");
    const errorResponse = {
      success: false,
      error: error.message,
      details:
        error.stack || "WebSocket 연결 또는 주식 구독 중 오류가 발생했습니다.",
    };
    console.log("전송할 오류 응답:", errorResponse);
    sendResponse(errorResponse);
    console.log("오류 발생 시 sendResponse 호출 완료");
  }
}

// 실시간 데이터 중지
function handleStopRealTime(sendResponse) {
  try {
    realTimeManager.disconnect();
    isRealTimeConnected = false;
    realTimeData.clear();
    sendResponse({ success: true, message: "실시간 데이터 중지" });
  } catch (error) {
    console.error("실시간 데이터 중지 실패:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// API 키 업데이트
function handleUpdateApiKeys(keys, sendResponse) {
  try {
    Object.assign(API_CONFIG, keys);
    sendResponse({ success: true, message: "API 키 업데이트 완료" });
  } catch (error) {
    console.error("API 키 업데이트 실패:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 확장 프로그램 시작시 초기화
chrome.runtime.onStartup.addListener(() => {
  console.log("StockPlus 확장 프로그램 시작");
});

// 확장 프로그램 설치시 초기화
chrome.runtime.onInstalled.addListener((details) => {
  console.log("StockPlus 확장 프로그램 설치됨:", details.reason);

  chrome.storage.local.set({
    apiKeys: API_CONFIG,
    realTimeEnabled: false,
    subscribedStocks: [],
  });
});

// 주기적으로 연결 상태 확인
setInterval(() => {
  if (isRealTimeConnected && !realTimeManager.isConnected) {
    console.log("실시간 연결이 끊어졌습니다. 재연결 시도...");
    isRealTimeConnected = false;
  }
}, 30000);
