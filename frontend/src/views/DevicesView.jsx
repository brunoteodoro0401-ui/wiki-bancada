import { useEffect, useMemo, useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { useResource } from '../hooks'
import { filterBySearch, formatDeviceLabel, matchesDeviceTarget, normalize } from '../utils'
import EntityFormModal, { ghostBtn, primaryBtn } from '../components/EntityFormModal'
import Modal from '../components/Modal'

const chipBase = 'rounded-full px-3 py-1 text-xs font-medium transition-colors'
const chipOn = 'bg-blue-600 text-white shadow-2xs'
const chipOff = 'bg-slate-100 text-slate-700 hover:bg-slate-200'

const DEVICE_TYPES = ['Smartphone', 'Tablet', 'Notebook', 'Console', 'Insumo / Máquina', 'Outro']

const FIELDS = [
  { name: 'marca', label: 'Marca', required: true },
  { name: 'modelo', label: 'Modelo', required: true },
  { name: 'model_code', label: 'Código de modelo / fábrica (ex: SM-A145M, A2651)' },
  {
    name: 'device_type',
    label: 'Tipo de equipamento',
    type: 'select',
    options: DEVICE_TYPES.map((t) => ({ value: t, label: t })),
  },
  {
    name: 'opening_method',
    label: 'Método de abertura',
    type: 'select',
    options: [
      { value: '', label: 'Não informado' },
      { value: 'Frontal', label: 'Frontal (pela tela)' },
      { value: 'Traseira', label: 'Traseira (pela tampa)' },
      { value: 'Frontal / Traseira', label: 'Frontal / Traseira (Modular)' },
    ],
  },
  { name: 'opening_temp', label: 'Temperatura / Método (ex: 80°C (3 min), Encaixe)' },
  { name: 'has_flex_cable', label: 'Possui cabo flex sensível na abertura', type: 'checkbox' },
  { name: 'technical_notes', label: 'Observações técnicas de abertura (opcional)', type: 'textarea' },
]

export function DeviceCard({ device, onSelect, onEdit, onDelete }) {
  const methodLow = (device.opening_method || '').toLowerCase()
  const isModular = methodLow.includes('frontal') && methodLow.includes('traseira')
  const isFrontal = !isModular && methodLow.includes('frontal')
  const displayModel =
    device.marca && normalize(device.modelo).startsWith(normalize(device.marca) + ' ')
      ? device.modelo.slice(device.marca.length).trim()
      : device.modelo

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{device.marca}</p>
          <h3 className="text-lg font-semibold text-slate-900">{displayModel}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {device.model_code && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
              {device.model_code}
            </span>
          )}
          {device.device_type && device.device_type !== 'Smartphone' && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
              {device.device_type}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {device.opening_method ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isModular
                ? 'border border-purple-200 bg-purple-50 text-purple-700'
                : isFrontal
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            Abertura {device.opening_method}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Abertura não informada</span>
        )}
        {device.opening_temp && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
            🌡️ {device.opening_temp}
          </span>
        )}
      </div>
      {device.has_flex_cable ? (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Cuidado com o cabo flex ao abrir:{' '}
          {device.technical_notes || 'desconecte com cuidado antes de separar as partes.'}
        </p>
      ) : device.technical_notes ? (
        <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{device.technical_notes}</p>
      ) : null}
      {(onSelect || onEdit || onDelete) && (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(device)}
              className="font-medium text-slate-700 hover:text-blue-600"
            >
              🔍 Ficha 360º
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            {onEdit && <button onClick={() => onEdit(device)} className="text-blue-600 hover:underline">Editar</button>}
            {onDelete && <button onClick={() => onDelete(device)} className="text-red-600 hover:underline">Excluir</button>}
          </div>
        </div>
      )}
    </article>
  )
}

