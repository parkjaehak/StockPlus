// apiService.js - API 호출 서비스

import { API_CONFIG, API_ENDPOINTS } from "./config.js";

export class ApiService {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  // 시가총액 순위 조회
  async fetchTopRankedStocks(marketCode = "KOSPI") {
    const token = await this.tokenManager.getAccessToken();
    const params = this.buildTopRankParams(marketCode);

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TOP_RANK}?${params}`,
      {
        method: "GET",
        headers: this.buildHeaders(token, "FHPST01740000"),
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

      if (response.ok) {
        const data = await response.json();
        if (data.output) {
          results.push(data.output);
        }
      }

      await this.delay(100); // API Rate limit
    }

    return results;
  }

  buildTopRankParams(marketCode) {
    return new URLSearchParams({
      fid_cond_mrkt_div_code: "J",
      fid_cond_scr_div_code: "20174",
      fid_input_iscd: marketCode === "KOSPI" ? "0001" : "1001",
      fid_div_cls_code: "0",
      fid_blng_cls_code: "0",
      fid_trgt_cls_code: "111111111",
      fid_trgt_exls_cls_code: "0000000000",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_input_date_1: "",
    });
  }

  buildHeaders(token, trId) {
    return {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: API_CONFIG.APP_KEY,
      appsecret: API_CONFIG.APP_SECRET,
      tr_id: trId,
    };
  }

  async handleApiResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP 오류! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.rt_cd !== "0") {
      throw new Error(`API 오류: ${data.msg1}`);
    }

    return data.output;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
