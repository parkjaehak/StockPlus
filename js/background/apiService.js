// apiService.js - API 호출 서비스

import { API_CONFIG, API_ENDPOINTS } from "./config.js";

export class ApiService {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  // 조건 검색으로 대체된 함수
  async fetchTopRankedStocks(marketCode = "KOSPI") {
    const conditionName = marketCode === "KOSPI" ? "코스피100" : "코스닥100";
    const seq = await this._findSearchConditionSeq(conditionName);

    if (!seq) {
      throw new Error(`조건검색식 '${conditionName}'을(를) 찾을 수 없습니다.`);
    }

    const searchResult = await this._fetchStocksBySearch(seq);

    // '조건검색 결과조회' API의 응답은 'output2' 필드에 담겨 있습니다.
    const newStockList = searchResult.output2;
    if (!newStockList) {
      return []; // 결과가 없으면 빈 배열 반환
    }

    // 새 API 응답을 기존 UI가 사용하던 데이터 형식으로 변환
    return this._transformStockData(newStockList);
  }

  // 조건검색식 목록에서 seq 찾기
  async _findSearchConditionSeq(conditionName) {
    const token = await this.tokenManager.getAccessToken();
    const params = new URLSearchParams({
      user_id: API_CONFIG.HTS_USER_ID,
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.PSEARCH_TITLE}?${params}`,
      {
        method: "GET",
        headers: this.buildHeaders(token, "HHKST03900300"),
      }
    );

    const data = await this.handleApiResponse(response);

    const conditionList = data.output2;
    if (!conditionList) {
      throw new Error("API 응답에서 조건 목록(output2)을 찾을 수 없습니다.");
    }

    const condition = conditionList.find(
      (c) => c.condition_nm === conditionName
    );
    return condition ? condition.seq : null;
  }

  // seq로 종목 리스트 조회
  async _fetchStocksBySearch(seq) {
    const token = await this.tokenManager.getAccessToken();
    const params = new URLSearchParams({
      user_id: API_CONFIG.HTS_USER_ID,
      seq: seq,
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.PSEARCH_RESULT}?${params}`,
      {
        method: "GET",
        headers: this.buildHeaders(token, "HHKST03900400"),
      }
    );

    return this.handleApiResponse(response);
  }

  // 데이터 구조 변환 함수
  _transformStockData(stockList) {
    return stockList.map((stock) => ({
      mksc_shrn_iscd: stock.code, // 종목 코드 (code -> mksc_shrn_iscd)
      hts_kor_isnm: stock.name, // 종목명 (name -> hkor_isnm)
      stck_prpr: stock.price, // 현재가 (price -> stck_prpr)
      prdy_vrss: stock.change, // 전일 대비 (change -> prdy_vrss)
      prdy_ctrt: stock.chgrate, // 등락률 (chgrate -> prdy_ctrt)
      acml_vol: stock.acml_vol, // 거래량 (acml_vol -> acml_vol)
      // 필요한 경우 여기에 다른 필드 매핑을 추가할 수 있습니다.
    }));
  }

  // 종목 조회 (검색 시 사용)
  async fetchMultipleStocks(stockCodes) {
    const token = await this.tokenManager.getAccessToken();
    const results = [];

    for (const code of stockCodes) {
      const params = new URLSearchParams({
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: code,
      });

      const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.STOCK_PRICE}?${params}`;
      const response = await fetch(url, {
        headers: this.buildHeaders(token, "FHKST01010100"),
      });

      // 공통 응답 핸들러를 사용하도록 리팩토링
      const data = await this.handleApiResponse(response);
      if (data.output) {
        results.push(data.output);
      }

      await this.delay(100); // API Rate limit
    }

    return results;
  }

  buildHeaders(token, trId) {
    return {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: API_CONFIG.APP_KEY,
      appsecret: API_CONFIG.APP_SECRET,
      tr_id: trId,
      custtype: "P", // 개인 투자자
    };
  }

  async handleApiResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP 오류! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.rt_cd !== "0") {
      // 파이썬 예시에 따라 에러 메시지에 msg_cd를 추가합니다.
      throw new Error(`API 오류: ${data.msg1} (응답코드: ${data.msg_cd})`);
    }

    // data.output 대신 전체 데이터 객체를 반환하도록 변경
    return data;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
