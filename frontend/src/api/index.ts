import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import router from '@/router'

// silent: true 플래그를 가진 요청은 인터셉터에서 라우팅 없이 에러를 그대로 throw
export interface SilentConfig extends InternalAxiosRequestConfig {
  silent?: boolean
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
})

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // TODO: 토큰 인증 추가 시 여기서 header에 삽입
    // const token = localStorage.getItem('token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const config = error.config as SilentConfig | undefined

    // silent 요청은 라우팅 없이 에러를 그대로 반환 (컴포넌트에서 직접 처리)
    if (config?.silent) {
      return Promise.reject(error)
    }

    const status = error.response?.status

    if (!error.response) {
      router.push('/network-error')
      return Promise.reject(error)
    }

    switch (status) {
      case 400:
        console.error('[API 400] 잘못된 요청:', error.response.data)
        break

      case 401:
        // 인증 만료 — TODO: 로그인 페이지 연동 시 주석 해제
        console.error('[API 401] 인증이 필요합니다.')
        // router.push('/login')
        break

      case 403:
        router.push('/403')
        break

      case 404:
        router.push('/404')
        break

      case 500:
      case 502:
      case 503:
        router.push('/500')
        break

      default:
        console.error(`[API ${status}] 알 수 없는 오류가 발생했습니다.`)
        break
    }

    return Promise.reject(error)
  },
)

export default apiClient
