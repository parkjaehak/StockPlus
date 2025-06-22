# StockPlus - 한국투자 Open API 기반 주식 시세 현황

## 소개

한국투자증권 Open API를 통해 실시간 주식 시세를 크롬 확장 프로그램 팝업에서 확인할 수 있습니다. 실시간 데이터 업데이트, 정렬, 검색, 무한 스크롤 등의 기능을 제공합니다.

## 주요 기능

- 🔴 **실시간 주식 시세**: 한국투자증권 Open API 연동
- 📊 **실시간 데이터 업데이트**: WebSocket을 통한 실시간 가격 변동
- 🔍 **종목 검색**: 종목명 또는 종목코드로 검색
- 📈 **마켓별 필터링**: KOSPI, KOSDAQ 선택
- ⬆️ **컬럼별 정렬**: 현재가, 전일대비, 거래대금 기준 정렬
- 📜 **무한 스크롤**: 페이지네이션 없이 스크롤로 데이터 로드
- 🔐 **공통 API 키**: 개발자가 제공하는 공통 API 키 사용

## 설치 방법

1. 이 저장소를 다운로드 또는 클론합니다.
2. 크롬 브라우저에서 `chrome://extensions` 접속
3. 우측 상단 '개발자 모드' 활성화
4. '압축해제된 확장 프로그램을 로드' 클릭 후 이 폴더 선택
5. 확장 프로그램 아이콘 클릭 시 팝업이 나타납니다.

## 🔐 API 키 설정

### ⚠️ 중요: API 키 보안

- **API 키는 절대 Git에 커밋하지 마세요!**
- `js/background/env.js` 파일이 `.gitignore`에 포함되어 있습니다
- 실제 API 키가 포함된 파일은 Git에 올라가지 않습니다

### 설정 방법

1. **예시 파일 복사**:

   ```bash
   cp js/background/env.example.js js/background/env.js
   ```

2. **API 키 입력**:
   `js/background/env.js` 파일을 열고 실제 API 키를 입력하세요:

   ```javascript
   export const ENV_CONFIG = {
     APP_KEY: "YOUR_ACTUAL_APP_KEY_HERE",
     APP_SECRET: "YOUR_ACTUAL_APP_SECRET_HERE",
   };
   ```

3. **API 키 발급**:

   - [한국투자증권 개발자센터](https://apiportal.koreainvestment.com/) 접속
   - 회원가입 및 로그인
   - "Open API 신청" 메뉴에서 API 신청
   - APP KEY와 APP SECRET 발급

4. **실시간 API 권한 설정**:
   - 개발자센터에서 실시간 API 신청 및 승인 절차 진행

### 파일 구조 설명

- **`env.js`**: 실제 API 키와 시크릿 (Git 제외)
- **`env.example.js`**: API 키 설정 예시 (Git 포함)
- **`config.js`**: API 설정 및 엔드포인트 (Git 포함, env.js에서 키를 가져옴)

## 프로젝트 구조

```
stock-view-chrome/
├── manifest.json                    # 확장 프로그램 설정
├── popup.html                      # 팝업 UI
├── js/
│   ├── background/
│   │   ├── background.js           # 백그라운드 서비스 워커 (메인 진입점)
│   │   ├── config.js               # API 설정 및 엔드포인트 (Git 포함)
│   │   ├── env.js                  # API 키 설정 (Git 제외)
│   │   ├── env.example.js          # API 키 설정 예시
│   │   ├── tokenManager.js         # 토큰 및 승인키 관리
│   │   ├── apiService.js           # API 호출 서비스
│   │   ├── realTimeManager.js      # 실시간 데이터 관리
│   │   └── messageHandler.js       # 메시지 처리
│   └── popup/
│       ├── popup.js                # 팝업 메인 로직
│       ├── uiManager.js            # UI 관리 및 렌더링
│       ├── dataManager.js          # 데이터 관리 및 API 호출
│       └── stockSymbols.js         # 주식 심볼 데이터
├── css/
│   └── style.css                   # 스타일시트
├── .gitignore                      # Git 제외 파일 설정
└── README.md
```

## 모듈별 역할

### 📁 js/config.js

- API 설정 정보 (개발자 공통 키)
- API 엔드포인트 정의
- Git에서 제외되어 보안 유지

### 📁 js/tokenManager.js

- API 접근 토큰 발급 및 관리
- 실시간 데이터용 승인키 관리
- 토큰 만료 시간 추적 및 자동 갱신

### 📁 js/apiService.js

- REST API 호출을 통한 주식 데이터 조회
- API 응답 처리 및 에러 핸들링
- Rate limiting 적용

### 📁 js/realTimeManager.js

- WebSocket 연결 관리 및 재연결 처리
- 실시간 주식 데이터 구독/구독 해제
- 실시간 데이터 파싱 및 변환

### 📁 js/messageHandler.js

- Chrome Extension 메시지 처리 및 라우팅
- 각 메시지 타입별 적절한 서비스 호출
- 응답 데이터 포맷팅 및 에러 처리

## API 연동 구조

### 1. REST API (현재가 조회)

- **엔드포인트**: `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price`
- **인증**: OAuth 2.0 Bearer Token
- **용도**: 초기 데이터 로드, 주기적 업데이트

### 2. WebSocket (실시간 데이터)

- **엔드포인트**: `ws://ops.koreainvestment.com:21000`
- **용도**: 실시간 가격 변동 수신
- **구독**: 관심 종목 실시간 구독

### 3. 데이터 흐름

```
팝업 → background.js → messageHandler.js → 각 서비스 → API/WebSocket
```

## 개발 가이드

### API 설정 수정

`js/config.js`에서 API 설정을 수정할 수 있습니다:

```javascript
export const API_CONFIG = {
  APP_KEY: "YOUR_APP_KEY_HERE",
  APP_SECRET: "YOUR_APP_SECRET_HERE",
  BASE_URL: "https://openapi.koreainvestment.com:9443",
  WS_URL: "ws://ops.koreainvestment.com:21000",
};
```

### 새로운 기능 추가

1. 필요한 모듈에 기능 추가
2. `messageHandler.js`에 메시지 핸들러 추가
3. `popup.js`에 UI 로직 추가
4. `css/style.css`에 스타일 추가

### 모듈 구조의 장점

- **관심사 분리**: 각 모듈이 하나의 책임만 담당
- **유지보수성**: 특정 기능 수정 시 해당 모듈만 수정
- **테스트 용이성**: 각 모듈을 독립적으로 테스트 가능
- **재사용성**: 모듈을 다른 프로젝트에서도 사용 가능
- **사용자 편의성**: 별도 설정 없이 즉시 사용 가능

### 에러 처리

- API 호출 실패시 Mock 데이터로 자동 전환
- 네트워크 오류시 사용자에게 알림
- 실시간 연결 끊김시 자동 재연결 시도

## 보안 주의사항

1. **API 키 보안**:

   - `js/config.js` 파일이 `.gitignore`에 포함되어 Git에 올라가지 않음
   - 개발자만 API 키를 관리하고 사용자들은 공통 키 사용

2. **API 호출 제한**: 한국투자증권 API는 호출 횟수 제한이 있습니다.
3. **실시간 데이터**: 실시간 데이터는 거래시간에만 제공됩니다.
4. **개발자 모드**: 개발 중에는 크롬 개발자 모드가 필요합니다.

## 참고 자료

- [한국투자증권 Open API 가이드](https://apiportal.koreainvestment.com/apiservice-summary)
- [Chrome Extension 개발 가이드](https://developer.chrome.com/docs/extensions/)
- [WebSocket API 문서](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
