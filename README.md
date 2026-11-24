# 스마트비즈 계산기 (smart-biz-calc)

사장님·실무자를 위한 무료 계산기 3종. 정적 HTML/CSS/JS로 만들었고 빌드 도구가 필요 없습니다.

**라이브 사이트:** https://k77070888-netizen.github.io/smart-biz-calc/

## 계산기

| 페이지 | 설명 |
| --- | --- |
| `index.html` | 허브 홈 |
| `margin.html` | 온라인 셀러 마진·수수료 계산기 (마켓 프리셋, 배송비, 과세/간이/면세, 순이익·마진율·ROI·손익분기 판매가) |
| `tax.html` | 부가세·원천세 계산기 (공급가액↔합계금액 역산, 일반과세 납부세액, 간이과세 부가가치율, 3.3% 원천징수) |
| `material.html` | 건축·인테리어 자재 소요량 계산기 (평↔㎡, 타일, 페인트, 도배지) |
| `templates.html` | 사장님 자동화 엑셀 템플릿 2종 소개 (마진·정산 장부, 부가세·원천징수 장부) |
| `about.html` | 사이트 소개 |
| `privacy.html` | 개인정보처리방침 |

보조 파일: `sitemap.xml`, `robots.txt`, `404.html`, `assets/`

## 제휴 링크 설정

계산기 하단의 부자재 추천 카드와 템플릿 구매 버튼은 `assets/js/affiliate.js` 한 곳에서 관리합니다. `url` 값이 비어 있으면 ‘준비 중’ 카드로 표시되고, 링크를 채우면 바로 구매 링크로 바뀝니다. (HTML 수정 불필요)

## 특징

- 모바일 우선 반응형, Pretendard 웹폰트 + 시스템 폰트 폴백
- 입력 즉시 계산(실시간), 원화 천 단위 콤마
- 모든 계산은 브라우저 안에서만 수행 — 입력값을 서버로 보내지 않음
- 각 계산기 하단에 계산 공식·활용 팁·FAQ 수록
- SEO 메타태그, Open Graph, JSON-LD(WebApplication/FAQPage)

## 로컬에서 보기

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## 계산 로직 테스트

```bash
node test/calc.test.js          # 브라우저/Node 환경
python3 test/logic-check.py     # Node 없는 환경 (quickjs)
python3 test/affiliate-check.py # 제휴 카드 렌더링 (준비 중 / 링크 연결)
```

## 배포

`main` 브랜치 루트를 GitHub Pages 소스로 사용합니다. 파일을 푸시하면 1분 안에 반영됩니다.

## 고지

계산 결과는 참고용 추정치입니다. 마켓 수수료율, 세액, 자재 소요량은 실제 조건과 차이가 있을 수 있으며, 세무·회계 신고는 전문가 확인을 권장합니다.
