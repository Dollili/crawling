# NewsDigest Dashboard

Google News RSS와 삼성 RAM 가격 데이터를 Supabase에 수집하고, Vue 대시보드에서 조회하는 프로젝트입니다.

## 구성

### 프론트엔드
- Vue 3
- TypeScript
- Vite

### 백엔드 서비스
- Supabase Database
- Supabase Edge Functions
- Supabase Cron (`pg_cron`, `pg_net`)

## 주요 기능

- Google News RSS를 매일 수집하여 `newsproject.news` 테이블에 저장
- AI 요약을 생성하고 `newsproject.summary` 테이블에 캐시
- 삼성 RAM 가격을 매월 수집하여 `newsproject.ram_month` 테이블에 저장
- 뉴스 목록, 요약, RAM 가격 추이를 대시보드에서 조회

## Supabase Edge Functions

### `crawl-rss`
- Google News RSS에서 최대 30건을 수집합니다.
- 이미 저장된 `url`은 중복 저장하지 않습니다.

### `summarize`
- 저장된 요약이 있으면 캐시를 바로 반환합니다.
- 요약이 없으면 Gemini 응답을 스트리밍하고, 완료된 요약을 저장합니다.

### `crawl-rams`
- 삼성 RAM 월간 가격 데이터를 수집합니다.
- 같은 월, 같은 RAM 종류, 같은 용량 데이터가 이미 있으면 건너뜁니다.

## 스케줄

- `crawl-rss`: 매일 오전 9시(KST)
- `crawl-rams`: 매월 1일 오전 9시 5분(KST)

크론 등록 SQL은 `supabase/migrations/20240101000000_setup_cron.sql` 에서 관리합니다.

## 프론트 데이터 흐름

- 뉴스 목록과 저장된 요약은 Supabase에서 직접 조회합니다.
- 요약 생성은 `summarize` Edge Function을 호출합니다.
- RAM 차트 데이터는 `ram_month` 테이블에서 직접 조회합니다.

## 디렉터리

- `frontend`: Vue 프론트엔드
- `supabase`: Edge Functions, 마이그레이션, 크론 설정

## 참고

- 기존 `backend/` 디렉터리는 제거되었습니다.
