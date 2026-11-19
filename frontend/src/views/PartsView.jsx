import { useEffect, useMemo, useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import { buildPartGroups, formatDeviceLabel, linkMatchesTerms, normalize, searchPartGroups, searchTerms } from '../utils'
import EntityFormModal, { ghostBtn, inputClass, primaryBtn } from '../components/EntityFormModal'

const PART_FIELDS = [
  { name: 'nome', label: 'Nome da peça', required: true },
  { name: 'categoria', label: 'Categoria (ex: Display, Bateria, Flex)' },
  { name: 'part_code', label: 'Código da peça / SKU (ex: EB-BA546ABY, JK50)' },
  { name: 'quality_tier', label: 'Qualidade / Versão (ex: Original, AMOLED, Sem Aro)' },
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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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

export default function PartsView() {
  const { isAdmin } = useAuth()
  const parts = useResource('/parts')
  const devices = useResource('/devices')
  const compats = useResource('/compatibilities')

  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [expanded, setExpanded] = useState({})
  const [managing, setManaging] = useState({})
  const [editingPart, setEditingPart] = useState(null)
  const [editingCompat, setEditingCompat] = useState(null)
  const [showWebImport, setShowWebImport] = useState(false)
  const [actionError, setActionError] = useState(null)

  const groups = useMemo(
    () => buildPartGroups(parts.items, compats.items, devices.items),
    [parts.items, compats.items, devices.items],
  )
  const brandOptions = useMemo(
    () =>
      [...new Set([...groups.flatMap((g) => g.brands), ...devices.items.map((d) => d.marca).filter(Boolean)])].sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [groups, devices.items],
  )
  const categoryOptions = useMemo(
    () => [...new Set(groups.map((g) => g.categoria).filter(Boolean))].sort(),
    [groups],
  )
  const terms = searchTerms(query)
  const results = useMemo(
    () => searchPartGroups(groups, query, { brand, category }),
    [groups, query, brand, category],
  )
  const compatCountByDevice = useMemo(() => {
    const map = new Map()
    for (const c of compats.items) {
      map.set(c.device_id, (map.get(c.device_id) || 0) + 1)
    }
    return map
  }, [compats.items])
  const matchedDevices = useMemo(() => {
    if ((!terms.length && !brand) || category) return []
    return devices.items.filter((d) => {
      if (brand && (d.marca || '').toLowerCase() !== brand.toLowerCase()) return false
      if (terms.length === 0) return true
      const fullLabel = normalize(
        [formatDeviceLabel(d.marca, d.modelo), d.model_code].filter(Boolean).join(' '),
      )
      return terms.every((t) => fullLabel.includes(t))
    })
  }, [devices.items, terms, brand, category])
  const [showAllMatchedDevices, setShowAllMatchedDevices] = useState(false)
  const loading = parts.loading || compats.loading || devices.loading
  const hasFilters = Boolean(query || brand || category)

  const compatFields = [
    {
      name: 'device_id', label: 'Aparelho', type: 'select', required: true,
      options: [{ value: '', label: 'Selecione...' }, ...devices.items.map((d) => ({ value: d.id, label: formatDeviceLabel(d.marca, d.modelo) }))],
    },
    {
      name: 'part_id', label: 'Peça', type: 'select', required: true,
      options: [{ value: '', label: 'Selecione...' }, ...parts.items.map((p) => ({ value: p.id, label: p.nome }))],
    },
    {
      name: 'compatibility_type',
      label: 'Tipo de compatibilidade',
      type: 'select',
      options: [
        { value: 'Direta', label: 'Direta (compatível)' },
        { value: 'Com Adaptação', label: 'Com Adaptação' },
        { value: 'Incompatível', label: '⛔ Incompatível (alerta)' },
      ],
    },
    { name: 'notas', label: 'Notas (ex: cuidados na instalação/ativação)', type: 'textarea' },
  ]

  async function savePart(values) {
    const body = {
      ...values,
      categoria: values.categoria || null,
      part_code: values.part_code || null,
      quality_tier: values.quality_tier || null,
    }
    if (editingPart.id) await api.put(`/parts/${editingPart.id}`, body)
    else await api.post('/parts', body)
    await Promise.all([parts.reload(), compats.reload()])
  }

  async function saveCompat(values) {
    const body = {
      device_id: Number(values.device_id),
      part_id: Number(values.part_id),
      compatibility_type: values.compatibility_type || 'Direta',
      notas: values.notas || null,
    }
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

  function clearFilters() {
    setQuery('')
    setBrand('')
    setCategory('')
    setShowAllMatchedDevices(false)
  }

  const chipBase = 'rounded-full border px-3 py-1 text-xs font-medium transition'
  const chipOn = 'border-blue-600 bg-blue-600 text-white'
  const chipOff = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className="space-y-6">
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Peças e Compatibilidade</h2>
            <p className="text-sm text-slate-500">
              Digite o nome ou código da peça (ex.: <em>EB-BA505ABU</em>, <em>bateria JK50</em>) ou o modelo do aparelho
              (ex.: <em>Galaxy A12</em>) e veja tudo que é compatível.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowWebImport(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                🌐 Buscar na Internet (IA)
              </button>
              <button onClick={() => setEditingCompat({ compatibility_type: 'Direta' })} className={ghostBtn}>+ Compatibilidade</button>
              <button onClick={() => setEditingPart({})} className={primaryBtn}>+ Nova peça</button>
            </div>
          )}
        </div>

        <div className="relative">
          <label htmlFor="parts-search" className="sr-only">Buscar peça ou modelo</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            id="parts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar peça, código ou modelo… ex.: bateria EB-BA505ABU, tela A12, Poco X3"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por marca">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Marca</span>
            <button type="button" onClick={() => setBrand('')} className={`${chipBase} ${brand === '' ? chipOn : chipOff}`}>Todas</button>
            {brandOptions.map((b) => (
              <button key={b} type="button" onClick={() => setBrand(brand === b ? '' : b)} className={`${chipBase} ${brand === b ? chipOn : chipOff}`}>
                {b}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de peça">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</span>
            <button type="button" onClick={() => setCategory('')} className={`${chipBase} ${category === '' ? chipOn : chipOff}`}>Todos</button>
            {categoryOptions.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(category === c ? '' : c)} className={`${chipBase} ${category === c ? chipOn : chipOff}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500" aria-live="polite">
          <span>
            {loading
              ? 'Carregando...'
              : `${results.length} peça(s)${hasFilters ? ` de ${groups.length}` : ''}${matchedDevices.length > 0 ? ` • ${matchedDevices.length} aparelho(s) no catálogo` : ''}`}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="font-medium text-blue-600 hover:underline">
              Limpar busca e filtros
            </button>
          )}
        </div>
      </section>

      {(parts.error || compats.error || devices.error) && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">{parts.error || compats.error || devices.error}</p>
      )}
      {!loading && results.length === 0 && matchedDevices.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nenhuma peça encontrada{query ? ` para "${query}"` : ''}. Tente outro nome, código ou modelo.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map((g) => {
          const LIMIT = 24
          const isOpen = expanded[g.id] || terms.length > 0
          const shown = isOpen ? g.links : g.links.slice(0, LIMIT)
          const hidden = g.links.length - shown.length
          const individualNotes = g.sharedNote ? [] : g.links.filter((l) => l.notas)
          return (
            <article key={g.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold leading-snug text-slate-900">{g.nome}</h3>
                  {(g.part_code || g.quality_tier) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.part_code && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                          SKU: {g.part_code}
                        </span>
                      )}
                      {g.quality_tier && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                          {g.quality_tier}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {g.categoria && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{g.categoria}</span>
                  )}
                  {g.brands.map((b) => (
                    <span key={b} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{b}</span>
                  ))}
                </div>
              </div>

              {g.links.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Nenhum aparelho vinculado ainda.</p>
              ) : (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Compatível com {g.links.length} modelo(s)
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {shown.map((l) => {
                      const hit = linkMatchesTerms(l, terms)
                      const ctype = l.compatibility_type || 'Direta'
                      const chipStyle =
                        ctype === 'Incompatível'
                          ? 'border-red-300 bg-red-50 font-semibold text-red-800'
                          : ctype === 'Com Adaptação'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : hit
                              ? 'border-amber-300 bg-amber-50 font-semibold text-amber-900'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      return (
                        <li
                          key={l.id}
                          title={l.notas || undefined}
                          className={`rounded-lg border px-2.5 py-1 text-sm ${chipStyle}`}
                        >
                          {ctype === 'Incompatível' && '⛔ '}
                          {g.brands.length > 1 ? l.label : l.modelo}
                          {ctype === 'Com Adaptação' && ' 🔧'}
                          {l.notas && !g.sharedNote && <span aria-hidden="true" className="ml-1 text-xs opacity-60">ⓘ</span>}
                        </li>
                      )
                    })}
                  </ul>
                  {hidden > 0 && (
                    <button type="button" onClick={() => setExpanded((s) => ({ ...s, [g.id]: true }))} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
                      + ver mais {hidden} modelo(s)
                    </button>
                  )}
                </div>
              )}

              {g.sharedNote && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">💡 {g.sharedNote}</p>
              )}
              {individualNotes.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                  {individualNotes.map((l) => (
                    <li key={l.id}><strong className="font-semibold">{l.modelo}:</strong> {l.notas}</li>
                  ))}
                </ul>
              )}

              {isAdmin && (
                <div className="mt-auto pt-4">
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
                    <button onClick={() => setEditingCompat({ part_id: g.id, compatibility_type: 'Direta' })} className="text-blue-600 hover:underline">+ Vincular aparelho</button>
                    <button onClick={() => setManaging((s) => ({ ...s, [g.id]: !s[g.id] }))} className="text-slate-600 hover:underline">
                      {managing[g.id] ? 'Fechar vínculos' : 'Gerenciar vínculos'}
                    </button>
                    <button onClick={() => setEditingPart(g)} className="text-slate-600 hover:underline">Editar peça</button>
                    <button
                      onClick={() => remove(`/parts/${g.id}`, `a peça "${g.nome}" (e suas compatibilidades)`, [parts.reload, compats.reload])}
                      className="text-red-600 hover:underline"
                    >
                      Excluir peça
                    </button>
                  </div>
                  {managing[g.id] && (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                      {g.links.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-slate-800">{l.label}</span>
                          <span className="flex gap-3">
                            <button onClick={() => setEditingCompat({ id: l.id, device_id: l.device_id, part_id: g.id, compatibility_type: l.compatibility_type || 'Direta', notas: l.notas })} className="text-blue-600 hover:underline">Editar</button>
                            <button onClick={() => remove(`/compatibilities/${l.id}`, `o vínculo com ${l.label}`, [compats.reload])} className="text-red-600 hover:underline">Excluir</button>
                          </span>
                        </li>
                      ))}
                      {g.links.length === 0 && <li className="px-3 py-2 text-slate-400">Sem vínculos.</li>}
                    </ul>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {!loading && matchedDevices.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Aparelhos no catálogo ({matchedDevices.length})
              </h3>
              <p className="text-xs text-slate-500">
                Aparelhos cadastrados correspondentes à sua busca/marca e método de abertura na bancada.
              </p>
            </div>
            {matchedDevices.length > 24 && (
              <button
                type="button"
                onClick={() => setShowAllMatchedDevices((v) => !v)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                {showAllMatchedDevices ? 'Mostrar menos' : `Ver todos (${matchedDevices.length})`}
              </button>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(showAllMatchedDevices ? matchedDevices : matchedDevices.slice(0, 24)).map((d) => {
              const partCount = compatCountByDevice.get(d.id) || 0
              return (
                <div
                  key={d.id}
                  className="flex flex-col justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900">{formatDeviceLabel(d.marca, d.modelo)}</span>
                      {d.model_code && (
                        <span className="ml-2 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 border border-slate-200">
                          {d.model_code}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {partCount} peça(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {d.opening_method ? (
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          d.opening_method.toLowerCase().includes('frontal')
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        Abertura {d.opening_method}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-slate-500">
                        Equipamento / Não informado
                      </span>
                    )}
                    {d.has_flex_cable && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        ⚠️ Flex
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
