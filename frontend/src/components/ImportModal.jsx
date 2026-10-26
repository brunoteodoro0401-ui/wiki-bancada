import { useState } from 'react'
import api, { errorMessage } from '../api'
import { ghostBtn, inputClass, primaryBtn } from './EntityFormModal'

const SOURCE_MODES = [
  {
    id: 'search',
    label: '🔍 Buscar na Internet',
    placeholder: 'Ex: defeito crônico Poco X3 Pro não liga PMIC ou troca de vidro iPhone 13...',
    help: 'A IA pesquisa na web (e nos seus sites confiáveis) e monta dicas prontas para salvar no banco.',
  },
  {
    id: 'youtube',
    label: '🎥 Vídeo do YouTube',
    placeholder: 'Cole o link do vídeo ou Short (ex: https://www.youtube.com/watch?v=...)',
    help: 'Extrai o título, descrição técnica e legendas do vídeo do YouTube para criar dicas na Wiki.',
  },
  {
    id: 'url',
    label: '🔗 Site / Fórum (URL)',
    placeholder: 'Cole o link da página ou tópico (ex: https://pt.ifixit.com/Guide/...)',
    help: 'Lê o conteúdo do guia ou tópico de fórum e resume os procedimentos e alertas técnicos.',
  },
  {
    id: 'text',
    label: '📋 Texto (Facebook / WhatsApp)',
    placeholder: 'Cole aqui uma postagem de grupo do Facebook, conversa de WhatsApp ou anotação técnica...',
    help: 'Transforma textos brutos de grupos e fóruns em dicas organizadas com tags para a IA usar.',
  },
]

export default function ImportModal({ initialMode = 'search', initialQuery = '', onClose, onSaved }) {
  const [sourceType, setSourceType] = useState(initialMode)
  const [content, setContent] = useState(initialQuery)
  const [deviceHint, setDeviceHint] = useState('')
  const [trustedOnly, setTrustedOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingIdx, setSavingIdx] = useState(null)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { extracted_text_preview, source_references, articles }
  const [savedIndices, setSavedIndices] = useState({})

  const currentMode = SOURCE_MODES.find((m) => m.id === sourceType) || SOURCE_MODES[0]

  async function handleExtract(e) {
    e.preventDefault()
    if (content.trim().length < 3 || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSavedIndices({})
    try {
      const res = await api.post('/ingest', {
        source_type: sourceType,
        content: content.trim(),
        target_device_hint: deviceHint.trim() || null,
        use_trusted_sources_only: trustedOnly,
        auto_save: false,
      })
      setResult(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function updateArticle(idx, field, val) {
    setResult((prev) => {
      if (!prev) return prev
      const next = [...prev.articles]
      next[idx] = { ...next[idx], [field]: val }
      return { ...prev, articles: next }
    })
  }

  async function saveSingle(idx) {
    const art = result?.articles?.[idx]
    if (!art || savedIndices[idx]) return
    setSavingIdx(idx)
    setError(null)
    try {
      await api.post('/wiki_articles', {
        target_device: art.target_device || 'Geral',
        category: art.category || 'Procedimento',
        ai_context_text: art.ai_context_text,
        tags: art.tags || null,
      })
      setSavedIndices((s) => ({ ...s, [idx]: true }))
      onSaved?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingIdx(null)
    }
  }

  async function saveAll() {
    if (!result?.articles?.length) return
    setSavingIdx('all')
    setError(null)
    try {
      for (let i = 0; i < result.articles.length; i += 1) {
        if (!savedIndices[i]) {
          const art = result.articles[i]
          await api.post('/wiki_articles', {
            target_device: art.target_device || 'Geral',
            category: art.category || 'Procedimento',
            ai_context_text: art.ai_context_text,
            tags: art.tags || null,
          })
          setSavedIndices((s) => ({ ...s, [i]: true }))
        }
      }
      onSaved?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingIdx(null)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar Conhecimento para a IA"
        className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">🌐 Alimentar IA com Internet, YouTube, Fóruns ou Grupos</h3>
            <p className="text-xs text-slate-500">
              Extraia procedimentos técnicos automaticamente e salve no banco para a IA responder na bancada.
            </p>
          </div>
          <button onClick={onClose} className={ghostBtn}>Fechar</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {SOURCE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setSourceType(m.id); setResult(null); setError(null) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sourceType === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleExtract} className="mt-4 space-y-3">
          <p className="text-xs text-slate-600">{currentMode.help}</p>

          <div>
            <label htmlFor="ingest-content" className="mb-1 block text-xs font-medium text-slate-700">
              {sourceType === 'text' ? 'Texto copiado (Facebook, WhatsApp, Fórum)' : 'Link ou Assunto para Pesquisa'}
            </label>
            {sourceType === 'text' ? (
              <textarea
                id="ingest-content"
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={currentMode.placeholder}
                className={inputClass}
              />
            ) : (
              <input
                id="ingest-content"
                type="text"
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={currentMode.placeholder}
                className={inputClass}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:w-1/2">
              <label htmlFor="device-hint" className="mb-1 block text-xs font-medium text-slate-700">
                Aparelho / Linha (opcional)
              </label>
              <input
                id="device-hint"
                type="text"
                value={deviceHint}
                onChange={(e) => setDeviceHint(e.target.value)}
                placeholder="Ex: iPhone 13 Pro, Poco X3 Pro, Galaxy A54..."
                className={inputClass}
              />
            </div>

            {sourceType === 'search' && (
              <label className="mt-4 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trustedOnly}
                  onChange={(e) => setTrustedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Buscar apenas nas minhas <strong>Fontes Confiáveis</strong>
              </label>
            )}
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="submit" disabled={loading || content.trim().length < 3} className={primaryBtn}>
              {loading ? 'Analisando com a IA...' : '✨ Extrair Dicas com IA'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-6 space-y-4 border-t border-slate-200 pt-4">
            {result.source_references?.length > 0 && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Fontes consultadas:</p>
                <ul className="mt-1 space-y-1 text-xs text-blue-600">
                  {result.source_references.map((ref, idx) => (
                    <li key={idx}>
                      <a href={ref.url} target="_blank" rel="noreferrer" className="underline hover:text-blue-800">
                        {ref.title || ref.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Dicas extraídas ({result.articles.length}) — revise se quiser e salve no banco:
              </h4>
              {result.articles.length > 1 && (
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={savingIdx !== null}
                  className={primaryBtn}
                >
                  {savingIdx === 'all' ? 'Salvando...' : '💾 Salvar todas na Wiki'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {result.articles.map((art, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Aparelho</label>
                      <input
                        value={art.target_device}
                        onChange={(e) => updateArticle(idx, 'target_device', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Categoria</label>
                      <input
                        value={art.category || ''}
                        onChange={(e) => updateArticle(idx, 'category', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Dica técnica (o que a IA vai aprender)</label>
                    <textarea
                      rows={3}
                      value={art.ai_context_text}
                      onChange={(e) => updateArticle(idx, 'ai_context_text', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="sm:w-2/3">
                      <label className="block text-xs font-medium text-slate-600">Tags</label>
                      <input
                        value={art.tags || ''}
                        onChange={(e) => updateArticle(idx, 'tags', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      {savedIndices[idx] ? (
                        <span className="inline-block rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
                          ✓ Salva no banco!
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => saveSingle(idx)}
                          disabled={savingIdx !== null}
                          className={primaryBtn}
                        >
                          {savingIdx === idx ? 'Salvando...' : '💾 Salvar na Wiki'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
