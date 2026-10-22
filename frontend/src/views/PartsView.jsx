import { useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import { filterBySearch } from '../utils'
import EntityFormModal, { inputClass, primaryBtn } from '../components/EntityFormModal'

const PART_FIELDS = [
  { name: 'nome', label: 'Nome da peça', required: true },
  { name: 'categoria', label: 'Categoria (ex: Display, Bateria, Flex)' },
]

export default function PartsView({ search }) {
  const { isAdmin } = useAuth()
  const parts = useResource('/parts')
  const devices = useResource('/devices')
  const [deviceFilter, setDeviceFilter] = useState('')
  const compatPath = deviceFilter ? `/compatibilities?device_id=${deviceFilter}` : '/compatibilities'
  const compats = useResource(compatPath)

  const [editingPart, setEditingPart] = useState(null)
  const [editingCompat, setEditingCompat] = useState(null)
  const [actionError, setActionError] = useState(null)

  const filteredParts = filterBySearch(parts.items, search, ['nome', 'categoria'])
  const filteredCompats = filterBySearch(compats.items, search, ['device_label', 'part_nome', 'notas'])

  const compatFields = [
    {
      name: 'device_id', label: 'Aparelho', type: 'select', required: true,
      options: [{ value: '', label: 'Selecione...' }, ...devices.items.map((d) => ({ value: d.id, label: `${d.marca} ${d.modelo}` }))],
    },
    {
      name: 'part_id', label: 'Peça', type: 'select', required: true,
      options: [{ value: '', label: 'Selecione...' }, ...parts.items.map((p) => ({ value: p.id, label: p.nome }))],
    },
    { name: 'notas', label: 'Notas (ex: cuidados na instalação/ativação)', type: 'textarea' },
  ]

  async function savePart(values) {
    const body = { ...values, categoria: values.categoria || null }
    if (editingPart.id) await api.put(`/parts/${editingPart.id}`, body)
    else await api.post('/parts', body)
    await Promise.all([parts.reload(), compats.reload()])
  }

  async function saveCompat(values) {
    const body = { device_id: Number(values.device_id), part_id: Number(values.part_id), notas: values.notas || null }
    if (editingCompat.id) await api.put(`/compatibilities/${editingCompat.id}`, body)
    else await api.post('/compatibilities', body)
    await compats.reload()
  }

  async function remove(path, label, reloaders) {
    if (!window.confirm(`Excluir ${label}?`)) return
    try {
      await api.delete(path)
      setActionError(null)
      await Promise.all(reloaders.map((r) => r()))
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-10">
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Compatibilidades</h2>
          <div className="flex items-center gap-3">
            <label htmlFor="compat-device" className="sr-only">Filtrar por aparelho</label>
            <select id="compat-device" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="">Todos os aparelhos</option>
              {devices.items.map((d) => <option key={d.id} value={d.id}>{d.marca} {d.modelo}</option>)}
            </select>
            {isAdmin && <button onClick={() => setEditingCompat({})} className={primaryBtn}>+ Compatibilidade</button>}
          </div>
        </div>
        {compats.error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{compats.error}</p>}
        {!compats.loading && filteredCompats.length === 0 && <p className="text-slate-500">Nenhuma compatibilidade encontrada.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCompats.map((c) => (
            <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">{c.part_nome}</h3>
              <p className="text-sm text-slate-500">{c.device_label}</p>
              {c.notas && <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.notas}</p>}
              {isAdmin && (
                <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-sm">
                  <button onClick={() => setEditingCompat(c)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => remove(`/compatibilities/${c.id}`, 'esta compatibilidade', [compats.reload])} className="text-red-600 hover:underline">Excluir</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Peças</h2>
          {isAdmin && <button onClick={() => setEditingPart({})} className={primaryBtn}>+ Nova peça</button>}
        </div>
        {parts.error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{parts.error}</p>}
        {!parts.loading && filteredParts.length === 0 && <p className="text-slate-500">Nenhuma peça encontrada.</p>}
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filteredParts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <span className="font-medium text-slate-900">{p.nome}</span>
                {p.categoria && <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{p.categoria}</span>}
              </div>
              {isAdmin && (
                <div className="flex gap-3 text-sm">
                  <button onClick={() => setEditingPart(p)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => remove(`/parts/${p.id}`, `a peça "${p.nome}" (e suas compatibilidades)`, [parts.reload, compats.reload])} className="text-red-600 hover:underline">Excluir</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {editingPart && (
        <EntityFormModal title={editingPart.id ? 'Editar peça' : 'Nova peça'} fields={PART_FIELDS} initial={editingPart} onSubmit={savePart} onClose={() => setEditingPart(null)} />
      )}
      {editingCompat && (
        <EntityFormModal title={editingCompat.id ? 'Editar compatibilidade' : 'Nova compatibilidade'} fields={compatFields} initial={editingCompat} onSubmit={saveCompat} onClose={() => setEditingCompat(null)} />
      )}
    </div>
  )
}
