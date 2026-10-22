import { useState } from 'react'
import Modal from './Modal'
import { useAuth } from '../auth'
import { errorMessage } from '../api'
import { ghostBtn, inputClass, primaryBtn } from './EntityFormModal'

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, senha)
      else await register(nome, email, senha)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'
  return (
    <Modal title={isLogin ? 'Entrar' : 'Criar conta'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="auth-nome" className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
            <input id="auth-nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
          <input id="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="auth-senha" className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
          <input id="auth-senha" type="password" required minLength={isLogin ? undefined : 8} value={senha} onChange={(e) => setSenha(e.target.value)} className={inputClass} />
          {!isLogin && <p className="mt-1 text-xs text-slate-500">Mínimo de 8 caracteres.</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(null) }} className="text-sm text-blue-600 hover:underline">
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button>
            <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
