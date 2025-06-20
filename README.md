# Stock View 크롬 익스텐션

## 소개

한국투자증권 API를 통해 실시간 주식 시세를 크롬 확장 프로그램 팝업에서 확인할 수 있습니다.

## 설치 방법

1. 이 저장소를 다운로드 또는 클론합니다.
2. 크롬 브라우저에서 chrome://extensions 접속
3. 우측 상단 '개발자 모드' 활성화
4. '압축해제된 확장 프로그램을 로드' 클릭 후 이 폴더 선택
5. 확장 프로그램 아이콘 클릭 시 팝업이 나타납니다.

## 개발 및 연동 가이드

- 초기에는 Mock 데이터로 동작합니다.
- 한국투자증권 API 연동 시 background.js에 WebSocket 또는 REST API 연동 코드를 추가하세요.
- API 키 발급 및 인증은 한국투자증권 개발자센터 참고
- 실시간 데이터는 background.js에서 받아 popup.js로 전달하는 구조로 개발하세요.

## 참고

- UI/UX는 css/style.css에서 수정 가능
- 검색, 마켓 선택 등 기능은 popup.js에서 구현

## api

https://apiportal.koreainvestment.com/apiservice-summary

## Chrome web store
