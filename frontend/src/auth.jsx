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

  const login = useCallback(async (email, senha) => {
    const res = await api.post('/auth/login', { email, senha })
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    setUser(res.data.user)
  }, [])

  const register = useCallback(async (nome, email, senha) => {
    await api.post('/auth/register', { nome, email, senha })
    await login(email, senha)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
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
