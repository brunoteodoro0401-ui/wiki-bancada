import { useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import EntityFormModal, { ghostBtn, primaryBtn } from '../components/EntityFormModal'
import ImportModal from '../components/ImportModal'

const SOURCE_FIELDS = [
  { name: 'nome', label: 'Nome da Fonte (ex: ClanGSM, Canal YouTube, iFixit)', required: true },
  { name: 'url_or_domain', label: 'Domínio ou Link (ex: clangsm.com.br, youtube.com/@canal)', required: true },
  { name: 'categoria', label: 'Categoria (ex: Fórum Técnico, Vídeo / Canal, Guia de Desmontagem)' },
  { name: 'ativo', label: 'Usar esta fonte nas pesquisas da IA', type: 'checkbox' },
]

export default function SourcesView() {
  const { isAdmin } = useAuth()
  const { items: sources, loading, error, reload } = useResource('/sources')
  const [editing, setEditing] = useState(null)
  const [importingFrom, setImportingFrom] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function save(values) {
    const payload = { ...values, categoria: values.categoria || null }
    if (editing.id) await api.put(`/sources/${editing.id}`, payload)
    else await api.post('/sources', payload)
    await reload()
  }

  async function toggleActive(src) {
    try {
      await api.put(`/sources/${src.id}`, {
        nome: src.nome,
        url_or_domain: src.url_or_domain,
        categoria: src.categoria,
        ativo: !src.ativo,
      })
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function remove(src) {
    if (!window.confirm(`Remover a fonte "${src.nome}"?`)) return
    try {
      await api.delete(`/sources/${src.id}`)
      setActionError(null)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Fontes de Pesquisa da IA</h2>
          <p className="text-sm text-slate-600">
            Sites especializados, fóruns, canais do YouTube e comunidades que a IA consulta quando busca soluções na internet.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setImportingFrom({ mode: 'search', query: '' })} className={ghostBtn}>
              🌐 Importar conteúdo agora
            </button>
            <button onClick={() => setEditing({ ativo: true })} className={primaryBtn}>
              + Nova fonte confiável
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-slate-500">Carregando...</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((src) => (
          <article
            key={src.id}
            className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition ${
              src.ativo ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100 opacity-70'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{src.nome}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    src.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {src.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              {src.categoria && (
                <p className="mt-1 text-xs font-medium text-blue-600">{src.categoria}</p>
              )}
              <p className="mt-2 break-all text-xs text-slate-500">{src.url_or_domain}</p>
            </div>

            {isAdmin && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  onClick={() =>
                    setImportingFrom({
                      mode: src.url_or_domain.includes('youtube') ? 'youtube' : 'search',
                      query: src.url_or_domain.includes('youtube') ? '' : `site:${src.url_or_domain} `,
                    })
                  }
                  className="font-medium text-blue-600 hover:underline"
                >
                  🔍 Extrair dicas desta fonte
                </button>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(src)} className="text-slate-600 hover:underline">
                    {src.ativo ? 'Pausar' : 'Ativar'}
                  </button>
                  <button onClick={() => setEditing(src)} className="text-slate-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => remove(src)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <EntityFormModal
          title={editing.id ? 'Editar fonte confiável' : 'Nova fonte confiável'}
          fields={SOURCE_FIELDS}
          initial={editing}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}

      {importingFrom && (
        <ImportModal
          initialMode={importingFrom.mode}
          initialQuery={importingFrom.query}
          onClose={() => setImportingFrom(null)}
        />
      )}
    </section>
  )
}
