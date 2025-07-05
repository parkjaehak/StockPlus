// dataManager.js - 데이터 관리 및 API 호출

import {
  renderTable,
  updateHeaderArrows,
  setFilteredStocks,
  getFilteredStocks,
} from "./uiManager.js";
import {
  showLoading,
  showNotification,
  resetScrollPosition,
  transformStockData,
  isEmptyString,
  isEmptyArray,
  cachedApiCall,
} from "../utils.js";
import { API_CONSTANTS, ERROR_MESSAGES } from "../constants.js";

/**
 * 검색 종목 조회 (캐싱 적용)
 * @param {Array} stockCodes - 종목 코드 배열
 * @param {string} marketCode - 마켓 코드
 * @returns {Promise<Array>} 종목 데이터 배열
 */
export async function fetchStockData(stockCodes, marketCode) {
  return cachedApiCall(
    "GET_MULTIPLE_STOCKS",
    { stockCodes, marketCode },
    async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_MULTIPLE_STOCKS",
          data: {
            stockCodes,
            marketCode,
          },
        });

        if (response?.success) {
          return response.data || [];
        } else {
          const errorMessage =
            response?.error || ERROR_MESSAGES.DATA_FETCH_ERROR;
          console.error("API 응답 실패:", errorMessage);
          showNotification(errorMessage, "error");
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error("API 데이터 조회 실패:", error);

        // Background script 연결 오류인 경우
        if (error.message.includes("Receiving end does not exist")) {
          showNotification(ERROR_MESSAGES.EXTENSION_NOT_READY, "warning");
        } else {
          showNotification(ERROR_MESSAGES.DATA_FETCH_ERROR, "error");
        }
        return [];
      }
    }
  );
}

/**
 * 공통 API 호출 함수
 * @param {string} type - API 타입
 * @param {Object} data - 요청 데이터
 * @returns {Promise<Array>} API 응답 데이터
 */
export async function callApi(type, data) {
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      data,
    });

    if (response?.success) {
      return response.data || [];
    } else {
      const errorMessage = response?.error || ERROR_MESSAGES.DATA_FETCH_ERROR;
      console.error(`API 응답 실패 (${type}):`, errorMessage);
      showNotification(errorMessage, "error");
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error(`API 호출 실패 (${type}):`, error);

    // Background script 연결 오류인 경우
    if (error.message.includes("Receiving end does not exist")) {
      showNotification(ERROR_MESSAGES.EXTENSION_NOT_READY, "warning");
    } else {
      showNotification(ERROR_MESSAGES.DATA_FETCH_ERROR, "error");
    }
    return [];
  }
}

// 실시간 데이터 중지
export function stopRealTimeData() {
  callApi("STOP_REAL_TIME", {}).catch((error) => {
    console.error("실시간 데이터 중지 오류:", error);
  });
}

/**
 * 종목 검색 (키워드 기반)
 * @param {HTMLInputElement} searchInput - 검색 입력 요소
 * @param {HTMLSelectElement} marketSelect - 마켓 선택 요소
 * @param {Object} stockSymbols - 종목 심볼 데이터
 */
export async function filterStocks(searchInput, marketSelect, stockSymbols) {
  const keyword = searchInput.value.trim().toLowerCase();

  // 검색어가 없으면, 시가총액 순위로 다시 조회
  if (isEmptyString(keyword)) {
    await filterByMarket(marketSelect);
    return;
  }

  showLoading(true);
  resetScrollPosition();

  try {
    const selectedMarket = marketSelect.value;
    const marketSymbols = stockSymbols[selectedMarket] || [];

    // 종목명과 종목코드 모두에서 검색
    const matchedStocks = marketSymbols.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(keyword);
      const codeMatch = s.code.includes(keyword);
      return nameMatch || codeMatch;
    });

    if (!isEmptyArray(matchedStocks)) {
      const stockCodes = matchedStocks.map((s) => s.code);
      const marketCode = marketSelect.value;

      const responseData = await fetchStockData(stockCodes, marketCode);

      if (Array.isArray(responseData) && responseData.length > 0) {
        const stocks = responseData.map((d) =>
          transformStockData(d, marketCode, marketSymbols)
        );

        setFilteredStocks(stocks);
      } else {
        setFilteredStocks([]);
      }
    } else {
      setFilteredStocks([]);
    }

    // 초기 렌더링 - 첫 페이지만 표시
    const allStocks = getFilteredStocks();
    renderTable(allStocks, false, selectedMarket);
    updateHeaderArrows();
  } catch (error) {
    console.error("검색 중 오류:", error);
  } finally {
    showLoading(false);
  }
}

/**
 * 마켓별 필터링 (KOSPI/KOSDAQ)
 * @param {HTMLSelectElement} marketSelect - 마켓 선택 요소
 */
export async function filterByMarket(marketSelect) {
  const market = marketSelect.value;
  showLoading(true);
  resetScrollPosition();

  try {
    const responseData = await callApi("GET_TOP_VOLUME_STOCKS", {
      marketCode: market,
    });

    if (Array.isArray(responseData) && responseData.length > 0) {
      const stocks = responseData.map((d) => ({
        name: d.name,
        code: d.code,
        market,
        price: parseFloat(d.price) || 0,
        change_price: parseFloat(d.change) || 0,
        change_rate: parseFloat(d.chgrate) || 0,
        volume: parseFloat(d.acml_vol) || 0,
      }));

      setFilteredStocks(stocks);
    } else {
      console.error("시가총액 상위 종목 조회 실패: 데이터가 없습니다.");
      setFilteredStocks([]);
    }

    // 초기 렌더링 - 첫 페이지만 표시
    const allStocks = getFilteredStocks();
    renderTable(allStocks, false, market);
    updateHeaderArrows();
  } catch (error) {
    console.error("시가총액 상위 종목 조회 중 오류:", error);
  } finally {
    showLoading(false);
  }
}

/**
 * 즐겨찾기 목록 저장 (시장별)
 * @param {Array} favorites - 즐겨찾기 종목 코드 배열
 * @param {string} market - 마켓 코드
 */
export function saveFavorites(favorites, market) {
  localStorage.setItem(`favoriteStocks_${market}`, JSON.stringify(favorites));
}

/**
 * 즐겨찾기 목록 불러오기 (시장별)
 * @param {string} market - 마켓 코드
 * @returns {Array} 즐겨찾기 종목 코드 배열
 */
export function getFavorites(market) {
  const data = localStorage.getItem(`favoriteStocks_${market}`);
  return data ? JSON.parse(data) : [];
}

/**
 * 즐겨찾기 토글 (시장별)
 * @param {string} stockCode - 종목 코드
 * @param {string} market - 마켓 코드
 */
export function toggleFavorite(stockCode, market) {
  let favorites = getFavorites(market);
  if (favorites.includes(stockCode)) {
    favorites = favorites.filter((code) => code !== stockCode);
  } else {
    favorites.push(stockCode);
  }
  saveFavorites(favorites, market);
}
