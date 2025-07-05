// constants.js - 전역 상수 정의

// API 관련 상수
export const API_CONSTANTS = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  MAX_SUBSCRIPTIONS: 41,
  DEBOUNCE_DELAY: 500,
  NOTIFICATION_TIMEOUT: 5000,
  REQUEST_TIMEOUT: 10000,
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 5000,
};

// UI 관련 상수
export const UI_CONSTANTS = {
  PAGE_SIZE: 20,
  INTERSECTION_THRESHOLD: 0.1,
  PRICE_UPDATE_DURATION: 1000,
};

// 마켓 관련 상수
export const MARKET_CONSTANTS = {
  KOSPI: "KOSPI",
  KOSDAQ: "KOSDAQ",
  DEFAULT_MARKET: "KOSPI",
};

// 조건검색 관련 상수
export const SEARCH_CONDITIONS = {
  KOSPI_100: "코스피100",
  KOSDAQ_100: "코스닥100",
};

// 에러 메시지
export const ERROR_MESSAGES = {
  SERVER_CONNECTION_FAILED:
    "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.",
  EXTENSION_NOT_READY:
    "확장 프로그램이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.",
  DATA_FETCH_ERROR: "데이터를 가져오는 중 오류가 발생했습니다.",
  REALTIME_CONNECTION_FAILED: "실시간 데이터 연결에 실패했습니다.",
  API_KEY_ERROR: "실시간 데이터 연결에 실패했습니다. API 키를 확인해주세요.",
  CONDITION_NOT_FOUND: "조건검색식을 찾을 수 없습니다.",
  CONDITION_LIST_NOT_FOUND:
    "API 응답에서 조건 목록(output2)을 찾을 수 없습니다.",
  WEBSOCKET_CONNECTION_FAILED: "WebSocket 연결에 실패했습니다.",
  INVALID_APPROVAL_KEY:
    "승인키가 유효하지 않거나 실시간 데이터 접근 권한이 없습니다.",
  APPROVAL_KEY_FETCH_FAILED: "실시간 접속키를 가져올 수 없습니다.",
  UNKNOWN_MESSAGE_TYPE: "알 수 없는 메시지 타입",
  UNKNOWN_ERROR: "알 수 없는 오류가 발생했습니다.",
};

// 성공 메시지
export const SUCCESS_MESSAGES = {
  SERVER_CONNECTED: "서버 연결됨",
};

// 상태 메시지
export const STATUS_MESSAGES = {
  SERVER_DISCONNECTED: "서버 연결 안됨",
  UNKNOWN_ERROR: "알 수 없는 오류",
};

// 정렬 관련 상수
export const SORT_CONSTANTS = {
  ASC: "asc",
  DESC: "desc",
  DEFAULT_ORDER: "desc",
};

// 테이블 헤더 정의
export const TABLE_HEADERS = [
  { label: "종목명", key: null },
  { label: "현재가", key: "price" },
  { label: "전일대비", key: "change_rate" },
  { label: "거래량", key: "volume" },
];

// CSS 클래스명
export const CSS_CLASSES = {
  SORTABLE: "sortable",
  SORT_ICON: "fas fa-sort sort-icon",
  SORT_ACTIVE: "sort-active",
  FAVORITE_ACTIVE: "favorite-active",
  TEXT_RISE: "text-rise",
  TEXT_FALL: "text-fall",
  TEXT_EVEN: "text-even",
  PRICE_UPDATE_RISE: "price-update-rise",
  PRICE_UPDATE_FALL: "price-update-fall",
  NOTIFICATION: "notification",
  SERVER_STATUS: "server-status",
  STATUS_INDICATOR: "status-indicator",
  STATUS_DOT: "status-dot",
  STATUS_TEXT: "status-text",
  STATUS_ERROR: "status-error",
  LOADER_CONTAINER: "loader-container",
  EMPTY_FAVORITES_CONTAINER: "empty-favorites-container",
  EMPTY_FAVORITES_TEXT: "empty-favorites-text",
  BTN_BACK_ALL: "btn-back-all",
};

// 데이터 필드 매핑
export const DATA_FIELDS = {
  STOCK_CODE: "stck_shrn_iscd",
  PRICE: "stck_prpr",
  CHANGE_RATE: "prdy_ctrt",
  CHANGE_PRICE: "prdy_vrss",
  VOLUME: "acml_vol",
  NAME: "name",
  CODE: "code",
  MARKET: "market",
};

// WebSocket 관련 상수
export const WEBSOCKET_CONSTANTS = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 5000,
  PINGPONG_TR_ID: "PINGPONG",
  SUBSCRIBE_SUCCESS_MSG: "SUBSCRIBE SUCCESS",
};
