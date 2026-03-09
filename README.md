# 📰 NewsDigest — 뉴스 크롤링 & 램 가격 대시보드

> Google News RSS 크롤링 + Gemini AI 요약 + 다나와 RAM 최저가 수집을 하나의 대시보드에서 확인하는 풀스택 프로젝트

---

## 📌 주요 기능

| 기능 | 설명                                                  |
|---|-----------------------------------------------------|
| 📡 뉴스 자동 수집 | Google News RSS를 통해 키워드 기반 은행 뉴스를 수집 (오전 9시)        |
| 🤖 AI 요약 | Gemini API를 활용해 뉴스 기사를 5줄 HTML 요약으로 생성              |
| 💾 RAM 가격 수집 | Playwright로 다나와에서 삼성 RAM(DDR4/DDR5, 8~64GB) 최저가 크롤링 |
| 🖥️ 대시보드 UI | Vue 3 기반 SPA — 뉴스/램 탭 전환, 은행별 키워드 필터                |

---

## 🛠️ 기술 스택

### Backend
- **Java 25** / **Spring Boot 4.0.3**
- **MyBatis** — SQL Mapper 기반 DB 접근
- **Jsoup** — HTML 파싱
- **Playwright (Java)** — 동적 웹 크롤링 (다나와)
- **Google GenAI SDK** — Gemini 3 Flash 모델 호출
- **MySQL** — 뉴스 및 RAM 가격 데이터 저장

### Frontend
- **Vue 3** + **TypeScript** (Composition API)
- **Vite** — 빌드 도구
- **Vue Router**

---

## 🌐 API 명세

### 뉴스

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/news` | 키워드로 뉴스 목록 조회 |
| `GET` | `/api/news/summary/{id}` | 저장된 요약 조회 |
| `POST` | `/api/news/summary/generate` | Gemini AI 요약 생성 |

### RAM

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/api/rams` | RAM 가격 목록 조회 |

---

## 📅 스케줄러

뉴스 수집은 별도 API 호출 없이 **서버 실행 시 자동으로 동작**합니다.

```
매일 09:00 ~ 21:00, 3시간 간격으로 RSS 자동 수집
cron: "0 0 9 * * ?"
```

---