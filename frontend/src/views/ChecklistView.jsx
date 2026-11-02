import { useState } from 'react'
import { useResource } from '../hooks'
import { ghostBtn, inputClass, primaryBtn } from '../components/EntityFormModal'

export const CHECKLIST_HISTORY_KEY = 'bancada_checklists_history'

const CHECKLIST_ITEMS = [
  { id: 'tela_touch', label: 'Tela / Display / Touch / Brilho', group: 'Visual & Tela' },
  { id: 'aro_tampa', label: 'Carcaça / Aro / Tampa Traseira / Lentes', group: 'Visual & Tela' },
  { id: 'biometria_faceid', label: 'Biometria (Digital) / Face ID', group: 'Sensores' },
  { id: 'proximidade', label: 'Sensor de Proximidade (apaga em ligação)', group: 'Sensores' },
  { id: 'cam_traseira', label: 'Câmeras Traseiras (1x, 0.5x, Zoom, Flash)', group: 'Câmeras' },
  { id: 'cam_frontal', label: 'Câmera Frontal (Selfie / Foco)', group: 'Câmeras' },
  { id: 'audio_auricular', label: 'Auricular (Alto-falante de chamada)', group: 'Áudio' },
  { id: 'audio_campainha', label: 'Campainha (Alto-falante multimídia)', group: 'Áudio' },
  { id: 'microfones', label: 'Microfones (Gravador / Chamada / Câmera)', group: 'Áudio' },
  { id: 'carga_usb', label: 'Conector de Carga (Ambos os lados / Turbo)', group: 'Energia & Placa' },
  { id: 'bateria_fonte', label: 'Bateria / Consumo na Fonte de Bancada', group: 'Energia & Placa' },
  { id: 'botoes', label: 'Botões Físicos (Power, Volume +, Volume -)', group: 'Físico & Rede' },
  { id: 'wifi_bt', label: 'Wi-Fi / Bluetooth / GPS', group: 'Físico & Rede' },
  { id: 'chip_rede', label: 'Leitor de Chip SIM / Sinal de Operadora', group: 'Físico & Rede' },
]

const STATUS_OPTIONS = [
  { value: 'ok', label: '✅ OK', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'defeito', label: '❌ Defeito', activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'nao_testado', label: '⚠️ Não testado', activeClass: 'bg-amber-500 text-white border-amber-500' },
  { value: 'na', label: '➖ N/A', activeClass: 'bg-slate-600 text-white border-slate-600' },
]

const STATUS_LABELS = {
  ok: '✅ OK',
  defeito: '❌ Com Defeito',
  nao_testado: '⚠️ Impossível testar (apagado/bloqueado)',
  na: '➖ Não se aplica',
}

function defaultStatuses() {
  return Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.id, 'ok']))
}

