import { stocks } from "./mockStocks.js";

// 정렬 상태
let sortKey = null;
let sortOrder = "desc"; // 'asc' or 'desc'

// 무한 스크롤 관련
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredStocks = [];
let realTimeData = new Map();

// API 설정
const API_KEYS = {
  APP_KEY: "PSt13mFcGxsWaa7rsELOKngU9uLOVSgeVnpO",
  APP_SECRET:
    "Cud3wKOeN009J8YJ+sh3tCrsUlav6iQNZ79Ume4QKfcE16yq9kL8MZ8Mwb5r4Q7t+kkyVbgNRwKx3zXlM+EK3nueUJpVxGOfxWOXI9obAzINPnmfMR96ibD6Vzb3ED4fCJ/bdJhfz+yTR5+sY0TLf7iSf0CIULmTY4MTDCzpfcgtHbptL3I=",
};

const headerDefs = [
  { label: "종목명", key: null },
  { label: "현재가", key: "price" },
  { label: "전일대비", key: "change_rate" },
  { label: "거래대금", key: "volume" },
];

// API 관련 함수들
async function fetchStockData(stockCodes, marketCode) {
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
    return stocks.filter((stock) => stockCodes.includes(stock.code));
  }
}

async function startRealTimeData(stockCodes) {
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

      if (response && response.success) {
        console.log("실시간 데이터 시작 성공:", response.message);
        return true;
      } else {
        console.error(
          "실시간 데이터 시작 실패:",
          response?.error || "알 수 없는 오류"
        );
        return false;
      }
    } catch (error) {
      console.error(`실시간 데이터 연결 시도 ${retryCount + 1} 실패:`, error);

      if (error.message.includes("Receiving end does not exist")) {
        console.log("Background script가 아직 로드되지 않았습니다.");
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

function stopRealTimeData() {
  chrome.runtime
    .sendMessage({
      type: "STOP_REAL_TIME",
    })
    .catch((error) => {
      console.error("실시간 데이터 중지 오류:", error);
    });
}

// 실시간 데이터 업데이트 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REAL_TIME_UPDATE") {
    const { code, price, change_rate, change_price, volume } = message.data;

    // 실시간 데이터 저장
    realTimeData.set(code, {
      price,
      change_rate,
      change_price,
      volume,
      timestamp: Date.now(),
    });

    // UI 업데이트
    updateStockRow(code);
  }
});

// 주식 행 업데이트
function updateStockRow(stockCode) {
  const row = document.querySelector(`tr[data-code="${stockCode}"]`);
  if (!row) return;

  const data = realTimeData.get(stockCode);
  if (!data) return;

  // 현재가 업데이트
  const priceCell = row.querySelector("td:nth-child(2)");
  if (priceCell) {
    priceCell.textContent = formatNumber(Math.abs(data.price));
    priceCell.className = getChangeClass(data.change_rate);
  }

  // 전일대비 업데이트
  const changeCell = row.querySelector("td:nth-child(3)");
  if (changeCell) {
    changeCell.innerHTML = `
      <div>${
        data.change_rate > 0 ? "+" : data.change_rate < 0 ? "-" : ""
      }${Math.abs(data.change_rate).toFixed(2)}%</div>
      <div class="sub">${
        data.change_price > 0 ? "+" : data.change_price < 0 ? "-" : ""
      }${formatNumber(Math.abs(data.change_price))}</div>
    `;
    changeCell.className = getChangeClass(data.change_rate);
  }

  // 거래대금 업데이트
  const volumeCell = row.querySelector("td:nth-child(4)");
  if (volumeCell) {
    volumeCell.textContent = formatVolume(data.volume);
  }
}

function formatNumber(num) {
  return Number(num).toLocaleString();
}

function getChangeClass(rate) {
  if (rate > 0) return "text-rise";
  if (rate < 0) return "text-fall";
  return "text-even";
}

