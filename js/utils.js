// utils.js - 공통 유틸리티 함수들

import { ERROR_MESSAGES, API_CONSTANTS, CSS_CLASSES } from "./constants.js";

/**
 * 숫자를 천 단위 콤마로 포맷팅
 * @param {number} num - 포맷팅할 숫자
 * @returns {string} 포맷팅된 문자열
 */
export function formatNumber(num) {
  return Number(num).toLocaleString();
}

/**
 * 등락률에 따른 CSS 클래스 반환
 * @param {number} rate - 등락률
 * @returns {string} CSS 클래스명
 */
export function getChangeClass(rate) {
  if (rate > 0) return CSS_CLASSES.TEXT_RISE;
  if (rate < 0) return CSS_CLASSES.TEXT_FALL;
  return CSS_CLASSES.TEXT_EVEN;
}

/**
 * 거래량을 천 단위 콤마로 포맷팅
 * @param {number} val - 거래량 값
 * @returns {string} 포맷팅된 거래량
 */
export function formatVolume(val) {
  if (!val || isNaN(val)) {
    return "0";
  }
  return Math.floor(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 디바운싱 함수 생성
 * @param {Function} func - 실행할 함수
 * @param {number} delay - 지연 시간 (ms)
 * @returns {Function} 디바운싱된 함수
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * API 응답 데이터를 주식 객체로 변환
 * @param {Object} data - API 응답 데이터
 * @param {string} market - 마켓 코드
 * @param {Array} marketSymbols - 마켓 심볼 목록
 * @returns {Object} 변환된 주식 객체
 */
export function transformStockData(data, market, marketSymbols = []) {
  const code = data.stck_shrn_iscd || data.code;
  const symbol = marketSymbols.find((s) => s.code === code);

  return {
    code,
    name: symbol ? symbol.name : "",
    market,
    price: parseFloat(data.stck_prpr || data.price) || 0,
    change_rate: parseFloat(data.prdy_ctrt || data.chgrate) || 0,
    change_price: parseFloat(data.prdy_vrss || data.change) || 0,
    volume: parseFloat(data.acml_vol || data.volume) || 0,
  };
}

/**
 * 에러 메시지 표시
 * @param {string} message - 에러 메시지
 * @param {string} type - 메시지 타입 (error, warning, info)
 */
export function showNotification(message, type = "info") {
  // 기존 알림 제거
  const existingNotification = document.querySelector(
    `.${CSS_CLASSES.NOTIFICATION}`
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = `${CSS_CLASSES.NOTIFICATION} ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px 15px;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    z-index: 1000;
    max-width: 300px;
    word-wrap: break-word;
  `;

  // 타입별 배경색 설정
  const backgroundColorMap = {
    error: "#d32f2f",
    success: "#2e7d32",
    warning: "#f57c00",
    info: "#1976d2",
  };

  notification.style.backgroundColor =
    backgroundColorMap[type] || backgroundColorMap.info;

  document.body.appendChild(notification);

  // 자동 제거
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, API_CONSTANTS.NOTIFICATION_TIMEOUT);
}

/**
 * 로딩 상태 표시/숨김
 * @param {boolean} show - 표시 여부
 */
export function showLoading(show) {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.style.display = show ? "flex" : "none";
  }
}

/**
 * 배열을 청크로 분할
 * @param {Array} array - 분할할 배열
 * @param {number} size - 청크 크기
 * @returns {Array} 분할된 배열들의 배열
 */
export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 객체의 깊은 복사
 * @param {Object} obj - 복사할 객체
 * @returns {Object} 복사된 객체
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (typeof obj === "object") {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 안전한 숫자 변환
 * @param {any} value - 변환할 값
 * @param {number} defaultValue - 기본값
 * @returns {number} 변환된 숫자
 */
export function safeParseFloat(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 문자열이 비어있는지 확인
 * @param {string} str - 확인할 문자열
 * @returns {boolean} 비어있으면 true
 */
export function isEmptyString(str) {
  return !str || str.trim().length === 0;
}

/**
 * 배열이 비어있는지 확인
 * @param {Array} arr - 확인할 배열
 * @returns {boolean} 비어있으면 true
 */
export function isEmptyArray(arr) {
  return !Array.isArray(arr) || arr.length === 0;
}

/**
 * 스크롤 위치 초기화
 */
export function resetScrollPosition() {
  const tableBody = document.querySelector(".table-body .ss-content");
  if (tableBody) {
    tableBody.scrollTop = 0;
  }
}

// API 캐싱 시스템
const API_CACHE = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * API 캐시 키 생성
 * @param {string} type - API 타입
 * @param {Object} params - API 파라미터
 * @returns {string} 캐시 키
 */
function generateCacheKey(type, params = {}) {
  return `${type}_${JSON.stringify(params)}`;
}

/**
 * 캐시된 데이터 반환
 * @param {string} key - 캐시 키
 * @returns {Object|null} 캐시된 데이터 또는 null
 */
function getCachedData(key) {
  const cached = API_CACHE.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    API_CACHE.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * 데이터를 캐시에 저장
 * @param {string} key - 캐시 키
 * @param {*} data - 저장할 데이터
 */
function setCachedData(key, data) {
  API_CACHE.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 캐시된 API 호출 함수
 * @param {string} type - API 타입
 * @param {Object} params - API 파라미터
 * @param {Function} apiCall - 실제 API 호출 함수
 * @returns {Promise<*>} API 응답 데이터
 */
export async function cachedApiCall(type, params, apiCall) {
  const cacheKey = generateCacheKey(type, params);

  // 캐시된 데이터 확인
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log(`캐시된 데이터 사용: ${type}`);
    return cachedData;
  }

  // API 호출
  const data = await apiCall();

  // 결과 캐싱
  setCachedData(cacheKey, data);

  return data;
}

/**
 * 캐시 무효화
 * @param {string} type - 무효화할 API 타입 (선택적)
 */
export function invalidateCache(type = null) {
  if (type) {
    // 특정 타입의 캐시만 무효화
    for (const key of API_CACHE.keys()) {
      if (key.startsWith(type)) {
        API_CACHE.delete(key);
      }
    }
  } else {
    // 전체 캐시 무효화
    API_CACHE.clear();
  }
}

// 에러 복구 시스템
const ERROR_RECOVERY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  BACKOFF_MULTIPLIER: 1.5,
};

/**
 * 지수 백오프를 사용한 재시도 함수
 * @param {Function} operation - 재시도할 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} baseDelay - 기본 지연 시간 (ms)
 * @returns {Promise<*>} 함수 실행 결과
 */
export async function retryWithBackoff(
  operation,
  maxRetries = ERROR_RECOVERY_CONFIG.MAX_RETRIES,
  baseDelay = ERROR_RECOVERY_CONFIG.RETRY_DELAY
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        console.error(`최대 재시도 횟수 초과 (${maxRetries + 1}회):`, error);
        throw error;
      }

      const delay =
        baseDelay * Math.pow(ERROR_RECOVERY_CONFIG.BACKOFF_MULTIPLIER, attempt);
      console.log(
        `재시도 ${attempt + 1}/${maxRetries + 1} (${delay}ms 후):`,
        error.message
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 네트워크 연결 상태 확인
 * @returns {boolean} 네트워크 연결 상태
 */
export function isNetworkAvailable() {
  return navigator.onLine;
}

/**
 * 네트워크 상태 변경 감지
 * @param {Function} onOnline - 온라인 상태일 때 호출할 함수
 * @param {Function} onOffline - 오프라인 상태일 때 호출할 함수
 */
export function setupNetworkMonitoring(onOnline, onOffline) {
  window.addEventListener("online", () => {
    console.log("네트워크 연결 복구됨");
    onOnline?.();
  });

  window.addEventListener("offline", () => {
    console.log("네트워크 연결 끊어짐");
    onOffline?.();
  });
}
