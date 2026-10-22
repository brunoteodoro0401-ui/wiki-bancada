import { useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import { filterBySearch } from '../utils'
import ArticleCard from '../components/ArticleCard'
import EntityFormModal, { primaryBtn } from '../components/EntityFormModal'

const FIELDS = [
  { name: 'target_device', label: 'Aparelho (ex: iPhone 11, Samsung Geral)', required: true },
  { name: 'category', label: 'Categoria (ex: Procedimento, Alerta Químico)' },
  { name: 'ai_context_text', label: 'Dica técnica', type: 'textarea', required: true },
  { name: 'tags', label: 'Tags (separadas por vírgula)' },
]

const clean = (v) => ({ ...v, category: v.category || null, tags: v.tags || null })

export default function WikiView({ search }) {
  const { isAdmin } = useAuth()
  const { items, loading, error, reload } = useResource('/wiki_articles')
  const [editing, setEditing] = useState(null) // null | {} (novo) | artigo
  const [actionError, setActionError] = useState(null)

  const filtered = filterBySearch(items, search, ['target_device', 'category', 'ai_context_text', 'tags'])

  async function save(values) {
    if (editing.id) await api.put(`/wiki_articles/${editing.id}`, clean(values))
    else await api.post('/wiki_articles', clean(values))
    await reload()
  }

  async function remove(article) {
    if (!window.confirm(`Excluir a dica de "${article.target_device}"?`)) return
    try {
      await api.delete(`/wiki_articles/${article.id}`)
      setActionError(null)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Dicas de bancada</h2>
        {isAdmin && <button onClick={() => setEditing({})} className={primaryBtn}>+ Nova dica</button>}
      </div>
      {loading && <p className="text-slate-500">Carregando...</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {actionError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}
      {!loading && !error && filtered.length === 0 && <p className="text-slate-500">Nenhuma dica encontrada.</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <ArticleCard key={a.id} article={a} onEdit={isAdmin ? setEditing : undefined} onDelete={isAdmin ? remove : undefined} />
        ))}
      </div>
      {editing && (
        <EntityFormModal
          title={editing.id ? 'Editar dica' : 'Nova dica'}
          fields={FIELDS}
          initial={editing}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
