import { useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../api'
import { useAuth } from '../auth'
import { ghostBtn, inputClass, primaryBtn } from '../components/EntityFormModal'

const SUGGESTIONS = [
  'Posso usar calor na tela do iPhone 11?',
  'Poco M3 não liga após reiniciar, o que verificar?',
  'Samsung A54 com triângulo amarelo de temperatura ao carregar',
  'iPhone 13 Pro com tela branca tem reparo sem trocar display?',
]

const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Recomendado — Rápido e Inteligente)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Equilibrado)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Raciocínio Profundo)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Ultra-leve)' },
]

const DEFAULT_HF_MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B Instruct (Excelente em PT-BR e Técnica)' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B Instruct (Meta)' },
  { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3 (Avançado)' },
  { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen 2.5 32B Instruct' },
  { id: 'mistralai/Mistral-Small-24B-Instruct-2501', label: 'Mistral Small 24B Instruct' },
]

export default function AssistantView({ onRequireLogin }) {
  const { user, isAdmin } = useAuth()
  const [question, setQuestion] = useState('')
  const [useWeb, setUseWeb] = useState(true)
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [savingIdx, setSavingIdx] = useState(null)

  // Configurações e seleção de modelo (Gemini / Hugging Face)
  const [aiSettings, setAiSettings] = useState(null)
  const [showModelConfig, setShowModelConfig] = useState(false)
  const [provider, setProvider] = useState('auto')
  const [geminiModel, setGeminiModel] = useState('gemini-3.6-flash')
  const [hfModel, setHfModel] = useState('Qwen/Qwen2.5-72B-Instruct')
  const [customHfModel, setCustomHfModel] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [hfKeyInput, setHfKeyInput] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState(null)

  const bottomRef = useRef(null)

  useEffect(() => {
    if (!user) return
    api
      .get('/ai_settings')
      .then((res) => {
        const s = res.data
        setAiSettings(s)
        if (s.provider) setProvider(s.provider)
        if (s.gemini_model) setGeminiModel(s.gemini_model)
        if (s.hf_model) setHfModel(s.hf_model)
      })
      .catch(() => {})
  }, [user])

  if (!user) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Faça login para conversar com o assistente técnico. Ele mantém o contexto da conversa, lê suas Fontes Confiáveis e suporta modelos Google Gemini e Hugging Face.
        </p>
        <button onClick={onRequireLogin} className={`${primaryBtn} mt-4`}>Entrar</button>
      </section>
    )
  }

  const activeHfModel = customHfModel.trim() || hfModel
  const selectedModelForRequest =
    provider === 'huggingface' ? activeHfModel : provider === 'gemini' ? geminiModel : null

  async function handleSaveAiSettings(e) {
    e.preventDefault()
    if (!isAdmin) {
      setShowModelConfig(false)
      return
    }
    setSavingSettings(true)
    setSettingsMsg(null)
    try {
      const res = await api.put('/ai_settings', {
        provider,
        gemini_model: geminiModel,
        hf_model: activeHfModel,
        gemini_api_key: geminiKeyInput.trim() || null,
        hf_api_key: hfKeyInput.trim() || null,
      })
      setAiSettings(res.data)
      setGeminiKeyInput('')
      setHfKeyInput('')
      setSettingsMsg('Configurações do motor de IA salvas com sucesso!')
    } catch (err) {
      setSettingsMsg(`Erro: ${errorMessage(err)}`)
    } finally {
      setSavingSettings(false)
    }
  }

  async function ask(text, forceWeb = null) {
    const q = text.trim()
    if (q.length < 3 || busy) return
    const webMode = forceWeb !== null ? forceWeb : useWeb

    // Monta o histórico das últimas interações para conversa contínua
    const historyPayload = messages
      .filter((m) => !m.error && m.text)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }))

    setMessages((m) => [...m, { role: 'user', text: q, web: webMode }])
    setQuestion('')
    setBusy(true)
    try {
      const res = await api.post('/ask', {
        question: q,
        use_web: webMode,
        history: historyPayload,
        provider,
        model: selectedModelForRequest,
      })
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: res.data.answer,
          sources: res.data.sources,
          web_sources: res.data.web_sources,
          suggested_article: res.data.suggested_article,
          follow_up_suggestions: res.data.follow_up_suggestions || [],
          model_used: res.data.model_used,
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

  function clearConversation() {
    setMessages([])
    setQuestion('')
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

  const geminiModels = aiSettings?.available_models?.gemini || DEFAULT_GEMINI_MODELS
  const hfModels = aiSettings?.available_models?.huggingface || DEFAULT_HF_MODELS

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Assistente de bancada</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              💬 Conversa Contínua
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Lembra do aparelho da conversa atual, lê profundamente suas Fontes Confiáveis e aceita links colados diretamente no chat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowModelConfig((v) => !v)
              setSettingsMsg(null)
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            🤖 Motor IA ({provider === 'huggingface' ? 'Hugging Face' : provider === 'gemini' ? 'Gemini' : 'Auto'})
          </button>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs cursor-pointer">
            <input
              type="checkbox"
              checked={useWeb}
              onChange={(e) => setUseWeb(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            🌐 Buscar nas Fontes / Web
          </label>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="Iniciar um novo atendimento / aparelho"
            >
              🧹 Nova conversa
            </button>
          )}
        </div>
      </div>

      {showModelConfig && (
        <form
          onSubmit={handleSaveAiSettings}
          className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                ⚙️ Configurar Motor de IA (Google Gemini & Hugging Face)
              </h3>
              <p className="text-slate-600">
                Escolha o modelo de IA para responder na bancada ou conecte modelos abertos do{' '}
                <a
                  href="https://huggingface.co/models?pipeline_tag=text-generation&sort=trending"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600 underline"
                >
                  huggingface.co
                </a>
                .
              </p>
            </div>
            <button type="button" onClick={() => setShowModelConfig(false)} className={ghostBtn}>
              Fechar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Provedor Preferido</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={inputClass}
              >
                <option value="auto">Automático (Gemini + Fallback HF)</option>
                <option value="gemini">Google Gemini</option>
                <option value="huggingface">Hugging Face (huggingface.co)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">Modelo Google Gemini</label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className={inputClass}
              >
                {geminiModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">Modelo Hugging Face</label>
              <select
                value={hfModel}
                onChange={(e) => setHfModel(e.target.value)}
                className={inputClass}
              >
                {hfModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Ou digite qualquer ID de modelo do Hugging Face (opcional)
              </label>
              <input
                type="text"
                value={customHfModel}
                onChange={(e) => setCustomHfModel(e.target.value)}
                placeholder="Ex: Qwen/Qwen2.5-72B-Instruct ou meta-llama/Llama-3.3-70B-Instruct"
                className={inputClass}
              />
            </div>

            {isAdmin && (
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Token do Hugging Face (HF_API_KEY){' '}
                  {aiSettings?.has_hf_key ? (
                    <span className="text-emerald-700 font-semibold">(✓ Configurado)</span>
                  ) : (
                    <span className="text-amber-700">(Crie grátis em huggingface.co/settings/tokens)</span>
                  )}
                </label>
                <input
                  type="password"
                  value={hfKeyInput}
                  onChange={(e) => setHfKeyInput(e.target.value)}
                  placeholder={aiSettings?.has_hf_key ? '•••••••• (deixe em branco para manter)' : 'Cole seu token hf_...'}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-t border-blue-100 pt-2">
              <div className="sm:w-1/2">
                <label className="mb-1 block font-medium text-slate-700">
                  Chave Google Gemini (GEMINI_API_KEY){' '}
                  {aiSettings?.has_gemini_key && (
                    <span className="text-emerald-700 font-semibold">(✓ Configurada)</span>
                  )}
                </label>
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={aiSettings?.has_gemini_key ? '•••••••• (deixe em branco para manter)' : 'Cole sua chave AIza... / AQ...'}
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={savingSettings} className={primaryBtn}>
                {savingSettings ? 'Salvando...' : '💾 Salvar Padrão no Servidor'}
              </button>
            </div>
          )}

          {settingsMsg && (
            <p className="rounded-lg bg-white px-3 py-2 font-medium text-slate-700 shadow-2xs">
              {settingsMsg}
            </p>
          )}
        </form>
      )}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : m.error
                    ? 'bg-red-50 text-red-700'
                    : 'border border-slate-200 bg-white text-slate-800 shadow-2xs'
              }`}
            >
              {m.text}
              {m.role === 'bot' && m.mode && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    {m.mode === 'llm_web'
                      ? '🌐 Base da Bancada + Leitura das Fontes / Internet'
                      : m.mode === 'llm'
                        ? '🧠 Resposta por IA com base na sua bancada'
                        : '📋 Resultado direto da base (sem IA)'}
                  </span>
                  {m.model_used && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {m.model_used}
                    </span>
                  )}
                </div>
              )}
              {m.sources?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">Fontes da sua bancada:</p>
                  <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
                    {m.sources.map((s) => (
                      <li key={`${s.type}-${s.id}`}>{s.title}</li>
                    ))}
                  </ol>
                </div>
              )}
              {m.web_sources?.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-medium text-slate-500">Links e Fontes lidos pela IA:</p>
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

              {m.role === 'bot' && !m.error && m.follow_up_suggestions?.length > 0 && i === messages.length - 1 && (
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Continuar conversa sobre este reparo:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.follow_up_suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={busy}
                        onClick={() => ask(sug)}
                        className="rounded-xl border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-left text-xs font-medium text-blue-800 hover:bg-blue-100 transition"
                      >
                        ↪ {sug}
                      </button>
                    ))}
                  </div>
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
          <p className="text-sm text-slate-500 animate-pulse">
            {useWeb
              ? 'Consultando a bancada e lendo suas Fontes Confiáveis / Internet...'
              : 'Analisando o contexto da conversa e consultando a base...'}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
        className="flex gap-2"
      >
        <label htmlFor="ask-input" className="sr-only">
          Sua pergunta
        </label>
        <input
          id="ask-input"
          value={question}
          maxLength={1000}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            messages.length > 0
              ? 'Continue a conversa (ex: "e se já troquei a tela?", "qual tensão medir?") ou cole um link...'
              : 'Descreva o defeito, pergunte um procedimento ou cole um link técnico...'
          }
          className={inputClass}
        />
        <button type="submit" disabled={busy || question.trim().length < 3} className={primaryBtn}>
          {messages.length > 0 ? 'Responder' : 'Perguntar'}
        </button>
      </form>
    </section>
  )
}
