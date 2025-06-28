// config.js - 서버 프록시 설정

// 개발/프로덕션 환경에 따른 서버 URL 설정
const isDevelopment = true;

export const SERVER_CONFIG = {
  // 개발 환경에서는 로컬 서버, 프로덕션에서는 실제 서버 URL 사용
  BASE_URL: isDevelopment
    ? "http://localhost:3000"
    : "https://your-production-server.com", // 실제 배포 시 변경 필요

  // API 엔드포인트
  ENDPOINTS: {
    HEALTH: "/health",
    SEARCH_CONDITIONS: "/api/search-conditions",
    SEARCH_RESULT: "/api/search-result",
    STOCK_PRICE: "/api/stock-price",
    STOCK_PRICES: "/api/stock-prices",
    APPROVAL_KEY: "/api/approval-key",
    TOKEN_STATUS: "/api/token-status",
  },
};

// 실시간 웹소켓 설정 (변경 없음)
export const WS_CONFIG = {
  WS_URL: "ws://ops.koreainvestment.com:21000",
};
