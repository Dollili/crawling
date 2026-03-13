import { supabase } from '@/lib/supabase'

export interface NewsItem {
  id: number
  title: string
  media: string
  write_date_time: string
  url: string
  create_date_time: string
}

// 뉴스 목록 조회 (키워드 필터)
export const fetchNewsList = async (keyword: string): Promise<NewsItem[]> => {
  let query = supabase
    .from('news')
    .select('*')
    .order('write_date_time', { ascending: false })

  if (keyword) {
    if (keyword === 'BNK') {
      query = query.or('title.ilike.%BNK%,title.ilike.%부산은행%')
    } else {
      query = query.ilike('title', `%${keyword}%`)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// 요약 캐시 조회
export const fetchSummary = async (newsId: number): Promise<string | null> => {
  const { data, error } = await supabase
    .from('summary')
    .select('summary')
    .eq('news_id', newsId)
    .maybeSingle()

  if (error) throw error
  return data?.summary ?? null
}

// Edge Function SSE 스트리밍 URL 생성
export const getSummaryStreamUrl = (id: number, url: string, title: string): string => {
  const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string
  const params = new URLSearchParams({ url, title })
  return `${base}/summarize/${id}?${params}`
}
