import { useEffect, useState } from 'react'
import Modal from './Modal'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { ghostBtn } from './EntityFormModal'

export default function UsersModal({ onClose }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    api
      .get('/users')
      .then((res) => {
        setUsers(res.data)
        setError(null)
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function toggleRole(targetUser) {
    const nextRole = targetUser.role === 'admin' ? 'tecnico' : 'admin'
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

  return (
    <Modal title="👥 Equipe e Permissões" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Técnicos podem consultar a base e conversar com o Assistente de IA. Administradores podem criar, editar, importar dicas e configurar o servidor.
        </p>

        {loading && <p className="text-sm text-slate-500">Carregando usuários...</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!loading && users.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {users.map((u) => {
              const isSelf = currentUser?.id === u.id
              return (
                <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {u.nome}{' '}
                      {isSelf && <span className="text-xs font-normal text-slate-400">(você)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={updatingId === u.id}
                        onClick={() => toggleRole(u)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {updatingId === u.id
                          ? '...'
                          : u.role === 'admin'
                            ? 'Tornar técnico'
                            : 'Tornar admin'}
                      </button>
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
