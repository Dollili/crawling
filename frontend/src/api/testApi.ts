import apiClient from './index'

export const fetchTestMessage = async (): Promise<string> => {
  const response = await apiClient.get<string>('/api/test')
  return response.data
}