function DeviceDetailModal({ device, onClose, onAskDevice }) {
  const [compats, setCompats] = useState([])
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/compatibilities').catch(() => ({ data: [] })),
      api.get('/wiki_articles').catch(() => ({ data: [] })),
    ]).then(([cRes, aRes]) => {
      if (!active) return
      const fullLabelNorm = normalize(formatDeviceLabel(device.marca, device.modelo))
      const matchedCompats = []
      const seenPartIds = new Set()
      // Prioriza vínculos exatos por device_id e aceita equivalência direta de variante 4G sem sufixo
      const allCompats = cRes.data || []
      for (const c of allCompats) {
        if (c.device_id === device.id) {
          matchedCompats.push(c)
          seenPartIds.add(c.part_id)
        }
      }
      for (const c of allCompats) {
        if (seenPartIds.has(c.part_id)) continue
        const cLabel = normalize(c.device_label)
        if (
          cLabel === fullLabelNorm ||
          (cLabel === `${fullLabelNorm} 4g` && !fullLabelNorm.includes('5g')) ||
          (`${cLabel} 4g` === fullLabelNorm)
        ) {
          matchedCompats.push(c)
          seenPartIds.add(c.part_id)
        }
      }
      setCompats(matchedCompats)
      const matchedArticles = (aRes.data || []).filter((a) =>
        matchesDeviceTarget(a.target_device, device.marca, device.modelo),
      )
      setArticles(matchedArticles)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [device])

  const label = formatDeviceLabel(device.marca, device.modelo)

  return (
    <Modal title={`📱 Ficha 360º — ${label}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {device.model_code && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
              Cód.: {device.model_code}
            </span>
          )}
          {device.device_type && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              {device.device_type}
            </span>
          )}
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {device.opening_method ? `Abertura ${device.opening_method}` : 'Abertura não informada'}
          </span>
          {device.opening_temp && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              🌡️ {device.opening_temp}
            </span>
          )}
          {device.has_flex_cable && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              ⚠️ Cabo flex sensível
            </span>
          )}
        </div>
        {device.technical_notes && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
            🛠️ <strong>Bancada:</strong> {device.technical_notes}
          </p>
        )}

        <div>
          <h4 className="mb-1.5 font-semibold text-slate-900">
            🔩 Peças Compatíveis ({compats.length})
          </h4>
          {loading ? (
            <p className="text-xs text-slate-500">Consultando compatibilidades...</p>
          ) : compats.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma peça vinculada diretamente a este aparelho ainda.</p>
          ) : (
            <ul className="space-y-2">
              {compats.map((c) => {
                const ctype = c.compatibility_type || 'Direta'
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border p-3 ${
                      ctype === 'Incompatível'
                        ? 'border-red-200 bg-red-50/60'
                        : ctype === 'Com Adaptação'
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <p className="font-medium text-slate-900">{c.part_nome}</p>
                      <div className="flex items-center gap-1.5">
                        {c.part_code && (
                          <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 border border-slate-200">
                            {c.part_code}
                          </span>
                        )}
                        {ctype !== 'Direta' && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              ctype === 'Incompatível'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ctype === 'Incompatível' ? '⛔ Incompatível' : '🔧 Com Adaptação'}
                          </span>
                        )}
                      </div>
                    </div>
                    {c.notas && <p className="mt-0.5 text-xs text-slate-600">{c.notas}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-1.5 font-semibold text-slate-900">
            📘 Dicas da Wiki para {device.modelo} ({articles.length})
          </h4>
          {loading ? (
            <p className="text-xs text-slate-500">Buscando dicas na Wiki...</p>
          ) : articles.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma dica específica cadastrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {articles.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{a.target_device}</span>
                    <div className="flex items-center gap-1">
                      {(a.severity === 'Crítico' || a.severity === 'Atenção') && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            a.severity === 'Crítico'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {a.severity === 'Crítico' ? '🚨 Crítico' : '⚠️ Atenção'}
                        </span>
                      )}
                      {a.category && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {a.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">{a.ai_context_text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {onAskDevice && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onAskDevice(label)
              }}
              className={primaryBtn}
            >
              🤖 Perguntar à IA sobre {device.modelo}
            </button>
          )}
          <button type="button" onClick={onClose} className={ghostBtn}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  )
}

const PAGE_SIZE = 48

export default function DevicesView({ search: externalSearch, onAskDevice }) {
  const { isAdmin } = useAuth()
  const { items, loading, error, reload } = useResource('/devices')
  const [editing, setEditing] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const typeCounts = useMemo(() => {
    const map = new Map()
    for (const d of items) {
      const t = d.device_type || 'Smartphone'
      map.set(t, (map.get(t) || 0) + 1)
    }
    return map
  }, [items])

  const itemsByType = useMemo(() => {
    if (!selectedType) return items
    return items.filter((d) => (d.device_type || 'Smartphone') === selectedType)
  }, [items, selectedType])

  // Lista única de marcas disponíveis ordenada
  const brands = useMemo(() => {
    const list = [...new Set(itemsByType.map((d) => d.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return list
  }, [itemsByType])

  const activeSearch = (query || externalSearch || '').trim()

  const filtered = useMemo(() => {
    let list = filterBySearch(itemsByType, activeSearch, [
      'marca',
      'modelo',
      'model_code',
      'device_type',
      'opening_method',
      'technical_notes',
    ])
    if (selectedBrand) {
      list = list.filter((d) => (d.marca || '').toLowerCase() === selectedBrand.toLowerCase())
    }
    return list
  }, [itemsByType, activeSearch, selectedBrand])

  const visibleItems = activeSearch ? filtered : filtered.slice(0, visibleCount)
  const hasFilters = Boolean(activeSearch || selectedBrand || selectedType)

  function clearFilters() {
    setQuery('')
    setSelectedBrand('')
    setSelectedType('')
    setVisibleCount(PAGE_SIZE)
  }

  async function save(values) {
    const body = {
      ...values,
      model_code: values.model_code || null,
      device_type: values.device_type || 'Smartphone',
      opening_method: values.opening_method || null,
      opening_temp: values.opening_temp || null,
      technical_notes: values.technical_notes || null,
    }
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Aparelhos Cadastrados</h2>
          <p className="text-sm text-slate-500">
            Catálogo completo com métodos de abertura, avisos de flex e fichas 360º para a bancada.
          </p>
        </div>
        {isAdmin && <button onClick={() => setEditing({ device_type: 'Smartphone' })} className={primaryBtn}>+ Novo aparelho</button>}
      </div>

      {/* Campo de busca integrado */}
      <div className="relative">
        <label htmlFor="devices-search" className="sr-only">Buscar aparelho por modelo, código ou marca</label>
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          id="devices-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setVisibleCount(PAGE_SIZE)
          }}
          placeholder="Buscar por modelo, código (SM-A145M, A2651) ou marca… ex.: Galaxy A54, Moto G34, iPhone 14"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Filtro por tipo de equipamento */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de equipamento">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</span>
          <button
            type="button"
            onClick={() => {
              setSelectedType('')
              setSelectedBrand('')
              setVisibleCount(PAGE_SIZE)
            }}
            className={`${chipBase} ${selectedType === '' ? chipOn : chipOff}`}
          >
            Todos ({items.length})
          </button>
          {DEVICE_TYPES.filter((t) => (typeCounts.get(t) || 0) > 0).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedType(selectedType === t ? '' : t)
                setSelectedBrand('')
                setVisibleCount(PAGE_SIZE)
              }}
              className={`${chipBase} ${selectedType === t ? chipOn : chipOff}`}
            >
              {t} ({typeCounts.get(t)})
            </button>
          ))}
        </div>
      )}

      {/* Filtro por marca */}
      {!loading && brands.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por marca">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Marca</span>
          <button
            type="button"
            onClick={() => {
              setSelectedBrand('')
              setVisibleCount(PAGE_SIZE)
            }}
            className={`${chipBase} ${selectedBrand === '' ? chipOn : chipOff}`}
          >
            Todas ({itemsByType.length})
          </button>
          {brands.map((b) => {
            const count = itemsByType.filter((d) => d.marca === b).length
            return (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setSelectedBrand(selectedBrand === b ? '' : b)
                  setVisibleCount(PAGE_SIZE)
                }}
                className={`${chipBase} ${selectedBrand === b ? chipOn : chipOff}`}
              >
                {b} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Contador e Limpar Filtros */}
      <div className="flex items-center justify-between text-sm text-slate-500" aria-live="polite">
        <span>
          {loading ? 'Carregando...' : `${filtered.length} aparelho(s)${hasFilters ? ` de ${items.length}` : ''}`}
        </span>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="font-medium text-blue-600 hover:underline">
            Limpar busca e filtros
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500">Carregando catálogo...</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {actionError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-red-700">{actionError}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nenhum aparelho encontrado{activeSearch ? ` para "${activeSearch}"` : ''}.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            onSelect={setSelectedDevice}
            onEdit={isAdmin ? setEditing : undefined}
            onDelete={isAdmin ? remove : undefined}
          />
        ))}
      </div>
      {!activeSearch && filtered.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className={ghostBtn}
          >
            Mostrar mais aparelhos ({filtered.length - visibleCount} restantes)
          </button>
        </div>
      )}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onAskDevice={onAskDevice}
        />
      )}
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
