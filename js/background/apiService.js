// apiService.js - 서버 프록시 API 호출 서비스

import { SERVER_CONFIG } from "./config.js";
import { ERROR_MESSAGES, API_CONSTANTS } from "../constants.js";

/**
 * 서버 프록시 API 호출 서비스
 * 주식 데이터 조회, 서버 상태 확인 등의 API 호출을 담당
 */
export class ApiService {
  /**
   * ApiService 생성자
   */
  constructor() {
    this.baseUrl = SERVER_CONFIG.BASE_URL;
  }

  /**
   * 서버 헬스체크
   * @returns {Promise<Object>} 서버 상태 정보
   * @throws {Error} 서버 연결 실패 시
   */
  async checkServerHealth() {
    try {
      const response = await fetch(
        `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.HEALTH}`,
        {
          method: "GET",
          timeout: API_CONSTANTS.REQUEST_TIMEOUT,
        }
      );

      if (!response.ok) {
        throw new Error(`서버 연결 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("서버 헬스체크 실패:", error);
      throw new Error(ERROR_MESSAGES.SERVER_CONNECTION_FAILED);
    }
  }

  /**
   * 상위 거래량 종목 조회 (조건 검색 사용)
   * @param {string} marketCode - 마켓 코드 (KOSPI/KOSDAQ)
   * @returns {Promise<Array>} 상위 거래량 종목 목록
   * @throws {Error} 조건 검색식 찾기 실패 시
   */
  async fetchTopRankedStocks(marketCode = MARKET_CONSTANTS.DEFAULT_MARKET) {
    const conditionName = this._getConditionNameByMarket(marketCode);
    const seq = await this._findSearchConditionSeq(conditionName);

    if (!seq) {
      throw new Error(`조건검색식 '${conditionName}'을(를) 찾을 수 없습니다.`);
    }

    const searchResult = await this._fetchStocksBySearch(seq);
    return searchResult.output2 || [];
  }

  /**
   * 마켓별 조건 검색식 이름 반환
   * @param {string} marketCode - 마켓 코드
   * @returns {string} 조건 검색식 이름
   */
  _getConditionNameByMarket(marketCode) {
    const conditionMap = {
      [MARKET_CONSTANTS.KOSPI]: "코스피100",
      [MARKET_CONSTANTS.KOSDAQ]: "코스닥100",
    };
    return conditionMap[marketCode] || "코스피100";
  }

  /**
   * 조건검색식 목록에서 seq 찾기
   * @param {string} conditionName - 조건 검색식 이름
   * @returns {Promise<string|null>} 조건 검색식 seq
   * @throws {Error} API 응답 오류 시
   */
  async _findSearchConditionSeq(conditionName) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.SEARCH_CONDITIONS}`,
      {
        method: "GET",
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
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

  /**
   * seq로 종목 리스트 조회
   * @param {string} seq - 조건 검색식 seq
   * @returns {Promise<Object>} 검색 결과
   * @throws {Error} API 응답 오류 시
   */
  async _fetchStocksBySearch(seq) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.SEARCH_RESULT}?seq=${seq}`,
      {
        method: "GET",
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
      }
    );

    return this.handleApiResponse(response);
  }

  /**
   * 다중 종목 조회 (검색 시 사용)
   * @param {Array<string>} stockCodes - 종목 코드 배열
   * @returns {Promise<Array>} 종목 데이터 배열
   * @throws {Error} API 응답 오류 시
   */
  async fetchMultipleStocks(stockCodes) {
    if (!stockCodes || stockCodes.length === 0) {
      return [];
    }

    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.STOCK_PRICES}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stockCodes }),
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
      }
    );

    const data = await this.handleApiResponse(response);
    return data.results || [];
  }

  /**
   * 단일 종목 조회
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object|null>} 종목 데이터
   * @throws {Error} API 응답 오류 시
   */
  async fetchSingleStock(stockCode) {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.STOCK_PRICE}?stockCode=${stockCode}`,
      {
        method: "GET",
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
      }
    );

    const data = await this.handleApiResponse(response);
    return data.output || null;
  }

  /**
   * 승인키 조회 (실시간 데이터용)
   * @returns {Promise<string>} 승인키
   * @throws {Error} API 응답 오류 시
   */
  async getApprovalKey() {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.APPROVAL_KEY}`,
      {
        method: "GET",
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
      }
    );

    const data = await this.handleApiResponse(response);
    return data.approval_key;
  }

  /**
   * 토큰 상태 확인
   * @returns {Promise<Object>} 토큰 상태 정보
   * @throws {Error} API 응답 오류 시
   */
  async getTokenStatus() {
    const response = await fetch(
      `${this.baseUrl}${SERVER_CONFIG.ENDPOINTS.TOKEN_STATUS}`,
      {
        method: "GET",
        timeout: API_CONSTANTS.REQUEST_TIMEOUT,
      }
    );

    return this.handleApiResponse(response);
  }

  /**
   * API 응답 처리
   * @param {Response} response - fetch 응답 객체
   * @returns {Promise<Object>} 파싱된 응답 데이터
   * @throws {Error} HTTP 오류 시
   */
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

  /**
   * 서버 연결 테스트
   * @returns {Promise<Object>} 서버 연결 상태 정보
   */
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
      console.error("서버 연결 테스트 실패:", error);
      return {
        server: "disconnected",
        error: error.message,
      };
    }
  }
}
