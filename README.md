# StockPlus - 한국투자 Open API 기반 주식 시세 현황

한국투자 Open API를 활용한 Chrome 확장 프로그램으로, 실시간 주식 시세를 확인할 수 있습니다.

## 🚀 주요 기능

- **실시간 주식 시세**: 코스피/코스닥 상위 종목들의 실시간 시세 제공
- **서버 프록시 방식**: API 키를 중앙에서 관리하여 여러 사용자가 공유 사용 가능
- **즐겨찾기 기능**: 관심 종목을 즐겨찾기로 관리
- **검색 기능**: 종목명으로 실시간 검색
- **실시간 데이터**: WebSocket을 통한 실시간 가격 업데이트
- **반응형 UI**: 깔끔하고 직관적인 사용자 인터페이스

## 📋 시스템 요구사항

- **Chrome 브라우저** (최신 버전 권장)
- **Node.js** (서버 실행용, v16 이상 권장)
- **한국투자 Open API 계정** (API 키 발급 필요)

## 🛠️ 설치 및 설정

### 1. 서버 설정

#### 1-1. 서버 의존성 설치

```bash
cd server
npm install
```

#### 1-2. 환경변수 설정

```bash
# Windows
copy env.example .env

# Linux/Mac
cp env.example .env
```

`.env` 파일을 편집하여 다음 정보를 입력하세요:

```env
# 한국투자 Open API 설정
APP_KEY=your_app_key_here
APP_SECRET=your_app_secret_here
HTS_USER_ID=your_hts_user_id_here

# 서버 설정
PORT=3000
NODE_ENV=development

# CORS 설정 (Chrome Extension ID)
ALLOWED_ORIGINS=chrome-extension://your_extension_id_here

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 1-3. 서버 실행

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh

# 또는 직접 실행
npm start
```

### 2. Chrome 확장 프로그램 설치

#### 2-1. 개발자 모드 활성화

1. Chrome 브라우저에서 `chrome://extensions/` 접속
2. 우측 상단의 "개발자 모드" 토글 활성화

#### 2-2. 확장 프로그램 로드

1. "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭
2. 프로젝트 루트 폴더 선택

#### 2-3. 서버 URL 설정

프로덕션 배포 시 `js/background/config.js` 파일에서 서버 URL을 실제 서버 주소로 변경하세요:

```javascript
BASE_URL: "https://your-production-server.com";
```

## 🔧 사용 방법

### 기본 사용법

1. Chrome 확장 프로그램 아이콘 클릭
2. 마켓 선택 (코스피/코스닥)
3. 실시간 시세 확인
4. 종목명 클릭으로 즐겨찾기 추가/제거

### 검색 기능

- 검색창에 종목명 입력
- 실시간 검색 결과 확인
- 검색된 종목도 즐겨찾기 가능

### 즐겨찾기 관리

- 별 아이콘 클릭으로 즐겨찾기 추가/제거
- "즐겨찾기" 버튼으로 즐겨찾기 목록만 표시

## 🔒 보안 고려사항

### 서버 보안

- `.env` 파일을 절대 Git에 커밋하지 마세요
- 프로덕션에서는 HTTPS 사용 필수
- CORS 설정으로 허용된 확장 프로그램만 접근 가능
- Rate Limiting으로 API 남용 방지

### API 키 관리

- 한국투자 Open API 키는 서버에서만 관리
- 클라이언트에는 API 키가 노출되지 않음
- 토큰 자동 갱신으로 안정적인 서비스 제공

## 🚀 배포 가이드

### 서버 배포

#### Heroku 배포

```bash
# Heroku CLI 설치 후
heroku create your-app-name
heroku config:set APP_KEY=your_app_key
heroku config:set APP_SECRET=your_app_secret
heroku config:set HTS_USER_ID=your_hts_user_id
git push heroku main
```

#### Vercel 배포

```bash
# Vercel CLI 설치 후
vercel
# 환경변수는 Vercel 대시보드에서 설정
```

### Chrome 웹스토어 배포

1. 확장 프로그램 패키징
2. Chrome 웹스토어 개발자 계정 생성
3. 확장 프로그램 업로드
4. 심사 대기 및 승인

## 📊 API 엔드포인트

### 서버 API

- `GET /health` - 서버 상태 확인
- `GET /api/search-conditions` - 조건검색식 목록
- `GET /api/search-result?seq={seq}` - 조건검색 결과
- `GET /api/stock-price?stockCode={code}` - 단일 종목 시세
- `POST /api/stock-prices` - 다중 종목 시세
- `GET /api/approval-key` - 실시간 접속키
- `GET /api/token-status` - 토큰 상태

## 🔧 개발 가이드

### 프로젝트 구조

```
stock-view-chrome/
├── server/                 # 백엔드 서버
│   ├── services/          # API 서비스
│   ├── middleware/        # 미들웨어
│   └── server.js          # 메인 서버
├── js/
│   ├── background/        # 백그라운드 스크립트
│   └── popup/            # 팝업 UI
├── css/                   # 스타일시트
└── manifest.json          # 확장 프로그램 설정
```

### 개발 모드 실행

```bash
# 서버 (개발 모드)
cd server
npm run dev

# 확장 프로그램
# Chrome에서 개발자 모드로 로드
```

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 라이선스

MIT License

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

## 🔄 업데이트 로그

### v0.0.4 (현재)

- 서버 프록시 방식으로 변경
- API 키 중앙 관리
- 서버 연결 상태 표시
- 보안 강화

### v0.0.3

- 실시간 데이터 기능 추가
- 즐겨찾기 기능 개선
- UI/UX 개선

### v0.0.2

- 검색 기능 추가
- 마켓별 필터링
- 성능 최적화

### v0.0.1

- 초기 버전
- 기본 주식 시세 조회 기능
