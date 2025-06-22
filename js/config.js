// config.js - API 설정 및 엔드포인트

export const API_CONFIG = {
  APP_KEY: "PSt13mFcGxsWaa7rsELOKngU9uLOVSgeVnpO",
  APP_SECRET:
    "Cud3wKOeN009J8YJ+sh3tCrsUlav6iQNZ79Ume4QKfcE16yq9kL8MZ8Mwb5r4Q7t+kkyVbgNRwKx3zXlM+EK3nueUJpVxGOfxWOXI9obAzINPnmfMR96ibD6Vzb3ED4fCJ/bdJhfz+yTR5+sY0TLf7iSf0CIULmTY4MTDCzpfcgtHbptL3I=",
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000",
};

export const API_ENDPOINTS = {
  TOKEN: "/oauth2/tokenP",
  APPROVAL_KEY: "/oauth2/Approval",
  STOCK_PRICE: "/uapi/domestic-stock/v1/quotations/inquire-price",
  TOP_RANK: "/uapi/domestic-stock/v1/quotations/volume-rank",
};
