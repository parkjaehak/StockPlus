// apiService.js - 서버 프록시 API 호출 서비스

import { SERVER_CONFIG } from "./config.js";

export class ApiService {
  constructor() {
    this.baseUrl = SERVER_CONFIG.BASE_URL;
  }

  // 서버 헬스체크
  async checkServerHealth() {
    try {
      const response = await fetch(
        `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.HEALTH}`
      );
      if (!response.ok) {
        throw new Error(`서버 연결 실패: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("서버 헬스체크 실패:", error);
      throw new Error(
        "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요."
      );
    }
  }

  // 조건 검색으로 대체된 함수
  async fetchTopRankedStocks(marketCode = "KOSPI") {
    const conditionName = marketCode === "KOSPI" ? "코스피100" : "코스닥100";
    const seq = await this._findSearchConditionSeq(conditionName);

    if (!seq) {
      throw new Error(`조건검색식 '${conditionName}'을(를) 찾을 수 없습니다.`);
    }

    const searchResult = await this._fetchStocksBySearch(seq);
    return searchResult.output2 || [];
  }

  // 조건검색식 목록에서 seq 찾기
  async _findSearchConditionSeq(conditionName) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.SEARCH_CONDITIONS}`
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
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.SEARCH_RESULT}?seq=${seq}`
    );

    return this.handleApiResponse(response);
  }

  // 종목 조회 (검색 시 사용)
  async fetchMultipleStocks(stockCodes) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.STOCK_PRICES}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stockCodes }),
      }
    );

    const data = await this.handleApiResponse(response);
    return data.results || [];
  }

  // 단일 종목 조회
  async fetchSingleStock(stockCode) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.STOCK_PRICE}?stockCode=${stockCode}`
    );

    const data = await this.handleApiResponse(response);
    return data.output || null;
  }

  // 승인키 조회 (실시간 데이터용)
  async getApprovalKey() {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.APPROVAL_KEY}`
    );

    const data = await this.handleApiResponse(response);
    return data.approval_key;
  }

  // 토큰 상태 확인
  async getTokenStatus() {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.TOKEN_STATUS}`
    );

    return this.handleApiResponse(response);
  }

  async handleApiResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP 오류! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  }

  // 서버 연결 테스트
  async testConnection() {
    try {
      const health = await this.checkServerHealth();
      const tokenStatus = await this.getTokenStatus();

      return {
        server: "connected",
        health: health,
        tokenStatus: tokenStatus,
      };
    } catch (error) {
      return {
        server: "disconnected",
        error: error.message,
      };
    }
  }
}
