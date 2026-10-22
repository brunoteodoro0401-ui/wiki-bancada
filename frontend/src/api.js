import axios from 'axios'

export const TOKEN_KEY = 'bancada_token'
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Extrai uma mensagem legível de um erro do axios/FastAPI. */
export function errorMessage(err, fallback = 'Algo deu errado. Tente novamente.') {
  if (!err.response) return `Não foi possível conectar à API em ${API_BASE_URL}.`
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
  return fallback
}

export default api