function loadSavedChecklists() {
  try {
    const raw = localStorage.getItem(CHECKLIST_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function ChecklistView({ onAskAI }) {
  const { items: devices } = useResource('/devices')
  const [stage, setStage] = useState('Entrada (Pré-Reparo)')
  const [osNumber, setOsNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [benchCurrent, setBenchCurrent] = useState('')
  const [batteryHealth, setBatteryHealth] = useState('')
  const [notes, setNotes] = useState('')
  const [statuses, setStatuses] = useState(defaultStatuses)
  const [copied, setCopied] = useState(false)
  const [savedHistory, setSavedHistory] = useState(loadSavedChecklists)

  const matchedDevice = devices.find(
    (d) => `${d.marca} ${d.modelo}`.toLowerCase() === deviceModel.trim().toLowerCase(),
  )

  function setItemStatus(id, status) {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }

  function markAllAs(status) {
    setStatuses(Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.id, status])))
  }

  function resetForm() {
    setOsNumber('')
    setClientName('')
    setDeviceModel('')
    setBenchCurrent('')
    setBatteryHealth('')
    setNotes('')
    setStatuses(defaultStatuses())
    setCopied(false)
  }

  const failingItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'defeito')
  const untestedItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'nao_testado')
  const okItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'ok')

  function buildReportText() {
    const header = [
      `📋 *CHECKLIST DE BANCADA — ${stage.toUpperCase()}*`,
      osNumber.trim() ? `🔢 *O.S.:* ${osNumber.trim()}` : null,
      clientName.trim() ? `👤 *Cliente:* ${clientName.trim()}` : null,
      `📱 *Aparelho:* ${deviceModel.trim() || 'Não informado'}`,
      benchCurrent.trim() ? `⚡ *Consumo na Fonte:* ${benchCurrent.trim()}` : null,
      batteryHealth.trim() ? `🔋 *Saúde da Bateria:* ${batteryHealth.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const lines = CHECKLIST_ITEMS.map(
      (item) => `• ${item.label}: *${STATUS_LABELS[statuses[item.id]]}*`,
    ).join('\n')

    const footer = notes.trim() ? `\n📝 *Observações Técnicas:*\n${notes.trim()}` : ''
    return `${header}\n\n${lines}${footer}`
  }

  async function handleCopyReport() {
    const text = buildReportText()
    try {
      await navigator.clipboard?.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback silencioso
    }
  }

  function handleSaveChecklist() {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString('pt-BR'),
      stage,
      osNumber: osNumber.trim(),
      clientName: clientName.trim(),
      deviceModel: deviceModel.trim() || 'Aparelho sem modelo',
      benchCurrent: benchCurrent.trim(),
      batteryHealth: batteryHealth.trim(),
      notes: notes.trim(),
      statuses,
      failCount: failingItems.length,
    }
    const next = [entry, ...savedHistory].slice(0, 15)
    setSavedHistory(next)
    try {
      localStorage.setItem(CHECKLIST_HISTORY_KEY, JSON.stringify(next))
    } catch {
      // ignora erro de quota
    }
  }

  function handleLoadEntry(entry) {
    setStage(entry.stage)
    setOsNumber(entry.osNumber || '')
    setClientName(entry.clientName || '')
    setDeviceModel(entry.deviceModel || '')
    setBenchCurrent(entry.benchCurrent || '')
    setBatteryHealth(entry.batteryHealth || '')
    setNotes(entry.notes || '')
    setStatuses({ ...defaultStatuses(), ...(entry.statuses || {}) })
  }

  function handleDeleteEntry(id) {
    const next = savedHistory.filter((e) => e.id !== id)
    setSavedHistory(next)
    try {
      localStorage.setItem(CHECKLIST_HISTORY_KEY, JSON.stringify(next))
    } catch {
      // ignora
    }
  }

  function handleDiagnoseWithAI() {
    const dev = deviceModel.trim() || 'smartphone na bancada'
    const fails = failingItems.map((i) => i.label).join(', ')
    const extra = [
      benchCurrent.trim() ? `Consumo na fonte: ${benchCurrent.trim()}.` : '',
      notes.trim() ? `Observações: ${notes.trim()}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const prompt = fails
      ? `Estou com um ${dev} na bancada (${stage}). Itens apresentando defeito no checklist: ${fails}. ${extra} Qual o diagnóstico provável e o passo a passo de testes na placa?`
      : `Estou iniciando o checklist de bancada do ${dev} (${stage}). ${extra} Quais os principais pontos críticos e cuidados ao abrir e testar este modelo?`
    onAskAI?.(prompt)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              ✅ Checklist de Entrada e Saída de Bancada
            </h2>
            <p className="text-xs text-slate-500">
              Inspecione o aparelho antes de abrir e antes de entregar ao cliente, gere o laudo para WhatsApp/O.S. ou envie as falhas para diagnóstico na IA.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Entrada (Pré-Reparo)', 'Saída (Pós-Reparo)'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  stage === s
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {s === 'Entrada (Pré-Reparo)' ? '📥 Entrada (Pré-Reparo)' : '📤 Saída (Pós-Reparo)'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="chk-device" className="mb-1 block text-xs font-medium text-slate-700">
              Aparelho / Modelo
            </label>
            <input
              id="chk-device"
              list="chk-device-list"
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              placeholder="Ex: Apple iPhone 13 Pro, Galaxy A54..."
              className={inputClass}
            />
            <datalist id="chk-device-list">
              {devices.map((d) => (
                <option key={d.id} value={`${d.marca} ${d.modelo}`} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="chk-os" className="mb-1 block text-xs font-medium text-slate-700">
              Nº da Ordem de Serviço (O.S.)
            </label>
            <input
              id="chk-os"
              value={osNumber}
              onChange={(e) => setOsNumber(e.target.value)}
              placeholder="Ex: OS-1042"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="chk-client" className="mb-1 block text-xs font-medium text-slate-700">
              Cliente
            </label>
            <input
              id="chk-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do cliente (opcional)"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="chk-current" className="mb-1 block text-xs font-medium text-slate-700">
              Consumo na Fonte / USB Meter
            </label>
            <input
              id="chk-current"
              value={benchCurrent}
              onChange={(e) => setBenchCurrent(e.target.value)}
              placeholder="Ex: 0.00A em standby / 1.8A carregando"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="chk-battery" className="mb-1 block text-xs font-medium text-slate-700">
              Saúde da Bateria (%)
            </label>
            <input
              id="chk-battery"
              value={batteryHealth}
              onChange={(e) => setBatteryHealth(e.target.value)}
              placeholder="Ex: 82% (Original)"
              className={inputClass}
            />
          </div>

          <div className="flex items-end gap-2">
            <button type="button" onClick={() => markAllAs('ok')} className={ghostBtn}>
              Tudo ✅ OK
            </button>
            <button type="button" onClick={() => markAllAs('nao_testado')} className={ghostBtn}>
              Aparelho Apagado ⚠️
            </button>
            <button type="button" onClick={resetForm} className={ghostBtn}>
              Limpar
            </button>
          </div>
        </div>

        {matchedDevice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>⚠️ Alerta de Bancada ({matchedDevice.marca} {matchedDevice.modelo}):</strong>{' '}
              Abertura <strong>{matchedDevice.opening_method || 'não informada'}</strong>.{' '}
              {matchedDevice.has_flex_cable &&
                'Possui cabo flex sensível na abertura — desconecte com cuidado antes de separar.'}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Itens de Verificação ({okItems.length} OK · {failingItems.length} com defeito · {untestedItems.length} não testados)
            </h3>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {CHECKLIST_ITEMS.map((item) => {
              const current = statuses[item.id]
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400 mr-2">
                      {item.group}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={item.label}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setItemStatus(item.id, opt.value)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          current === opt.value
                            ? opt.activeClass
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="chk-notes" className="mb-1 block text-xs font-medium text-slate-700">
            Observações Técnicas / Relato do Cliente / Detalhes de Microsoldagem
          </label>
          <textarea
            id="chk-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Tampa traseira trincada no canto inferior, parafuso inferior esquerdo ausente, cliente relatou queda na água..."
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyReport} className={primaryBtn}>
              {copied ? '✓ Laudo Copiado para Área de Transferência!' : '📋 Copiar Laudo (WhatsApp / O.S.)'}
            </button>
            <button type="button" onClick={handleSaveChecklist} className={ghostBtn}>
              💾 Salvar no Histórico Local
            </button>
          </div>
          <button
            type="button"
            onClick={handleDiagnoseWithAI}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            🤖 Diagnosticar {failingItems.length > 0 ? `(${failingItems.length} defeito${failingItems.length > 1 ? 's' : ''})` : 'Aparelho'} na IA
          </button>
        </div>
      </section>

      {savedHistory.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">
            🗂️ Últimos Checklists Salvos neste Computador ({savedHistory.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedHistory.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs text-xs space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{entry.deviceModel}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {entry.stage.startsWith('Entrada') ? '📥 Entrada' : '📤 Saída'}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    {entry.osNumber && `O.S. ${entry.osNumber} · `}
                    {entry.clientName && `${entry.clientName} · `}
                    {entry.date}
                  </p>
                  <p className="mt-1.5 font-medium text-slate-700">
                    {entry.failCount > 0 ? (
                      <span className="text-red-600">❌ {entry.failCount} item(ns) com defeito</span>
                    ) : (
                      <span className="text-emerald-700">✅ Todos os itens OK</span>
                    )}
                  </p>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => handleLoadEntry(entry)}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Reabrir no Checklist
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
