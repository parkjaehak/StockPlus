// tokenManager.js - 토큰 및 승인키 관리

import { API_CONFIG, API_ENDPOINTS } from "./config.js";

export class TokenManager {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.approvalKey = null;
    this.approvalKeyExpiry = null;
    this.tokenRequestPromise = null;
  }

  async getAccessToken() {
    // 캐시된 토큰이 유효한 경우
    if (this.isTokenValid()) {
      return this.accessToken;
    }

    // 저장된 토큰 확인
    const storedToken = await this.getStoredToken();
    if (storedToken) {
      this.accessToken = storedToken.accessToken;
      this.tokenExpiry = storedToken.tokenExpiry;
      return this.accessToken;
    }

    // 새 토큰 요청
    return this.requestNewToken();
  }

  async getApprovalKey() {
    if (this.isApprovalKeyValid()) {
      return this.approvalKey;
    }

    const storedKey = await this.getStoredApprovalKey();
    if (storedKey) {
      this.approvalKey = storedKey.approvalKey;
      this.approvalKeyExpiry = storedKey.approvalKeyExpiry;
      return this.approvalKey;
    }

    return this.requestNewApprovalKey();
  }

  isTokenValid() {
    return (
      this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry
    );
  }

  isApprovalKeyValid() {
    return (
      this.approvalKey &&
      this.approvalKeyExpiry &&
      Date.now() < this.approvalKeyExpiry
    );
  }

  async getStoredToken() {
    const stored = await chrome.storage.local.get([
      "accessToken",
      "tokenExpiry",
    ]);
    if (
      stored.accessToken &&
      stored.tokenExpiry &&
      Date.now() < stored.tokenExpiry
    ) {
      return stored;
    }
    return null;
  }

  async getStoredApprovalKey() {
    const stored = await chrome.storage.local.get([
      "approvalKey",
      "approvalKeyExpiry",
    ]);
    if (
      stored.approvalKey &&
      stored.approvalKeyExpiry &&
      Date.now() < stored.approvalKeyExpiry
    ) {
      return stored;
    }
    return null;
  }

  async requestNewToken() {
    if (this.tokenRequestPromise) return this.tokenRequestPromise;

    this.tokenRequestPromise = this._fetchToken();
    try {
      return await this.tokenRequestPromise;
    } finally {
      this.tokenRequestPromise = null;
    }
  }

  async _fetchToken() {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: API_CONFIG.APP_KEY,
          appsecret: API_CONFIG.APP_SECRET,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.access_token) {
      throw new Error(
        `토큰 발급 실패: ${data.error_description || response.statusText}`
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    await chrome.storage.local.set({
      accessToken: this.accessToken,
      tokenExpiry: this.tokenExpiry,
    });
    return this.accessToken;
  }

  async requestNewApprovalKey() {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_ENDPOINTS.APPROVAL_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; utf-8" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            appkey: API_CONFIG.APP_KEY,
            secretkey: API_CONFIG.APP_SECRET,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.approval_key) {
        throw new Error(
          `실시간 접속키 발급 실패: ${
            data.error_description || response.statusText
          }`
        );
      }

      this.approvalKey = data.approval_key;
      this.approvalKeyExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24시간
      await chrome.storage.local.set({
        approvalKey: this.approvalKey,
        approvalKeyExpiry: this.approvalKeyExpiry,
      });
      return this.approvalKey;
    } catch (error) {
      console.error("실시간 접속키 발급 오류:", error);
      return null;
    }
  }
}
