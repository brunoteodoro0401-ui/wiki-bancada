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

const QUICK_WEB_SEARCHES = [
  'Tabela compatibilidade de telas Samsung linha Galaxy A e M',
  'Tabela de compatibilidade telas e baterias Xiaomi Redmi Note e Poco',
  'Compatibilidade de telas e flex de carga Motorola Moto G e Moto E',
  'Tabela de compatibilidade telas e baterias iPhone 11, 12, 13, 14 e 15',
]

function CompatImportModal({ onClose, onSaved }) {
  const [sourceType, setSourceType] = useState('search')
  const [content, setContent] = useState('')
  const [categoryHint, setCategoryHint] = useState('')
  const [trustedOnly, setTrustedOnly] = useState(false)
  const [autoSave, setAutoSave] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [editableItems, setEditableItems] = useState([])

  async function handleExtract(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        source_type: sourceType,
        content: content.trim(),
        category_hint: categoryHint || null,
        use_trusted_sources_only: trustedOnly,
        auto_save: autoSave,
      }
      const { data } = await api.post('/ingest_compatibilities', payload)
      setResult(data)
      setEditableItems(data.items || [])
      if (autoSave && data.saved_count > 0) {
        await onSaved()
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function updateItem(idx, field, value) {
    setEditableItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  function removeItem(idx) {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addEmptyRow() {
    setEditableItems((prev) => [
      ...prev,
      {
        part_nome: '',
        part_categoria: categoryHint || 'Display',
        marca: 'Samsung',
        modelo: '',
        notas: '',
      },
    ])
  }

  async function handleSaveAll() {
    const valid = editableItems.filter(
      (i) => i.part_nome?.trim() && i.modelo?.trim()
    )
    if (valid.length === 0) {
      setError('Preencha pelo menos o nome da peça e o modelo do aparelho.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data } = await api.post('/compatibilities/bulk_save', { items: valid })
      setResult((prev) => ({
        ...(prev || {}),
        saved_count: data.saved_count,
      }))
      await onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar e Importar Compatibilidades da Internet"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              🌐 Buscar e Importar Compatibilidades de Peças (Web + IA)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Pesquise na internet, cole uma tabela de fornecedor/fórum ou informe o link de um site/YouTube. O sistema extrai os pares (Peça + Aparelho + Notas) e cria automaticamente aparelhos, peças e vínculos no banco.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            ✕ Fechar
          </button>
        </div>

        <form onSubmit={handleExtract} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'search', label: '🔍 Busca na Web (DuckDuckGo + IA)' },
              { id: 'text', label: '📋 Colar Tabela / Lista de Fornecedor' },
              { id: 'url', label: '🌐 Link de Site / Blog Técnico' },
              { id: 'youtube', label: '▶️ Vídeo do YouTube' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceType(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  sourceType === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sourceType === 'search' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-900">
                ⚡ Sugestões rápidas de pesquisa na Web (clique para preencher):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_WEB_SEARCHES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setContent(q)}
                    className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              {sourceType === 'text' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Cole a lista ou tabela de compatibilidade (ex.: &quot;Tela A02s / A03 / A03s&quot;):
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={'Exemplo:\nGalaxy A14 5G = compatível com Galaxy M14 5G (versão M146B)\nRedmi Note 10 4G / Redmi Note 10S / Poco M5s\nMoto G22 / Moto E32 / Moto G32'}
                    className={inputClass}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {sourceType === 'search'
                      ? 'Termo de busca na internet:'
                      : sourceType === 'url'
                      ? 'URL da página com tabela de compatibilidade:'
                      : 'URL do vídeo do YouTube:'}
                  </label>
                  <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      sourceType === 'search'
                        ? 'Ex: tabela compatibilidade de telas samsung linha A e M'
                        : 'https://...'
                    }
                    className={inputClass}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Categoria da Peça (opcional):
              </label>
              <select
                value={categoryHint}
                onChange={(e) => setCategoryHint(e.target.value)}
                className={inputClass}
              >
                <option value="">Detectar automaticamente</option>
                <option value="Display">Display / Frontal</option>
                <option value="Bateria">Bateria</option>
                <option value="Subplaca">Subplaca / Conector</option>
                <option value="Flex">Flex / Biometria</option>
                <option value="Câmera">Câmera</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                Salvar direto no banco após extrair
              </label>
              {sourceType === 'search' && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={trustedOnly}
                    onChange={(e) => setTrustedOnly(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Priorizar apenas Fontes Confiáveis cadastradas
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={addEmptyRow}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                + Adicionar Linha Manual
              </button>
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? '🔎 Buscando e Extraindo...' : '🔎 Extrair Compatibilidades'}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-semibold">
              ✨ Extração concluída: {editableItems.length} vínculo(s) identificado(s).
              {result.saved_count > 0 && ` (${result.saved_count} gravado(s) no banco de dados!)`}
            </p>
            {result.source_references?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {result.source_references.map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-emerald-700"
                  >
                    🔗 {ref.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {editableItems.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                📋 Itens Extraídos para Importação ({editableItems.length})
              </h3>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAll}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Salvando no Banco...' : `💾 Salvar Todos no Banco (${editableItems.length})`}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-2">Peça / Grupo de Equivalência</th>
                    <th className="px-2.5 py-2">Categoria</th>
                    <th className="px-2.5 py-2">Marca</th>
                    <th className="px-2.5 py-2">Modelo Aparelho</th>
                    <th className="px-2.5 py-2">Notas Técnicas / Revisão</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editableItems.map((it, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.part_nome || ''}
                          onChange={(e) => updateItem(idx, 'part_nome', e.target.value)}
                          placeholder="Ex: Frontal Samsung A02s/A03s"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.part_categoria || ''}
                          onChange={(e) => updateItem(idx, 'part_categoria', e.target.value)}
                          placeholder="Display"
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.marca || ''}
                          onChange={(e) => updateItem(idx, 'marca', e.target.value)}
                          placeholder="Samsung"
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.modelo || ''}
                          onChange={(e) => updateItem(idx, 'modelo', e.target.value)}
                          placeholder="Galaxy A03s"
                          className="w-36 rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={it.notas || ''}
                          onChange={(e) => updateItem(idx, 'notas', e.target.value)}
                          placeholder="Cuidados / versão da placa"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700"
                          title="Remover linha"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PartsView({ search }) {
  const { isAdmin } = useAuth()
  const parts = useResource('/parts')
  const devices = useResource('/devices')
  const [deviceFilter, setDeviceFilter] = useState('')
  const compatPath = deviceFilter ? `/compatibilities?device_id=${deviceFilter}` : '/compatibilities'
  const compats = useResource(compatPath)

  const [editingPart, setEditingPart] = useState(null)
  const [editingCompat, setEditingCompat] = useState(null)
  const [showWebImport, setShowWebImport] = useState(false)
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

  async function reloadAllCatalog() {
    await Promise.all([parts.reload(), devices.reload(), compats.reload()])
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Compatibilidades ({filteredCompats.length})</h2>
            <p className="text-xs text-slate-500">
              Consulte telas, baterias e subplacas equivalentes entre diferentes modelos ou importe novas tabelas da internet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="compat-device" className="sr-only">Filtrar por aparelho</label>
            <select id="compat-device" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="">Todos os aparelhos ({devices.items.length})</option>
              {devices.items.map((d) => <option key={d.id} value={d.id}>{d.marca} {d.modelo}</option>)}
            </select>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowWebImport(true)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  🌐 Buscar na Internet (IA)
                </button>
                <button onClick={() => setEditingCompat({})} className={primaryBtn}>+ Compatibilidade</button>
              </>
            )}
          </div>
        </div>
        {compats.error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{compats.error}</p>}
        {!compats.loading && filteredCompats.length === 0 && <p className="text-slate-500">Nenhuma compatibilidade encontrada.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCompats.map((c) => (
            <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{c.part_nome}</h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {c.device_label}
                </span>
              </div>
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
          <h2 className="text-xl font-semibold text-slate-900">Peças ({filteredParts.length})</h2>
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
      {showWebImport && (
        <CompatImportModal
          onClose={() => setShowWebImport(false)}
          onSaved={reloadAllCatalog}
        />
      )}
    </div>
  )
}
