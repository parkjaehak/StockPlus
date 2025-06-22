// js/stockSymbols.js

// KOSPI, KOSDAQ 주요 종목 목록 (이름-코드 매핑)
// 실제 운영 환경에서는 이 목록을 서버에서 받아오거나,
// 크롬 확장 프로그램에 전체 종목 파일을 내장해야 합니다.

export const stockSymbols = {
  KOSPI: [
    { name: "삼성전자", code: "005930" },
    { name: "SK하이닉스", code: "000660" },
    { name: "LG에너지솔루션", code: "373220" },
    { name: "삼성바이오로직스", code: "207940" },
    { name: "현대차", code: "005380" },
    { name: "기아", code: "000270" },
    { name: "셀트리온", code: "068270" },
    { name: "POSCO홀딩스", code: "005490" },
    { name: "NAVER", code: "035420" },
    { name: "LG화학", code: "051910" },
    { name: "삼성물산", code: "028260" },
    { name: "삼성SDI", code: "006400" },
    { name: "KB금융", code: "105560" },
    { name: "신한지주", code: "055550" },
    { name: "카카오", code: "035720" },
    { name: "현대모비스", code: "012330" },
    { name: "삼성생명", code: "032830" },
    { name: "하나금융지주", code: "086790" },
    { name: "SK이노베이션", code: "096770" },
    { name: "LG전자", code: "066570" },
    // ... (더 많은 KOSPI 종목)
  ],
  KOSDAQ: [
    { name: "에코프로비엠", code: "247540" },
    { name: "에코프로", code: "086520" },
    { name: "셀트리온헬스케어", code: "091990" },
    { name: "엘앤에프", code: "066970" },
    { name: "HLB", code: "028300" },
    { name: "카카오게임즈", code: "293490" },
    { name: "펄어비스", code: "263750" },
    { name: "JYP Ent.", code: "035900" },
    { name: "에스엠", code: "041510" },
    { name: "레인보우로보틱스", code: "277810" },
    { name: "리노공업", code: "058470" },
    { name: "클래시스", code: "214150" },
    { name: "알테오젠", code: "196170" },
    { name: "HPSP", code: "403870" },
    { name: "포스코DX", code: "022100" },
    { name: "루닛", code: "328130" },
    { name: "케어젠", code: "214370" },
    { name: "파마리서치", code: "214450" },
    { name: "솔브레인", code: "357780" },
    { name: "원익IPS", code: "240810" },
    // ... (더 많은 KOSDAQ 종목)
  ],
};