function formatVolume(val) {
  return (val / 100000000).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function getSortIcon(key) {
  if (!key) return "";
  const isActive = sortKey === key;
  let iconClass = "fas fa-sort sort-icon";
  if (isActive) {
    iconClass =
      sortOrder === "asc"
        ? "fas fa-sort-up sort-icon sort-active"
        : "fas fa-sort-down sort-icon sort-active";
  }
  return `<i class="${iconClass}"></i>`;
}

function renderTable(data, append = false) {
  const tbody = document.getElementById("stock-tbody");
  if (!append) tbody.innerHTML = "";

  data.forEach((stock) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-code", stock.code);

    // 실시간 데이터가 있으면 사용, 없으면 기본 데이터 사용
    const displayData = realTimeData.get(stock.code) || stock;

    tr.innerHTML = `
      <td>
        <div class="stock-name">${stock.name}</div>
        <div class="stock-code">${stock.code}</div>
      </td>
      <td class="${getChangeClass(displayData.change_rate)}">
        ${formatNumber(Math.abs(displayData.price))}
      </td>
      <td class="${getChangeClass(displayData.change_rate)}">
        <div>${
          displayData.change_rate > 0
            ? "+"
            : displayData.change_rate < 0
            ? "-"
            : ""
        }${Math.abs(displayData.change_rate).toFixed(2)}%</div>
        <div class="sub">${
          displayData.change_price > 0
            ? "+"
            : displayData.change_price < 0
            ? "-"
            : ""
        }${formatNumber(Math.abs(displayData.change_price))}</div>
      </td>
      <td>${formatVolume(displayData.volume)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTableHeader() {
  const thead = document.querySelector(".stock-table thead tr");
  thead.innerHTML = "";
  headerDefs.forEach((h, idx) => {
    const th = document.createElement("th");
    th.innerHTML = h.label + (h.key ? getSortIcon(h.key) : "");
    if (h.key) {
      th.classList.add("sortable");
      th.dataset.key = h.key;
      th.addEventListener("click", () => sortStocks(h.key));
    }
    thead.appendChild(th);
  });
}

function updateHeaderArrows() {
  const ths = document.querySelectorAll(".stock-table th");
  headerDefs.forEach((h, idx) => {
    if (!h.key) return;
    ths[idx].innerHTML = h.label + getSortIcon(h.key);
  });
}

// 정렬 함수
function sortStocks(key) {
  if (sortKey === key) {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortOrder = "desc";
  }
  filteredStocks.sort((a, b) => {
    const aData = realTimeData.get(a.code) || a;
    const bData = realTimeData.get(b.code) || b;

    if (aData[key] < bData[key]) return sortOrder === "asc" ? -1 : 1;
    if (aData[key] > bData[key]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
  updateHeaderArrows();
}

// 검색 및 마켓 선택 기능
const searchInput = document.getElementById("search");
const marketSelect = document.getElementById("market-select");

async function filterStocks() {
  const keyword = searchInput.value.trim();
  const market = marketSelect.value;
  // 한국투자증권 API 시장 코드: J(전체), W(코스피), K(코스닥)
  const marketCode = market === "KOSPI" ? "W" : market === "KOSDAQ" ? "K" : "J";

  // API에서 데이터 가져오기
  try {
    const stockCodes = stocks
      .filter(
        (s) =>
          s.market === market &&
          (s.name.includes(keyword) || s.code.includes(keyword))
      )
      .map((s) => s.code);

    if (stockCodes.length > 0) {
      const apiData = await fetchStockData(stockCodes, marketCode);
      filteredStocks = stocks.filter(
        (s) =>
          s.market === market &&
          (s.name.includes(keyword) || s.code.includes(keyword))
      );

      // 실시간 데이터 시작
      startRealTimeData(stockCodes);
    } else {
      filteredStocks = [];
    }
  } catch (error) {
    console.error("필터링 중 오류:", error);
    // API 실패시 mock 데이터 사용
    filteredStocks = stocks.filter(
      (s) =>
        s.market === market &&
        (s.name.includes(keyword) || s.code.includes(keyword))
    );
  }

  if (sortKey) {
    sortStocks(sortKey);
  } else {
    currentPage = 1;
    renderTable(filteredStocks.slice(0, PAGE_SIZE));
    updateHeaderArrows();
  }
}

searchInput.addEventListener("input", filterStocks);
marketSelect.addEventListener("change", filterStocks);

// 무한 스크롤 구현
const tbody = document.getElementById("stock-tbody");
const observerTarget = document.createElement("div");
tbody.parentNode.appendChild(observerTarget);

const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    loadMore();
  }
});
observer.observe(observerTarget);

function loadMore() {
  const total = filteredStocks.length;
  const nextPage = currentPage + 1;
  const start = currentPage * PAGE_SIZE;
  const end = nextPage * PAGE_SIZE;
  if (start >= total) return;
  renderTable(filteredStocks.slice(start, end), true);
  currentPage = nextPage;
}

// API 키 설정 UI 추가
function createApiKeySettings() {
  const settingsDiv = document.createElement("div");
  settingsDiv.className = "api-settings";
  settingsDiv.innerHTML = `
    <div class="settings-header">
      <h3>API 설정</h3>
      <button id="toggle-settings" class="btn-toggle">설정</button>
    </div>
    <div id="settings-content" class="settings-content" style="display: none;">
      <div class="form-group">
        <label for="app-key">APP KEY:</label>
        <input type="text" id="app-key" placeholder="한국투자증권 APP KEY 입력" value="${API_KEYS.APP_KEY}">
      </div>
      <div class="form-group">
        <label for="app-secret">APP SECRET:</label>
        <input type="password" id="app-secret" placeholder="한국투자증권 APP SECRET 입력" value="${API_KEYS.APP_SECRET}">
      </div>
      <button id="save-api-keys" class="btn-save">저장</button>
    </div>
  `;

  // DOM에 추가한 후 이벤트 리스너 설정
  setTimeout(() => {
    // 설정 토글
    const toggleBtn = document.getElementById("toggle-settings");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const content = document.getElementById("settings-content");
        if (content) {
          content.style.display =
            content.style.display === "none" ? "block" : "none";
        }
      });
    }

    // API 키 저장
    const saveBtn = document.getElementById("save-api-keys");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const appKey = document.getElementById("app-key")?.value;
        const appSecret = document.getElementById("app-secret")?.value;

        if (appKey && appSecret) {
          try {
            const response = await chrome.runtime.sendMessage({
              type: "UPDATE_API_KEYS",
              data: { APP_KEY: appKey, APP_SECRET: appSecret },
            });

            if (response && response.success) {
              alert("API 키가 저장되었습니다.");
              Object.assign(API_KEYS, {
                APP_KEY: appKey,
                APP_SECRET: appSecret,
              });
            } else {
              alert(
                "API 키 저장 실패: " + (response?.error || "알 수 없는 오류")
              );
            }
          } catch (error) {
            console.error("API 키 저장 오류:", error);
            if (error.message.includes("Receiving end does not exist")) {
              alert(
                "Background script가 로드되지 않았습니다. 확장 프로그램을 다시 로드해주세요."
              );
            } else {
              alert("API 키 저장 중 오류가 발생했습니다.");
            }
          }
        } else {
          alert("APP KEY와 APP SECRET을 모두 입력해주세요.");
        }
      });
    }
  }, 0);

  return settingsDiv;
}

// 초기 렌더링
async function initialRender() {
  renderTableHeader();

  // API 설정 UI 추가
  const container = document.querySelector(".popup-container");
  if (container) {
    const settingsDiv = createApiKeySettings();
    container.insertBefore(settingsDiv, container.firstChild);
  }

  // 초기 데이터 로드
  filteredStocks = stocks.filter((s) => s.market === marketSelect.value);
  currentPage = 1;
  renderTable(filteredStocks.slice(0, PAGE_SIZE));
  updateHeaderArrows();

  // 실시간 데이터 시작 (지연 실행)
  setTimeout(async () => {
    const initialStockCodes = filteredStocks.slice(0, 10).map((s) => s.code);
    if (initialStockCodes.length > 0) {
      await startRealTimeData(initialStockCodes);
    }
  }, 1000); // 1초 후 실행
}

// 페이지 언로드시 실시간 데이터 중지
window.addEventListener("beforeunload", () => {
  stopRealTimeData();
});

// 알림 표시 함수
function showNotification(message, type = "info") {
  // 기존 알림 제거
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
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

  if (type === "error") {
    notification.style.backgroundColor = "#d32f2f";
  } else if (type === "success") {
    notification.style.backgroundColor = "#2e7d32";
  } else {
    notification.style.backgroundColor = "#1976d2";
  }

  document.body.appendChild(notification);

  // 5초 후 자동 제거
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

initialRender();
