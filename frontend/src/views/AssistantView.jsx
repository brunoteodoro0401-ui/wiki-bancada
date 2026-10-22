import { useRef, useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { inputClass, primaryBtn } from '../components/EntityFormModal'

const SUGGESTIONS = [
  'Posso usar calor na tela do iPhone 11?',
  'Como fazer hard reset num Samsung S23?',
  'Erro de ativação com tela paralela no iPhone',
]

export default function AssistantView({ onRequireLogin }) {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([]) // {role:'user'|'bot', text, sources?, mode?, error?}
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  if (!user) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Faça login para perguntar ao assistente. Ele responde com base nas dicas, aparelhos e compatibilidades cadastrados.
        </p>
        <button onClick={onRequireLogin} className={`${primaryBtn} mt-4`}>Entrar</button>
      </section>
    )
  }

  async function ask(text) {
    const q = text.trim()
    if (q.length < 3 || busy) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setQuestion('')
    setBusy(true)
    try {
      const res = await api.post('/ask', { question: q })
      setMessages((m) => [...m, { role: 'bot', text: res.data.answer, sources: res.data.sources, mode: res.data.mode }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: errorMessage(err), error: true }])
    } finally {
      setBusy(false)
      setTimeout(() => bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }), 0)
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>

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
                  {m.mode === 'llm' ? 'Resposta gerada por IA com base na sua base de conhecimento.' : 'Resultado direto da base (sem IA).'}
                </p>
              )}
              {m.sources?.length > 0 && (
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
                  {m.sources.map((s) => <li key={`${s.type}-${s.id}`}>{s.title}</li>)}
                </ol>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-slate-500">Consultando a base...</p>}
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
