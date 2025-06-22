// dataManager.js - 데이터 관리 및 API 호출

import {
  renderTable,
  updateHeaderArrows,
  showLoading,
  showNotification,
  setFilteredStocks,
  getFilteredStocks,
  getPageSize,
} from "./uiManager.js";

// API 관련 함수들
export async function fetchStockData(stockCodes, marketCode) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_MULTIPLE_STOCKS",
      data: {
        stockCodes: stockCodes,
        marketCode: marketCode,
      },
    });

    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response?.error || "API 응답 오류");
    }
  } catch (error) {
    console.error("API 데이터 조회 실패:", error);
    // API 실패시 mock 데이터 사용
    return [];
  }
}

export async function startRealTimeData(stockCodes) {
  const maxRetries = 3;
  let retryCount = 0;

  const attemptConnection = async () => {
    try {
      console.log(
        `실시간 데이터 연결 시도 ${retryCount + 1}/${maxRetries}:`,
        stockCodes
      );

      const response = await chrome.runtime.sendMessage({
        type: "START_REAL_TIME",
        data: stockCodes,
      });

      console.log("background.js로부터 받은 응답:", response);

      if (response && response.success) {
        console.log("실시간 데이터 시작 성공:", response.message);
        return true;
      } else {
        console.error(
          "실시간 데이터 시작 실패:",
          response?.error || "알 수 없는 오류"
        );

        // 자세한 오류 정보 로깅
        if (response?.details) {
          console.error("오류 상세 정보:", response.details);
        }

        // 사용자에게 오류 알림
        const errorMessage =
          response?.error || "실시간 데이터 연결에 실패했습니다.";
        showNotification(errorMessage, "error");

        return false;
      }
    } catch (error) {
      console.error(`실시간 데이터 연결 시도 ${retryCount + 1} 실패:`, error);

      if (error.message.includes("Receiving end does not exist")) {
        console.log("Background script가 아직 로드되지 않았습니다.");
        showNotification(
          "확장 프로그램이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.",
          "warning"
        );
        return false;
      }

      throw error;
    }
  };

  while (retryCount < maxRetries) {
    try {
      const success = await attemptConnection();
      if (success) {
        return;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`${retryCount * 2}초 후 재시도합니다...`);
        await new Promise((resolve) => setTimeout(resolve, retryCount * 2000));
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error("실시간 데이터 연결 최종 실패:", error);
        // 사용자에게 알림
        showNotification(
          "실시간 데이터 연결에 실패했습니다. API 키를 확인해주세요.",
          "error"
        );
        break;
      }

      console.log(`${retryCount * 2}초 후 재시도합니다...`);
      await new Promise((resolve) => setTimeout(resolve, retryCount * 2000));
    }
  }
}

export function stopRealTimeData() {
  chrome.runtime
    .sendMessage({
      type: "STOP_REAL_TIME",
    })
    .catch((error) => {
      console.error("실시간 데이터 중지 오류:", error);
    });
}

// 검색 및 필터링 함수들
export async function filterStocks(searchInput, marketSelect, stockSymbols) {
  const keyword = searchInput.value.trim().toLowerCase();

  // 검색어가 없으면, 시가총액 순위로 다시 조회
  if (!keyword) {
    await filterByMarket(marketSelect);
    return;
  }

  showLoading(true);
  try {
    // KOSPI와 KOSDAQ 목록을 합쳐서 검색
    const allSymbols = [...stockSymbols.KOSPI, ...stockSymbols.KOSDAQ];
    const matchedStocks = allSymbols.filter((s) =>
      s.name.toLowerCase().includes(keyword)
    );

    if (matchedStocks.length > 0) {
      const stockCodes = matchedStocks.map((s) => s.code);
      const marketCode = marketSelect.value;

      const response = await chrome.runtime.sendMessage({
        type: "GET_MULTIPLE_STOCKS",
        data: { stockCodes, marketCode },
      });

      if (response && response.success && Array.isArray(response.data)) {
        const stocks = response.data.map((d) => ({
          name: d.stck_shrn_iscd, // API 응답에 이름이 없으므로 코드를 사용
          code: d.stck_shrn_iscd,
          market: marketCode,
          price: parseFloat(d.stck_prpr) || 0,
          change_rate: parseFloat(d.prdy_ctrt) || 0,
          change_price: parseFloat(d.prdy_vrss) || 0,
          volume: parseFloat(d.acml_vol) || 0, // 개별 조회 응답에는 acml_vol이 없을 수 있음
        }));

        // 검색 결과에 한글 이름 매핑
        stocks.forEach((stock) => {
          const match = matchedStocks.find((s) => s.code === stock.code);
          if (match) stock.name = match.name;
        });

        setFilteredStocks(stocks);
      } else {
        setFilteredStocks([]);
        showNotification("검색 결과를 가져오는 데 실패했습니다.", "error");
      }
    } else {
      setFilteredStocks([]);
    }

    renderTable(getFilteredStocks().slice(0, getPageSize()));
    updateHeaderArrows();
    // 검색 결과는 실시간 구독에서 제외
    stopRealTimeData();
  } catch (error) {
    console.error("검색 중 오류:", error);
    showNotification("검색 중 오류가 발생했습니다.", "error");
  } finally {
    showLoading(false);
  }
}

export async function filterByMarket(marketSelect) {
  const market = marketSelect.value;
  showLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_TOP_VOLUME_STOCKS",
      data: { marketCode: market },
    });

    if (response && response.success && Array.isArray(response.data)) {
      const stocks = response.data.map((d) => ({
        name: d.hts_kor_isnm,
        code: d.mksc_shrn_iscd,
        market: market,
        price: parseFloat(d.stck_prpr) || 0,
        change_rate: parseFloat(d.prdy_ctrt) || 0,
        change_price: parseFloat(d.prdy_vrss) || 0,
        volume: parseFloat(d.acml_vol) || 0,
      }));

      // 파싱된 첫 번째 종목 데이터 로깅
      if (stocks.length > 0) {
        console.log("파싱 후 첫 번째 종목 데이터:", stocks[0]);
      }

      setFilteredStocks(stocks);

      const stockCodes = stocks.filter((s) => s.code).map((s) => s.code);
      if (stockCodes.length > 0) {
        startRealTimeData(stockCodes);
      }
    } else {
      console.error(
        "시가총액 상위 종목 조회 실패:",
        (response && response.error) || "데이터 형식이 올바르지 않습니다."
      );
      setFilteredStocks([]);
      showNotification("데이터를 불러오는 데 실패했습니다.", "error");
    }

    renderTable(getFilteredStocks().slice(0, getPageSize()));
    updateHeaderArrows();
  } catch (error) {
    console.error("시가총액 상위 종목 조회 중 오류:", error);
    showNotification("데이터를 불러오는 중 오류가 발생했습니다.", "error");
  } finally {
    showLoading(false);
  }
}

// 디바운싱 함수
export function debounceSearch(func, delay) {
  let searchTimeout;
  return function (...args) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => func.apply(this, args), delay);
  };
}
