// messageHandler.js - 메시지 처리

export class MessageHandler {
  constructor(apiService, realTimeManager) {
    this.apiService = apiService;
    this.realTimeManager = realTimeManager;
  }

  async handleMessage(message, sendResponse) {
    const handlers = {
      GET_TOP_VOLUME_STOCKS: (msg) => this.handleGetTopVolumeStocks(msg),
      START_REAL_TIME: (msg) => this.handleStartRealTime(msg),
      STOP_REAL_TIME: () => this.handleStopRealTime(),
      GET_MULTIPLE_STOCKS: (msg) => this.handleGetMultipleStocks(msg),
      TEST_CONNECTION: () => this.handleTestConnection(),
    };

    const handler = handlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: "알 수 없는 메시지 타입" });
      return;
    }

    try {
      const response = await handler(message);
      sendResponse({ success: true, data: response });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetTopVolumeStocks(message) {
    return await this.apiService.fetchTopRankedStocks(message.data.marketCode);
  }

  async handleStartRealTime(message) {
    const approvalKey = await this.apiService.getApprovalKey();

    if (!approvalKey) {
      throw new Error("실시간 접속키를 가져올 수 없습니다.");
    }

    if (!this.realTimeManager.isWebSocketReady()) {
      await this.realTimeManager.connectAndSubscribe(approvalKey, message.data);
    } else {
      this.realTimeManager.updateSubscriptions(message.data, approvalKey);
    }

    return { success: true };
  }

  handleStopRealTime() {
    this.realTimeManager.disconnect();
    return { success: true };
  }

  async handleGetMultipleStocks(message) {
    const { stockCodes } = message.data;
    return await this.apiService.fetchMultipleStocks(stockCodes);
  }

  async handleTestConnection() {
    return await this.apiService.testConnection();
  }
}
