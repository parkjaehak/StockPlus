// realTimeManager.js - 실시간 데이터 관리

import { API_CONFIG } from "./config.js";

export class RealTimeManager {
  constructor() {
    this.ws = null;
    this.subscribedStocks = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  connect(approvalKey) {
    // 승인키 존재 여부만 확인
    if (!approvalKey) {
      console.error("승인키가 필요합니다.");
      return;
    }

    if (this.ws) {
      this.ws.close();
    }

    // 승인키를 URL에 포함하여 연결
    const wsUrl = `${API_CONFIG.WS_URL}?approval_key=${approvalKey}`;
    this.ws = new WebSocket(wsUrl);
    this.setupWebSocketHandlers(approvalKey);
  }

  async connectAndSubscribe(approvalKey, stockCodes) {
    return new Promise((resolve, reject) => {
      // 연결 완료 후 구독을 시작하기 위한 콜백 설정
      const originalOnOpen = this.ws?.onopen;

      this.connect(approvalKey);

      // WebSocket 연결 완료 후 구독 시작
      this.ws.onopen = () => {
        console.log("WebSocket 연결 성공.");
        this.reconnectAttempts = 0;

        // 구독할 종목이 있을 때만 재구독
        if (this.subscribedStocks.size > 0) {
          this.resubscribeAll(approvalKey);
        }

        // 새로운 종목들 구독
        if (stockCodes && stockCodes.length > 0) {
          this.updateSubscriptions(stockCodes, approvalKey);
        }

        resolve();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket 연결 오류:", error);
        reject(error);
      };
    });
  }

  setupWebSocketHandlers(approvalKey) {
    this.ws.onopen = () => {
      console.log("WebSocket 연결 성공.");
      this.reconnectAttempts = 0;

      // 구독할 종목이 있을 때만 재구독 (connectAndSubscribe에서 처리하지 않는 경우)
      if (this.subscribedStocks.size > 0) {
        this.resubscribeAll(approvalKey);
      }
    };

    this.ws.onmessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 연결 종료:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.handleReconnect(approvalKey);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket 오류:", error);
      // 승인키 문제일 수 있음
      if (error.message && error.message.includes("200")) {
        console.error(
          "승인키가 유효하지 않거나 실시간 데이터 접근 권한이 없습니다."
        );
      }
    };
  }

  handleWebSocketMessage(event) {
    if (event.data.startsWith("{")) {
      //console.log("Json: ", event.data);
      this.handleJsonMessage(event.data);
    } else {
      //console.log("Text: ", event.data);
      this.parseRealTimeData(event.data);
    }
  }

  handleJsonMessage(data) {
    const parsed = JSON.parse(data);

    // PINGPONG 처리
    if (parsed.header?.tr_id === "PINGPONG") {
      this.ws.send(data);
      return;
    }

    // 구독 성공 확인
    if (parsed.body?.msg1 === "SUBSCRIBE SUCCESS") {
      console.log("실시간 데이터 구독 성공");
      // 복호화 키 저장 (필요시)
      if (parsed.body.output) {
        this.iv = parsed.body.output.iv;
        this.key = parsed.body.output.key;
      }
    }
  }

  parseRealTimeData(dataStr) {
    const parts = dataStr.split("|");
    if (parts.length < 4) return;

    const trId = parts[1];
    if (trId !== "H0STCNT0") return;

    const dataCount = parseInt(parts[2], 10);
    const allFields = parts[3].split("^");

    // H0STCNT0 실시간 체결 응답은 46개의 필드를 가짐
    const fieldsPerItem = 46;

    for (let i = 0; i < dataCount; i++) {
      const startIndex = i * fieldsPerItem;
      const endIndex = startIndex + fieldsPerItem;

      if (endIndex > allFields.length) {
        console.error("데이터 필드 개수가 예상과 다릅니다.", { dataStr });
        break;
      }

      const dataFields = allFields.slice(startIndex, endIndex);
      this.processStockData(dataFields);
    }
  }

  processStockData(dataFields) {
    // H0STCNT0의 필드는 46개. 최소한 누적 거래량 인덱스(13)보다는 커야 함
    if (dataFields.length < 14) {
      console.error("수신된 데이터 필드가 충분하지 않습니다.", { dataFields });
      return;
    }

    // 한국투자증권 실시간 주식 체결가(H0STCNT0) 응답 데이터 명세 기준
    // 0: 유가증권 단축 종목코드 (MKSC_SHRN_ISCD)
    // 2: 주식 현재가 (STCK_PRPR)
    // 4: 전일 대비 (PRDY_VRSS)
    // 5: 전일 대비율 (PRDY_CTRT)
    // 13: 누적 거래량 (ACML_VOL)
    const parsedData = {
      code: dataFields[0].trim(),
      price: parseFloat(dataFields[2]),
      change_price: parseFloat(dataFields[4]),
      change_rate: parseFloat(dataFields[5]),
      volume: parseFloat(dataFields[13]),
    };

    // 실시간 데이터를 popup으로 전송 (오류 처리 추가)
    try {
      chrome.runtime
        .sendMessage({
          type: "REAL_TIME_UPDATE",
          data: parsedData,
        })
        .catch((error) => {
          // popup이 닫혀있거나 응답할 수 없는 경우 무시
          if (error.message.includes("Receiving end does not exist")) {
            // 정상적인 상황이므로 로그 출력하지 않음
            return;
          }
          console.error("실시간 데이터 전송 오류:", error);
        });
    } catch (error) {
      // 동기적 오류 처리
      if (error.message.includes("Receiving end does not exist")) {
        return;
      }
      console.error("실시간 데이터 전송 오류:", error);
    }
  }

  resubscribeAll(approvalKey) {
    this.subscribedStocks.forEach((code) => this.subscribe(code, approvalKey));
  }

  handleReconnect(approvalKey) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(approvalKey), this.reconnectDelay);
    }
  }

  subscribe(stockCode, approvalKey) {
    if (!this.isWebSocketReady()) return;

    const message = this.buildSubscriptionMessage(stockCode, approvalKey, "1");
    this.ws.send(message);
    this.subscribedStocks.add(stockCode);
  }

  unsubscribe(stockCode, approvalKey) {
    if (!this.isWebSocketReady()) return;

    const message = this.buildSubscriptionMessage(stockCode, approvalKey, "2");
    this.ws.send(message);
    this.subscribedStocks.delete(stockCode);
  }

  buildSubscriptionMessage(stockCode, approvalKey, trType) {
    return JSON.stringify({
      header: {
        approval_key: approvalKey,
        custtype: "P",
        tr_type: trType,
        "content-type": "utf-8",
      },
      body: { input: { tr_id: "H0STCNT0", tr_key: stockCode } },
    });
  }

  isWebSocketReady() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  updateSubscriptions(newStockCodes, approvalKey) {
    const newSet = new Set(newStockCodes);
    const oldSet = this.subscribedStocks;

    const toUnsubscribe = [...oldSet].filter((code) => !newSet.has(code));
    const toSubscribe = [...newSet].filter((code) => !oldSet.has(code));

    toUnsubscribe.forEach((code) => this.unsubscribe(code, approvalKey));
    toSubscribe.forEach((code) => this.subscribe(code, approvalKey));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
