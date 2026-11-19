import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { TOKEN_KEY } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Sem token salvo não há o que restaurar: já nasce pronto.
  const [ready, setReady] = useState(() => !localStorage.getItem(TOKEN_KEY))

  // Restaura a sessão se houver token salvo
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true))
  }, [])

  // Escuta expiração automática do token (HTTP 401) para atualizar a sessão
  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    }
    window.addEventListener('bancada:unauthorized', handleExpired)
    return () => window.removeEventListener('bancada:unauthorized', handleExpired)
  }, [])

  const login = useCallback(async (email, senha) => {
    const res = await api.post('/auth/login', { email, senha })
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    setUser(res.data.user)
  }, [])

  const register = useCallback(async (nome, email, senha) => {
    const res = await api.post('/auth/register', { nome, email, senha })
    if (res.data?.role === 'bloqueado') {
      return {
        pendingApproval: true,
        message: 'Cadastro realizado com sucesso! Sua conta está aguardando aprovação de um administrador.',
      }
    }
    await login(email, senha)
    return { pendingApproval: false }
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('bancada_checklists_history')
    sessionStorage.removeItem('bancada_chat_messages')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout, isAdmin: user?.role === 'admin' }),
    [user, ready, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
