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

// Edge Function SSE 스트리밍 (fetch 기반 — Authorization 헤더 포함)
export const streamSummary = async (
  id: number,
  url: string,
  title: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: () => void,
): Promise<void> => {
  const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const params = new URLSearchParams({ url, title })

  try {
    const res = await fetch(`${base}/summarize/${id}?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${anonKey}`,
      },
    })

    if (!res.ok || !res.body) {
      onError()
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const chunk = line.slice(6)
        if (chunk === '[DONE]') {
          onDone()
          return
        }
        if (chunk === '[ERROR]') {
          onError()
          return
        }
        if (chunk) {
          // Edge Function에서 \n으로 이스케이프된 줄바꿈을 복원
          onChunk(chunk.replace(/\\n/g, '\n'))
        }
      }
    }
  } catch {
    onError()
  }
}
