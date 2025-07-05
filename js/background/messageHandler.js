// messageHandler.js - 메시지 처리

import { ERROR_MESSAGES } from "../constants.js";

/**
 * 메시지 처리 클래스
 * popup에서 전송된 메시지를 처리하고 적절한 응답을 반환
 */
export class MessageHandler {
  /**
   * MessageHandler 생성자
   * @param {ApiService} apiService - API 서비스 인스턴스
   * @param {RealTimeManager} realTimeManager - 실시간 데이터 관리자 인스턴스
   */
  constructor(apiService, realTimeManager) {
    this.apiService = apiService;
    this.realTimeManager = realTimeManager;
  }

  /**
   * 메시지 처리 메인 함수
   * @param {Object} message - 수신된 메시지
   * @param {Function} sendResponse - 응답 전송 함수
   */
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
      sendResponse({
        success: false,
        error: ERROR_MESSAGES.UNKNOWN_MESSAGE_TYPE,
      });
      return;
    }

    try {
      const response = await handler(message);
      sendResponse({ success: true, data: response });
    } catch (error) {
      console.error("메시지 처리 오류:", error);
      sendResponse({
        success: false,
        error: error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
      });
    }
  }

  /**
   * 상위 거래량 종목 조회 핸들러
   * @param {Object} message - 메시지 객체
   * @returns {Promise<Array>} 상위 거래량 종목 목록
   */
  async handleGetTopVolumeStocks(message) {
    return await this.apiService.fetchTopRankedStocks(message.data.marketCode);
  }

  /**
   * 실시간 데이터 시작 핸들러
   * @param {Object} message - 메시지 객체
   * @returns {Promise<Object>} 성공 여부
   * @throws {Error} 승인키 조회 실패 시
   */
  async handleStartRealTime(message) {
    const approvalKey = await this.apiService.getApprovalKey();

    if (!approvalKey) {
      throw new Error(ERROR_MESSAGES.APPROVAL_KEY_FETCH_FAILED);
    }

    if (!this.realTimeManager.isWebSocketReady()) {
      await this.realTimeManager.connectAndSubscribe(approvalKey, message.data);
    } else {
      this.realTimeManager.updateSubscriptions(message.data, approvalKey);
    }

    return { success: true };
  }

  /**
   * 실시간 데이터 중지 핸들러
   * @returns {Object} 성공 여부
   */
  handleStopRealTime() {
    this.realTimeManager.disconnect();
    return { success: true };
  }

  /**
   * 다중 종목 조회 핸들러
   * @param {Object} message - 메시지 객체
   * @returns {Promise<Array>} 종목 데이터 배열
   */
  async handleGetMultipleStocks(message) {
    const { stockCodes } = message.data;
    return await this.apiService.fetchMultipleStocks(stockCodes);
  }

  /**
   * 서버 연결 테스트 핸들러
   * @returns {Promise<Object>} 서버 연결 상태 정보
   */
  async handleTestConnection() {
    return await this.apiService.testConnection();
  }
}
