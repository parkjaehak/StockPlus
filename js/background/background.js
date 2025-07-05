// background.js - 메인 진입점

import { ApiService } from "./apiService.js";
import { RealTimeManager } from "./realTimeManager.js";
import { MessageHandler } from "./messageHandler.js";

/**
 * Chrome 확장 프로그램 Background Script
 * API 서비스, 실시간 데이터 관리, 메시지 처리를 담당
 */

// ===== 서비스 인스턴스 초기화 =====
const apiService = new ApiService();
const realTimeManager = new RealTimeManager();
const messageHandler = new MessageHandler(apiService, realTimeManager);

/**
 * Chrome 메시지 리스너 설정
 * popup에서 전송된 메시지를 받아서 적절한 핸들러로 전달
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handleMessage(message, sendResponse);
  return true; // 비동기 응답을 위해 true 반환
});
