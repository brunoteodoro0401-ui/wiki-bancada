import { useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import { filterBySearch } from '../utils'
import EntityFormModal, { primaryBtn } from '../components/EntityFormModal'

const FIELDS = [
  { name: 'marca', label: 'Marca', required: true },
  { name: 'modelo', label: 'Modelo', required: true },
  {
    name: 'opening_method',
    label: 'Método de abertura',
    type: 'select',
    options: [
      { value: '', label: 'Não informado' },
      { value: 'Frontal', label: 'Frontal (pela tela)' },
      { value: 'Traseira', label: 'Traseira (pela tampa)' },
    ],
  },
  { name: 'has_flex_cable', label: 'Possui cabo flex sensível na abertura', type: 'checkbox' },
]

export function DeviceCard({ device, onEdit, onDelete }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{device.marca}</p>
        <h3 className="text-lg font-semibold text-slate-900">{device.modelo}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {device.opening_method ? (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Abertura {device.opening_method}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Abertura não informada</span>
        )}
      </div>
      {device.has_flex_cable && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Cuidado com o cabo flex ao abrir: desconecte com cuidado antes de separar as partes.
        </p>
      )}
      {(onEdit || onDelete) && (
        <div className="mt-auto flex gap-3 border-t border-slate-100 pt-3 text-sm">
          {onEdit && <button onClick={() => onEdit(device)} className="text-blue-600 hover:underline">Editar</button>}
          {onDelete && <button onClick={() => onDelete(device)} className="text-red-600 hover:underline">Excluir</button>}
        </div>
      )}
    </article>
  )
}

export default function DevicesView({ search }) {
  const { isAdmin } = useAuth()
  const { items, loading, error, reload } = useResource('/devices')
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)

  const filtered = filterBySearch(items, search, ['marca', 'modelo', 'opening_method'])

  async function save(values) {
    const body = { ...values, opening_method: values.opening_method || null }
    if (editing.id) await api.put(`/devices/${editing.id}`, body)
    else await api.post('/devices', body)
    await reload()
  }

  async function remove(device) {
    if (!window.confirm(`Excluir ${device.marca} ${device.modelo}? As compatibilidades dele também serão removidas.`)) return
    try {
      await api.delete(`/devices/${device.id}`)
      setActionError(null)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Aparelhos</h2>
        {isAdmin && <button onClick={() => setEditing({})} className={primaryBtn}>+ Novo aparelho</button>}
      </div>
      {loading && <p className="text-slate-500">Carregando...</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {actionError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}
      {!loading && !error && filtered.length === 0 && <p className="text-slate-500">Nenhum aparelho encontrado.</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => (
          <DeviceCard key={d.id} device={d} onEdit={isAdmin ? setEditing : undefined} onDelete={isAdmin ? remove : undefined} />
        ))}
      </div>
      {editing && (
        <EntityFormModal
          title={editing.id ? 'Editar aparelho' : 'Novo aparelho'}
          fields={FIELDS}
          initial={editing}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
