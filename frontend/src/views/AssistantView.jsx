import { useRef, useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { ghostBtn, inputClass, primaryBtn } from '../components/EntityFormModal'

const SUGGESTIONS = [
  'Posso usar calor na tela do iPhone 11?',
  'Poco M3 não liga após reiniciar, o que verificar?',
  'Samsung A54 com triângulo amarelo de temperatura ao carregar',
  'iPhone 13 Pro com tela branca tem reparo sem trocar display?',
]

export default function AssistantView({ onRequireLogin }) {
  const { user, isAdmin } = useAuth()
  const [question, setQuestion] = useState('')
  const [useWeb, setUseWeb] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'bot', text, sources?, web_sources?, suggested_article?, saved?, mode?, questionAsked?, error?}
  const [busy, setBusy] = useState(false)
  const [savingIdx, setSavingIdx] = useState(null)
  const bottomRef = useRef(null)

  if (!user) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Faça login para perguntar ao assistente. Ele responde com base nas dicas, aparelhos, compatibilidades e também pesquisa na internet quando solicitado.
        </p>
        <button onClick={onRequireLogin} className={`${primaryBtn} mt-4`}>Entrar</button>
      </section>
    )
  }

  async function ask(text, forceWeb = null) {
    const q = text.trim()
    if (q.length < 3 || busy) return
    const webMode = forceWeb !== null ? forceWeb : useWeb
    setMessages((m) => [...m, { role: 'user', text: q, web: webMode }])
    setQuestion('')
    setBusy(true)
    try {
      const res = await api.post('/ask', { question: q, use_web: webMode })
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: res.data.answer,
          sources: res.data.sources,
          web_sources: res.data.web_sources,
          suggested_article: res.data.suggested_article,
          mode: res.data.mode,
          questionAsked: q,
        },
      ])
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: errorMessage(err), error: true }])
    } finally {
      setBusy(false)
      setTimeout(() => bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }), 0)
    }
  }

  async function saveSuggestedToWiki(idx) {
    const msg = messages[idx]
    if (!msg?.suggested_article || msg.saved) return
    setSavingIdx(idx)
    try {
      await api.post('/wiki_articles', msg.suggested_article)
      setMessages((prev) => prev.map((item, i) => (i === idx ? { ...item, saved: true } : item)))
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setSavingIdx(null)
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>
          <p className="text-xs text-slate-500">
            Consulta primeiro a base interna da sua assistência e, se ativado, busca também na internet e nas suas Fontes Confiáveis.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs cursor-pointer">
          <input
            type="checkbox"
            checked={useWeb}
            onChange={(e) => setUseWeb(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          🌐 Buscar também na Internet / Fontes
        </label>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-blue-600 text-white' : m.error ? 'bg-red-50 text-red-700' : 'border border-slate-200 bg-white text-slate-800'
            }`}>
              {m.text}
              {m.role === 'bot' && m.mode && (
                <p className="mt-2 text-xs text-slate-400">
                  {m.mode === 'llm_web'
                    ? '🌐 Resposta gerada por IA combinando sua Base de Bancada + Pesquisa na Internet.'
                    : m.mode === 'llm'
                      ? 'Resposta gerada por IA com base na sua base de conhecimento.'
                      : 'Resultado direto da base (sem IA).'}
                </p>
              )}
              {m.sources?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">Fontes da sua bancada:</p>
                  <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
                    {m.sources.map((s) => <li key={`${s.type}-${s.id}`}>{s.title}</li>)}
                  </ol>
                </div>
              )}
              {m.web_sources?.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-medium text-slate-500">Fontes consultadas na Internet:</p>
                  <ul className="mt-0.5 space-y-0.5 text-xs text-blue-600">
                    {m.web_sources.map((ws, idx) => (
                      <li key={idx}>
                        <a href={ws.url} target="_blank" rel="noreferrer" className="underline hover:text-blue-800">
                          {ws.title || ws.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.role === 'bot' && !m.error && m.sources?.length === 0 && m.mode !== 'llm_web' && m.questionAsked && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => ask(m.questionAsked, true)}
                    disabled={busy}
                    className={ghostBtn}
                  >
                    🌐 Pesquisar essa dúvida na Internet com a IA
                  </button>
                </div>
              )}
              {m.role === 'bot' && isAdmin && m.suggested_article && (
                <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Quer ensinar essa resposta definitivamente para o seu banco?
                  </span>
                  {m.saved ? (
                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      ✓ Salva na Wiki!
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => saveSuggestedToWiki(i)}
                      disabled={savingIdx === i}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      {savingIdx === i ? 'Salvando...' : '💾 Salvar na Wiki'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <p className="text-sm text-slate-500">
            {useWeb ? 'Consultando a base e pesquisando nas fontes da internet...' : 'Consultando a base...'}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(question) }} className="flex gap-2">
        <label htmlFor="ask-input" className="sr-only">Sua pergunta</label>
        <input id="ask-input" value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} placeholder="Descreva o problema ou pergunte um procedimento..." className={inputClass} />
        <button type="submit" disabled={busy || question.trim().length < 3} className={primaryBtn}>Perguntar</button>
      </form>
    </section>
  )
}
