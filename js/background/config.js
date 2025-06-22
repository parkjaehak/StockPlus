// config.js - API 설정 및 엔드포인트

import { ENV_CONFIG } from "./env.js";

// API 설정 (env.js에서 API 키를 가져옴)
export const API_CONFIG = {
  APP_KEY: ENV_CONFIG.APP_KEY,
  APP_SECRET: ENV_CONFIG.APP_SECRET,
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000",
};

// API 엔드포인트
export const API_ENDPOINTS = {
  TOKEN: "/oauth2/tokenP",
  APPROVAL_KEY: "/oauth2/Approval",
  TOP_RANK: "/uapi/domestic-stock/v1/quotations/inquire-price",
  STOCK_PRICE: "/uapi/domestic-stock/v1/quotations/inquire-price",
};
