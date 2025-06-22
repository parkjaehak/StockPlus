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
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(API_CONFIG.WS_URL);
    this.setupWebSocketHandlers(approvalKey);
  }

  setupWebSocketHandlers(approvalKey) {
    this.ws.onopen = () => {
      console.log("WebSocket 연결 성공.");
      this.reconnectAttempts = 0;
      this.resubscribeAll(approvalKey);
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
    };
  }

  handleWebSocketMessage(event) {
    if (event.data.startsWith("{")) {
      this.handleJsonMessage(event.data);
    } else {
      this.parseRealTimeData(event.data);
    }
  }

  handleJsonMessage(data) {
    const parsed = JSON.parse(data);
    if (parsed.header?.tr_id === "PINGPONG") {
      this.ws.send(data);
    }
  }

  parseRealTimeData(dataStr) {
    const parts = dataStr.split("|").slice(1);
    if (parts.length < 2) return;

    const [headerPart, bodyPart] = parts;
    const headerFields = headerPart.split("^");
    const bodyFields = bodyPart.split("^");
    const trId = headerFields[1];

    if (trId === "H0STCNT0") {
      this.processStockData(headerFields, bodyFields);
    }
  }

  processStockData(headerFields, bodyFields) {
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
