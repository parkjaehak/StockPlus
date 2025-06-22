// background.js - 메인 진입점

import { TokenManager } from "./js/tokenManager.js";
import { ApiService } from "./js/apiService.js";
import { RealTimeManager } from "./js/realTimeManager.js";
import { MessageHandler } from "./js/messageHandler.js";

// ===== 초기화 및 메시지 리스너 설정 =====
const tokenManager = new TokenManager();
const apiService = new ApiService(tokenManager);
const realTimeManager = new RealTimeManager();
const messageHandler = new MessageHandler(
  tokenManager,
  apiService,
  realTimeManager
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handleMessage(message, sendResponse);
  return true; // 비동기 응답
});
