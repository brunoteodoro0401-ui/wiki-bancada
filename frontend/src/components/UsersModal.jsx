import { useEffect, useState } from 'react'
import Modal from './Modal'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { ghostBtn } from './EntityFormModal'

export default function UsersModal({ onClose }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [requireApproval, setRequireApproval] = useState(false)
  const [savingSetting, setSavingSetting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/users/settings').catch(() => ({ data: { require_approval: false } })),
    ])
      .then(([usersRes, settingsRes]) => {
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
        setRequireApproval(Boolean(settingsRes?.data?.require_approval))
        setError(null)
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function toggleApprovalSetting() {
    const nextVal = !requireApproval
    setSavingSetting(true)
    setError(null)
    try {
      const res = await api.put('/users/settings', { require_approval: nextVal })
      setRequireApproval(Boolean(res.data?.require_approval))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingSetting(false)
    }
  }

  async function setRole(targetUser, nextRole) {
    setUpdatingId(targetUser.id)
    setError(null)
    try {
      const res = await api.put(`/users/${targetUser.id}/role`, { role: nextRole })
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.data : u)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeUser(targetUser) {
    if (!window.confirm(`Excluir permanentemente a conta de "${targetUser.nome}" (${targetUser.email})?`)) return
    setUpdatingId(targetUser.id)
    setError(null)
    try {
      await api.delete(`/users/${targetUser.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Modal title="👥 Equipe e Permissões" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Técnicos podem consultar a base, gerenciar O.S. e conversar com o Assistente de IA. Administradores gerenciam o catálogo e a equipe.
        </p>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-700 cursor-pointer">
          <span>🔒 Exigir aprovação do administrador para novos cadastros</span>
          <input
            type="checkbox"
            checked={requireApproval}
            disabled={savingSetting || loading}
            onChange={toggleApprovalSetting}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
        </label>

        {loading && <p className="text-sm text-slate-500">Carregando usuários...</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!loading && users.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {users.map((u) => {
              const isSelf = currentUser?.id === u.id
              const isBlocked = u.role === 'bloqueado'
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {u.nome}{' '}
                      {isSelf && <span className="text-xs font-normal text-slate-400">(você)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : isBlocked
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isBlocked ? 'Pendente / Bloqueado' : u.role}
                    </span>
                    {!isSelf && (
                      <>
                        {isBlocked ? (
                          <button
                            type="button"
                            disabled={updatingId === u.id}
                            onClick={() => setRole(u, 'tecnico')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {updatingId === u.id ? '...' : '✓ Aprovar técnico'}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={updatingId === u.id}
                              onClick={() => setRole(u, u.role === 'admin' ? 'tecnico' : 'admin')}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {updatingId === u.id
                                ? '...'
                                : u.role === 'admin'
                                  ? 'Tornar técnico'
                                  : 'Tornar admin'}
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === u.id}
                              onClick={() => setRole(u, 'bloqueado')}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Bloquear
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={updatingId === u.id}
                          onClick={() => removeUser(u)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  )
}
