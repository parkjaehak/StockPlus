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
    // 변환 없이 output2(원본)만 그대로 반환
    return searchResult.output2 || [];
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
