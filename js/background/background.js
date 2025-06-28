// background.js - 메인 진입점

import { ApiService } from "./apiService.js";
import { RealTimeManager } from "./realTimeManager.js";
import { MessageHandler } from "./messageHandler.js";

// ===== 초기화 및 메시지 리스너 설정 =====
const apiService = new ApiService();
const realTimeManager = new RealTimeManager();
const messageHandler = new MessageHandler(apiService, realTimeManager);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handleMessage(message, sendResponse);
  return true; // 비동기 응답
});
