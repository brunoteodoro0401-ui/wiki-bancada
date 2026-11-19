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

export function DeviceCard({ device, onSelect, onEdit, onDelete }) {
  const isFrontal = (device.opening_method || '').toLowerCase().includes('frontal')
  const displayModel =
    device.marca && normalize(device.modelo).startsWith(normalize(device.marca) + ' ')
      ? device.modelo.slice(device.marca.length).trim()
      : device.modelo

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{device.marca}</p>
        <h3 className="text-lg font-semibold text-slate-900">{displayModel}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {device.opening_method ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isFrontal
                ? 'border border-rose-200 bg-rose-50 text-rose-700'
                : 'border border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
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
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {device.opening_method ? `Abertura ${device.opening_method}` : 'Abertura não informada'}
          </span>
          {device.has_flex_cable && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              ⚠️ Cabo flex sensível
            </span>
          )}
        </div>

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
              {compats.map((c) => (
                <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">{c.part_nome}</p>
                  {c.notas && <p className="mt-0.5 text-xs text-slate-600">{c.notas}</p>}
                </li>
              ))}
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
                    {a.category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {a.category}
                      </span>
                    )}
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
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Lista única de marcas disponíveis ordenada
  const brands = useMemo(() => {
    const list = [...new Set(items.map((d) => d.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return list
  }, [items])

  const activeSearch = (query || externalSearch || '').trim()

  const filtered = useMemo(() => {
    let list = filterBySearch(items, activeSearch, ['marca', 'modelo', 'opening_method'])
    if (selectedBrand) {
      list = list.filter((d) => (d.marca || '').toLowerCase() === selectedBrand.toLowerCase())
    }
    return list
  }, [items, activeSearch, selectedBrand])

  const visibleItems = activeSearch ? filtered : filtered.slice(0, visibleCount)
  const hasFilters = Boolean(activeSearch || selectedBrand)

  function clearFilters() {
    setQuery('')
    setSelectedBrand('')
    setVisibleCount(PAGE_SIZE)
  }

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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Aparelhos Cadastrados</h2>
          <p className="text-sm text-slate-500">
            Catálogo completo com métodos de abertura, avisos de flex e fichas 360º para a bancada.
          </p>
        </div>
        {isAdmin && <button onClick={() => setEditing({})} className={primaryBtn}>+ Novo aparelho</button>}
      </div>

      {/* Campo de busca integrado */}
      <div className="relative">
        <label htmlFor="devices-search" className="sr-only">Buscar aparelho por modelo ou marca</label>
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          id="devices-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setVisibleCount(PAGE_SIZE)
          }}
          placeholder="Buscar aparelho por modelo, linha ou marca… ex.: Galaxy A54, Moto G34, iPhone 14, Poco X3"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

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
            Todas ({items.length})
          </button>
          {brands.map((b) => {
            const count = items.filter((d) => d.marca === b).length
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
