// 정렬 상태
let sortKey = null;
let sortOrder = "desc"; // 'asc' or 'desc'

// 무한 스크롤 관련
const PAGE_SIZE = 20;
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
  { label: "거래량", key: "volume" },
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
    return [];
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
    console.log("실시간 데이터 수신 (popup):", message.data); // 수신 데이터 로깅
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
  const row = document.querySelector(`tr[data-code='${stockCode}']`);
  if (!row) return;

  const data = realTimeData.get(stockCode);
  if (!data) return;

  const priceCell = row.querySelector("td:nth-child(2)");
  const changeCell = row.querySelector("td:nth-child(3)");
  const volumeCell = row.querySelector("td:nth-child(4)");

  // 클래스 업데이트
  const changeClass = getChangeClass(data.change_rate);
  priceCell.className = changeClass;
  changeCell.className = changeClass;

  // 가격 업데이트
  priceCell.textContent = formatNumber(data.price);

  // 전일대비 업데이트
  changeCell.innerHTML = `
    <div>${
      data.change_rate > 0 ? "+" : data.change_rate < 0 ? "-" : ""
    }${Math.abs(data.change_rate).toFixed(2)}%</div>
    <div class="sub">${
      data.change_price > 0 ? "+" : data.change_price < 0 ? "-" : ""
    }${formatNumber(Math.abs(data.change_price))}</div>
  `;

  // 거래량 업데이트
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
  if (!val || isNaN(val)) {
    return 0;
  }
  // 숫자를 문자열로 변환하고, 3자리마다 쉼표를 추가합니다.
  return Math.floor(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
  const keyword = searchInput.value.trim().toLowerCase();

  // 검색어가 없으면, 시가총액 순위로 다시 조회
  if (!keyword) {
    await filterByMarket();
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
        filteredStocks = response.data.map((d) => ({
          name: d.stck_shrn_iscd, // API 응답에 이름이 없으므로 코드를 사용
          code: d.stck_shrn_iscd,
          market: marketCode,
          price: parseFloat(d.stck_prpr) || 0,
          change_rate: parseFloat(d.prdy_ctrt) || 0,
          change_price: parseFloat(d.prdy_vrss) || 0,
          volume: parseFloat(d.acml_vol) || 0, // 개별 조회 응답에는 acml_vol이 없을 수 있음
        }));

        // 검색 결과에 한글 이름 매핑
        filteredStocks.forEach((stock) => {
          const match = matchedStocks.find((s) => s.code === stock.code);
          if (match) stock.name = match.name;
        });
      } else {
        filteredStocks = [];
        showNotification("검색 결과를 가져오는 데 실패했습니다.", "error");
      }
    } else {
      filteredStocks = [];
      showNotification("검색 결과가 없습니다.", "info");
    }

    currentPage = 1;
    renderTable(filteredStocks.slice(0, PAGE_SIZE));
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

function showLoading(show) {
  const loader = document.getElementById("loader");
  if (show) {
    loader.style.display = "flex";
  } else {
    loader.style.display = "none";
  }
}

async function filterByMarket() {
  const market = marketSelect.value;
  showLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_TOP_VOLUME_STOCKS",
      data: { marketCode: market },
    });

    if (response && response.success && Array.isArray(response.data)) {
      filteredStocks = response.data.map((d) => ({
        name: d.hts_kor_isnm,
        code: d.mksc_shrn_iscd,
        market: market,
        price: parseFloat(d.stck_prpr) || 0,
        change_rate: parseFloat(d.prdy_ctrt) || 0,
        change_price: parseFloat(d.prdy_vrss) || 0,
        volume: parseFloat(d.acml_vol) || 0,
      }));

      // 파싱된 첫 번째 종목 데이터 로깅
      if (filteredStocks.length > 0) {
        console.log("파싱 후 첫 번째 종목 데이터:", filteredStocks[0]);
      }

      const stockCodes = filteredStocks
        .filter((s) => s.code)
        .map((s) => s.code);
      if (stockCodes.length > 0) {
        startRealTimeData(stockCodes);
      }
    } else {
      console.error(
        "시가총액 상위 종목 조회 실패:",
        (response && response.error) || "데이터 형식이 올바르지 않습니다."
      );
      filteredStocks = [];
      showNotification("데이터를 불러오는 데 실패했습니다.", "error");
    }

    currentPage = 1;
    renderTable(filteredStocks.slice(0, PAGE_SIZE));
    updateHeaderArrows();
  } catch (error) {
    console.error("시가총액 상위 종목 조회 중 오류:", error);
    showNotification("데이터를 불러오는 중 오류가 발생했습니다.", "error");
  } finally {
    showLoading(false);
  }
}

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

  if (start >= total) {
    console.log("모든 데이터를 로드했습니다.");
    return;
  }

  console.log(
    `추가 데이터 로드: ${start + 1}~${Math.min(end, total)} / ${total}`
  );
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
  await filterByMarket(); // 사용자가 선택한 시장 기준으로 필터링
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

// 초기 렌더링 실행
document.addEventListener("DOMContentLoaded", () => {
  createApiKeySettings();
  initialRender();
  marketSelect.addEventListener("change", filterByMarket);
  searchInput.addEventListener("input", filterStocks);
  document.querySelector(".table-container").addEventListener("scroll", (e) => {
    if (
      e.target.scrollTop + e.target.clientHeight >=
      e.target.scrollHeight - 10
    ) {
      loadMore();
    }
  });
});
