-- pg_net, pg_cron 확장 활성화
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- app.settings에 값 저장 (SQL Editor에서 별도로 실행 필요)
-- alter database postgres set app.supabase_url = 'https://<your-project-id>.supabase.co';
-- alter database postgres set app.service_role_key = '<your-service-role-key>';

-- 기존 스케줄 제거 (재등록 시)
-- select cron.unschedule('crawl-rss-daily');

-- 매일 00:00 UTC (= 09:00 KST) crawl-rss Edge Function 호출
select cron.schedule(
  'crawl-rss-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/crawl-rss',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- 매월 1일 00:05 UTC (= 09:05 KST) crawl-rams Edge Function 호출
select cron.schedule(
  'crawl-rams-monthly',
  '5 0 1 * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/crawl-rams',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
