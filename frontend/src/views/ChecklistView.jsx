import { useEffect, useRef, useState } from 'react'
import api from '../api'
import { useResource } from '../hooks'
import { ghostBtn, inputClass, primaryBtn } from '../components/EntityFormModal'
import {
  createRarBackupBytes,
  downloadOsPdf,
  generateOsPdfBytes,
  getNowInfo,
  parseBackupFile,
  triggerBrowserDownload,
} from '../osBackupAndPdf'

const CHECKLIST_HISTORY_KEY = 'bancada_checklists_history'
const LOCAL_FOLDER_NAME_KEY = 'bancada_os_folder_name'

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

const CLOUD_PROVIDERS = [
  {
    id: 'gdrive',
    name: 'Google Drive',
    icon: '🟢',
    url: 'https://drive.google.com/drive/my-drive',
    hint: 'Salva o arquivo .RAR na sua pasta do Google Drive ou abre seu Drive para enviar.',
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    icon: '🔵',
    url: 'https://onedrive.live.com/',
    hint: 'Salva o arquivo .RAR na pasta do OneDrive do Windows ou abre o OneDrive.',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    url: 'https://www.dropbox.com/home',
    hint: 'Salva o arquivo .RAR na pasta do Dropbox ou abre o painel web do Dropbox.',
  },
]

function defaultStatuses() {
  return Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.id, 'ok']))
}

function normalizeOrder(raw, indexFallback = 1) {
  const statuses = { ...defaultStatuses(), ...(raw.statuses || {}) }
  const failCount = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'defeito').length
  const osNum = raw.osNumber || raw.os_number || `OS-${String(indexFallback).padStart(4, '0')}`
  const status = raw.status || 'aberta'
  const createdAt = raw.createdAt || raw.created_at || raw.date || new Date().toLocaleString('pt-BR')
  return {
    id: raw.id || Date.now() + Math.floor(Math.random() * 1000),
    serverId: raw.serverId || (typeof raw.id === 'number' && raw.id < 1000000000 ? raw.id : null),
    osNumber: osNum,
    status,
    stage: raw.stage || (status === 'encerrada' ? 'Saída (Pós-Reparo)' : 'Entrada (Pré-Reparo)'),
    clientName: raw.clientName ?? raw.client_name ?? '',
    clientPhone: raw.clientPhone ?? raw.client_phone ?? '',
    deviceModel: raw.deviceModel || raw.device_model || 'Aparelho sem modelo',
    imei: raw.imei ?? '',
    benchCurrent: raw.benchCurrent ?? raw.bench_current ?? '',
    batteryHealth: raw.batteryHealth ?? raw.battery_health ?? '',
    serviceValue: raw.serviceValue ?? raw.service_value ?? '',
    notes: raw.notes ?? '',
    closureNotes: raw.closureNotes ?? raw.closure_notes ?? '',
    statuses,
    failCount,
    createdAt,
    updatedAt: raw.updatedAt || raw.updated_at || createdAt,
    closedAt: raw.closedAt || raw.closed_at || null,
    date: createdAt,
  }
}

function loadSavedChecklists() {
  try {
    const raw = localStorage.getItem(CHECKLIST_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((item, idx) => normalizeOrder(item, idx + 1)) : []
  } catch {
    return []
  }
}

function persistLocalOrders(list) {
  try {
    localStorage.setItem(CHECKLIST_HISTORY_KEY, JSON.stringify(list))
  } catch {
    // ignora erro de quota
  }
}

export default function ChecklistView({ onAskAI }) {
  const { items: devices } = useResource('/devices')

  // Estado da O.S. atual no formulário
  const [editingId, setEditingId] = useState(null)
  const [osStatus, setOsStatus] = useState('aberta')
  const [stage, setStage] = useState('Entrada (Pré-Reparo)')
  const [osNumber, setOsNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [imei, setImei] = useState('')
  const [benchCurrent, setBenchCurrent] = useState('')
  const [batteryHealth, setBatteryHealth] = useState('')
  const [serviceValue, setServiceValue] = useState('')
  const [notes, setNotes] = useState('')
  const [closureNotes, setClosureNotes] = useState('')
  const [statuses, setStatuses] = useState(defaultStatuses)

  // Feedback e listas
  const [copied, setCopied] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState(null)
  const [savedHistory, setSavedHistory] = useState(loadSavedChecklists)
  const [filterStatus, setFilterStatus] = useState('todas')
  const [searchOs, setSearchOs] = useState('')

  // Pasta Local no PC & Nuvem
  const [dirHandle, setDirHandle] = useState(null)
  const [linkedFolderName, setLinkedFolderName] = useState(
    () => localStorage.getItem(LOCAL_FOLDER_NAME_KEY) || '',
  )
  const [serverFolderPath, setServerFolderPath] = useState(
    'C:\\Users\\bruno\\Documents\\Wiki_Bancada_OS',
  )
  const [syncingCloud, setSyncingCloud] = useState(false)
  const restoreInputRef = useRef(null)

  useEffect(() => {
    let active = true
    api
      .get('/service_orders/storage_info')
      .then((res) => {
        if (active && res.data?.local_folder_path) {
          setServerFolderPath(res.data.local_folder_path)
        }
      })
      .catch(() => {})

    api
      .get('/service_orders')
      .then((res) => {
        if (!active || !Array.isArray(res.data) || res.data.length === 0) return
        setSavedHistory((localList) => {
          const mapByOs = new Map()
          for (const item of localList) {
            mapByOs.set(`${item.osNumber}::${item.deviceModel}`, item)
          }
          for (const srv of res.data) {
            const norm = normalizeOrder({ ...srv, serverId: srv.id })
            const key = `${norm.osNumber}::${norm.deviceModel}`
            if (!mapByOs.has(key)) {
              mapByOs.set(key, norm)
            } else {
              const existing = mapByOs.get(key)
              mapByOs.set(key, { ...existing, serverId: srv.id })
            }
          }
          const merged = Array.from(mapByOs.values())
          persistLocalOrders(merged)
          return merged
        })
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const matchedDevice = devices.find(
    (d) => `${d.marca} ${d.modelo}`.toLowerCase() === deviceModel.trim().toLowerCase(),
  )

  function showNotice(msg) {
    setFeedbackBanner(msg)
    setTimeout(() => setFeedbackBanner((cur) => (cur === msg ? null : cur)), 5000)
  }

  function setItemStatus(id, status) {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }

  function markAllAs(status) {
    setStatuses(Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.id, status])))
  }

  function nextOsCode(list = savedHistory) {
    const nums = list
      .map((o) => {
        const m = String(o.osNumber || '').match(/(\d+)/)
        return m ? Number(m[1]) : 0
      })
      .filter((n) => n > 0 && n < 999999)
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0
    return `OS-${String(maxNum + 1).padStart(4, '0')}`
  }

  function resetForm() {
    setEditingId(null)
    setOsStatus('aberta')
    setStage('Entrada (Pré-Reparo)')
    setOsNumber('')
    setClientName('')
    setClientPhone('')
    setDeviceModel('')
    setImei('')
    setBenchCurrent('')
    setBatteryHealth('')
    setServiceValue('')
    setNotes('')
    setClosureNotes('')
    setStatuses(defaultStatuses())
    setCopied(false)
  }

  const failingItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'defeito')
  const untestedItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'nao_testado')
  const okItems = CHECKLIST_ITEMS.filter((i) => statuses[i.id] === 'ok')

  function buildOrderObjectFromForm(overrideStatus = null, overrideStage = null) {
    const existing = editingId ? savedHistory.find((e) => e.id === editingId) : null
    const { ts, br: nowStr } = getNowInfo()
    const finalStatus = overrideStatus || osStatus || 'aberta'
    const finalStage =
      overrideStage || (finalStatus === 'encerrada' ? 'Saída (Pós-Reparo)' : stage)
    const finalOsNumber = osNumber.trim() || existing?.osNumber || nextOsCode()

    return normalizeOrder({
      id: existing?.id || ts,
      serverId: existing?.serverId || null,
      osNumber: finalOsNumber,
      status: finalStatus,
      stage: finalStage,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      deviceModel: deviceModel.trim() || 'Aparelho sem modelo',
      imei: imei.trim(),
      benchCurrent: benchCurrent.trim(),
      batteryHealth: batteryHealth.trim(),
      serviceValue: serviceValue.trim(),
      notes: notes.trim(),
      closureNotes: closureNotes.trim(),
      statuses,
      createdAt: existing?.createdAt || nowStr,
      updatedAt: nowStr,
      closedAt: finalStatus === 'encerrada' ? existing?.closedAt || nowStr : null,
    })
  }

  function buildReportText(orderObj = null) {
    const ord = orderObj || buildOrderObjectFromForm()
    const statusText =
      ord.status === 'encerrada' ? '🔒 ENCERRADA / CONCLUÍDA' : '🟢 ABERTA EM BANCADA'
    const header = [
      `📋 *ORDEM DE SERVIÇO E LAUDO DE BANCADA*`,
      `🔢 *O.S.:* ${ord.osNumber} (${statusText})`,
      `📌 *Etapa:* ${ord.stage}`,
      ord.clientName ? `👤 *Cliente:* ${ord.clientName}` : null,
      ord.clientPhone ? `📞 *Contato:* ${ord.clientPhone}` : null,
      `📱 *Aparelho:* ${ord.deviceModel}`,
      ord.imei ? `🏷️ *IMEI / Série:* ${ord.imei}` : null,
      ord.benchCurrent ? `⚡ *Consumo na Fonte:* ${ord.benchCurrent}` : null,
      ord.batteryHealth ? `🔋 *Saúde da Bateria:* ${ord.batteryHealth}` : null,
      ord.serviceValue ? `💰 *Valor / Orçamento:* R$ ${ord.serviceValue}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const lines = CHECKLIST_ITEMS.map(
      (item) => `• ${item.label}: *${STATUS_LABELS[ord.statuses[item.id] || 'ok']}*`,
    ).join('\n')

    const notesBlock = ord.notes ? `\n\n📝 *Observações Técnicas / Entrada:*\n${ord.notes}` : ''
    const closeBlock = ord.closureNotes
      ? `\n\n✅ *Serviço Executado / Encerramento:*\n${ord.closureNotes}`
      : ''
    return `${header}\n\n${lines}${notesBlock}${closeBlock}`
  }

  async function writeOrderToLinkedDirectory(orderObj, allOrdersList) {
    if (!dirHandle) return false
    try {
      const safeOs = orderObj.osNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
      const safeDev = orderObj.deviceModel.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28)
      const baseName = `${safeOs}_${safeDev}`

      // 1) Arquivo JSON da O.S.
      const jsonHandle = await dirHandle.getFileHandle(`${baseName}.json`, { create: true })
      const jsonWritable = await jsonHandle.createWritable()
      await jsonWritable.write(JSON.stringify(orderObj, null, 2))
      await jsonWritable.close()

      // 2) Arquivo TXT do Laudo
      const txtHandle = await dirHandle.getFileHandle(`${baseName}_Laudo.txt`, { create: true })
      const txtWritable = await txtHandle.createWritable()
      await txtWritable.write(buildReportText(orderObj))
      await txtWritable.close()

      // 3) Arquivo PDF do Laudo
      const pdfBytes = generateOsPdfBytes(orderObj, CHECKLIST_ITEMS, STATUS_LABELS)
      const pdfHandle = await dirHandle.getFileHandle(`${baseName}_Laudo.pdf`, { create: true })
      const pdfWritable = await pdfHandle.createWritable()
      await pdfWritable.write(pdfBytes)
      await pdfWritable.close()

      // 4) Pacote .RAR de backup atualizado na pasta
      const rarBytes = createRarBackupBytes(allOrdersList)
      const rarHandle = await dirHandle.getFileHandle('Backup_Automatico_OS_Bancada.rar', {
        create: true,
      })
      const rarWritable = await rarHandle.createWritable()
      await rarWritable.write(rarBytes)
      await rarWritable.close()
      return true
    } catch {
      return false
    }
  }

  async function saveOrderRecord(overrideStatus = null, overrideStage = null) {
    const orderObj = buildOrderObjectFromForm(overrideStatus, overrideStage)
    setOsNumber(orderObj.osNumber)
    setOsStatus(orderObj.status)
    setStage(orderObj.stage)
    setEditingId(orderObj.id)

    let nextList
    const exists = savedHistory.some((e) => e.id === orderObj.id)
    if (exists) {
      nextList = savedHistory.map((e) => (e.id === orderObj.id ? orderObj : e))
    } else {
      nextList = [orderObj, ...savedHistory]
    }
    setSavedHistory(nextList)
    persistLocalOrders(nextList)

    // Salva também no Servidor / Banco em Nuvem (se disponível)
    const apiPayload = {
      os_number: orderObj.osNumber,
      status: orderObj.status,
      stage: orderObj.stage,
      client_name: orderObj.clientName || null,
      client_phone: orderObj.clientPhone || null,
      device_model: orderObj.deviceModel,
      imei: orderObj.imei || null,
      bench_current: orderObj.benchCurrent || null,
      battery_health: orderObj.batteryHealth || null,
      service_value: orderObj.serviceValue || null,
      notes: orderObj.notes || null,
      closure_notes: orderObj.closureNotes || null,
      statuses: orderObj.statuses,
      created_at: orderObj.createdAt,
      updated_at: orderObj.updatedAt,
      closed_at: orderObj.closedAt,
    }
    try {
      if (orderObj.serverId) {
        await api.put(`/service_orders/${orderObj.serverId}`, apiPayload)
      } else {
        const res = await api.post('/service_orders', apiPayload)
        if (res?.data?.id) {
          const withServer = nextList.map((e) =>
            e.id === orderObj.id ? { ...e, serverId: res.data.id } : e,
          )
          setSavedHistory(withServer)
          persistLocalOrders(withServer)
        }
      }
    } catch {
      // continua salvo localmente mesmo offline
    }

    await writeOrderToLinkedDirectory(orderObj, nextList)
    return orderObj
  }

  async function handleOpenOrSaveOs() {
    const wasEditing = Boolean(editingId)
    const saved = await saveOrderRecord(osStatus, stage)
    showNotice(
      wasEditing
        ? `✓ Alterações da ${saved.osNumber} (${saved.deviceModel}) salvas com sucesso!`
        : `✓ Ordem de Serviço ${saved.osNumber} (${saved.deviceModel}) aberta e salva!`,
    )
  }

  async function handleCloseOs(targetEntry = null) {
    if (targetEntry && targetEntry.id !== editingId) {
      const { br: nowBr } = getNowInfo()
      const updated = normalizeOrder({
        ...targetEntry,
        status: 'encerrada',
        stage: 'Saída (Pós-Reparo)',
        closedAt: nowBr,
        updatedAt: nowBr,
      })
      const nextList = savedHistory.map((e) => (e.id === updated.id ? updated : e))
      setSavedHistory(nextList)
      persistLocalOrders(nextList)
      if (updated.serverId) {
        api
          .put(`/service_orders/${updated.serverId}`, {
            os_number: updated.osNumber,
            status: 'encerrada',
            stage: updated.stage,
            client_name: updated.clientName || null,
            client_phone: updated.clientPhone || null,
            device_model: updated.deviceModel,
            imei: updated.imei || null,
            bench_current: updated.benchCurrent || null,
            battery_health: updated.batteryHealth || null,
            service_value: updated.serviceValue || null,
            notes: updated.notes || null,
            closure_notes: updated.closureNotes || null,
            statuses: updated.statuses,
            created_at: updated.createdAt,
            closed_at: updated.closedAt,
          })
          .catch(() => {})
      }
      await writeOrderToLinkedDirectory(updated, nextList)
      showNotice(`🔒 Ordem de Serviço ${updated.osNumber} encerrada com sucesso!`)
      return
    }

    const saved = await saveOrderRecord('encerrada', 'Saída (Pós-Reparo)')
    showNotice(`🔒 Ordem de Serviço ${saved.osNumber} (${saved.deviceModel}) encerrada!`)
  }

  async function handleReopenOs(targetEntry = null) {
    if (targetEntry && targetEntry.id !== editingId) {
      const { br: nowBr } = getNowInfo()
      const updated = normalizeOrder({
        ...targetEntry,
        status: 'aberta',
        closedAt: null,
        updatedAt: nowBr,
      })
      const nextList = savedHistory.map((e) => (e.id === updated.id ? updated : e))
      setSavedHistory(nextList)
      persistLocalOrders(nextList)
      showNotice(`🔓 Ordem de Serviço ${updated.osNumber} reaberta para edição!`)
      return
    }
    const saved = await saveOrderRecord('aberta', stage)
    showNotice(`🔓 Ordem de Serviço ${saved.osNumber} reaberta em bancada!`)
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

  function handleGeneratePdf(targetEntry = null) {
    const ord = targetEntry || buildOrderObjectFromForm()
    const { filename } = downloadOsPdf(ord, CHECKLIST_ITEMS, STATUS_LABELS)
    showNotice(`📄 Laudo PDF "${filename}" gerado e enviado para sua pasta de Downloads!`)
  }

  function handleLoadEntry(entry) {
    setEditingId(entry.id)
    setOsStatus(entry.status || 'aberta')
    setStage(entry.stage || 'Entrada (Pré-Reparo)')
    setOsNumber(entry.osNumber || '')
    setClientName(entry.clientName || '')
    setClientPhone(entry.clientPhone || '')
    setDeviceModel(entry.deviceModel || '')
    setImei(entry.imei || '')
    setBenchCurrent(entry.benchCurrent || '')
    setBatteryHealth(entry.batteryHealth || '')
    setServiceValue(entry.serviceValue || '')
    setNotes(entry.notes || '')
    setClosureNotes(entry.closureNotes || '')
    setStatuses({ ...defaultStatuses(), ...(entry.statuses || {}) })
    showNotice(`✏️ Editando a Ordem de Serviço ${entry.osNumber} (${entry.deviceModel})`)
  }

  function handleDeleteEntry(entry) {
    const next = savedHistory.filter((e) => e.id !== entry.id)
    setSavedHistory(next)
    persistLocalOrders(next)
    if (entry.serverId) {
      api.delete(`/service_orders/${entry.serverId}`).catch(() => {})
    }
    if (editingId === entry.id) {
      resetForm()
    }
  }

  async function handleChooseLocalFolder() {
    if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(handle)
        setLinkedFolderName(handle.name)
        localStorage.setItem(LOCAL_FOLDER_NAME_KEY, handle.name)
        if (savedHistory.length > 0) {
          await writeOrderToLinkedDirectory(savedHistory[0], savedHistory)
        }
        showNotice(
          `📁 Pasta "${handle.name}" conectada! Todas as O.S. e PDFs serão salvos diretamente nela.`,
        )
        return
      } catch {
        // usuário cancelou
        return
      }
    }
    showNotice(
      `💡 Seu navegador salva os arquivos diretamente na pasta "Downloads" do Windows e em ${serverFolderPath}.`,
    )
  }

  function handleDownloadBackupRar() {
    const listToExport =
      savedHistory.length > 0 ? savedHistory : [buildOrderObjectFromForm()]
    const rarBytes = createRarBackupBytes(listToExport)
    const { isoDate: dateTag } = getNowInfo()
    const filename = `Backup_OS_WikiBancada_${dateTag}.rar`
    triggerBrowserDownload(rarBytes, filename, 'application/x-rar-compressed')
    showNotice(`📦 Arquivo de backup "${filename}" (${listToExport.length} O.S.) salvo no seu computador!`)
  }

  async function handleCloudBackup(provider) {
    const listToExport =
      savedHistory.length > 0 ? savedHistory : [buildOrderObjectFromForm()]
    const rarBytes = createRarBackupBytes(listToExport)
    const { isoDate: dateTag } = getNowInfo()
    const filename = `Backup_OS_WikiBancada_${dateTag}.rar`

    if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Arquivo de Backup RAR (.rar)',
              accept: { 'application/x-rar-compressed': ['.rar'] },
            },
          ],
        })
        const writable = await fileHandle.createWritable()
        await writable.write(rarBytes)
        await writable.close()
        showNotice(
          `☁️ Backup "${filename}" salvo diretamente na pasta escolhida (${provider.name})!`,
        )
        return
      } catch {
        // fallback para download + abrir nuvem
      }
    }

    triggerBrowserDownload(rarBytes, filename, 'application/x-rar-compressed')
    if (typeof window !== 'undefined' && window.open) {
      window.open(provider.url, '_blank', 'noopener,noreferrer')
    }
    showNotice(
      `☁️ Backup "${filename}" baixado! Arraste-o para a janela do ${provider.name} que foi aberta.`,
    )
  }

  async function handleSyncSystemCloud() {
    setSyncingCloud(true)
    try {
      const payloadOrders = savedHistory.map((o) => ({
        os_number: o.osNumber,
        status: o.status,
        stage: o.stage,
        client_name: o.clientName || null,
        client_phone: o.clientPhone || null,
        device_model: o.deviceModel,
        imei: o.imei || null,
        bench_current: o.benchCurrent || null,
        battery_health: o.batteryHealth || null,
        service_value: o.serviceValue || null,
        notes: o.notes || null,
        closure_notes: o.closureNotes || null,
        statuses: o.statuses,
        created_at: o.createdAt,
        updated_at: o.updatedAt,
        closed_at: o.closedAt,
      }))
      if (payloadOrders.length > 0) {
        await api.post('/service_orders/restore', { orders: payloadOrders })
      }
      const res = await api.get('/service_orders')
      if (Array.isArray(res.data)) {
        const normalized = res.data.map((srv, idx) =>
          normalizeOrder({ ...srv, serverId: srv.id }, idx + 1),
        )
        if (normalized.length > 0) {
          setSavedHistory(normalized)
          persistLocalOrders(normalized)
        }
      }
      showNotice('☁️ Todas as Ordens de Serviço foram sincronizadas com o Banco na Nuvem!')
    } catch {
      showNotice('⚠️ Nuvem indisponível no momento — suas O.S. continuam salvas localmente no PC.')
    } finally {
      setSyncingCloud(false)
    }
  }

  async function handleRestoreFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const restoredRaw = await parseBackupFile(file)
      const normalizedRestored = restoredRaw.map((item, idx) =>
        normalizeOrder(item, idx + 1),
      )
      setSavedHistory((current) => {
        const byKey = new Map()
        for (const item of current) {
          byKey.set(`${item.osNumber}::${item.deviceModel}`, item)
        }
        for (const item of normalizedRestored) {
          byKey.set(`${item.osNumber}::${item.deviceModel}`, item)
        }
        const merged = Array.from(byKey.values())
        persistLocalOrders(merged)
        return merged
      })

      api
        .post('/service_orders/restore', {
          orders: normalizedRestored.map((o) => ({
            os_number: o.osNumber,
            status: o.status,
            stage: o.stage,
            client_name: o.clientName || null,
            client_phone: o.clientPhone || null,
            device_model: o.deviceModel,
            imei: o.imei || null,
            bench_current: o.benchCurrent || null,
            battery_health: o.batteryHealth || null,
            service_value: o.serviceValue || null,
            notes: o.notes || null,
            closure_notes: o.closureNotes || null,
            statuses: o.statuses,
            created_at: o.createdAt,
            updated_at: o.updatedAt,
            closed_at: o.closedAt,
          })),
        })
        .catch(() => {})

      showNotice(
        `♻️ Backup restaurado com sucesso! ${normalizedRestored.length} Ordem(ns) de Serviço carregadas.`,
      )
    } catch (err) {
      showNotice(`Erro ao restaurar backup: ${err.message || 'arquivo inválido'}`)
    }
  }

  function handleDiagnoseWithAI() {
    const dev = deviceModel.trim() || 'smartphone na bancada'
    const fails = failingItems.map((i) => i.label).join(', ')
    const extra = [
      imei.trim() ? `IMEI: ${imei.trim()}.` : '',
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

  const filteredHistory = savedHistory.filter((entry) => {
    if (filterStatus === 'abertas' && entry.status === 'encerrada') return false
    if (filterStatus === 'encerradas' && entry.status !== 'encerrada') return false
    if (!searchOs.trim()) return true
    const q = searchOs.toLowerCase()
    return (
      (entry.osNumber || '').toLowerCase().includes(q) ||
      (entry.deviceModel || '').toLowerCase().includes(q) ||
      (entry.clientName || '').toLowerCase().includes(q) ||
      (entry.imei || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {feedbackBanner && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-2xs"
        >
          {feedbackBanner}
        </div>
      )}

      {/* Painel Claro: Onde salva no PC + Central de Backup .RAR e Nuvem */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              📁 Pasta onde suas Ordens de Serviço (O.S.) ficam salvas no Computador
            </h3>
            <p className="text-xs text-slate-600">
              Pasta padrão no computador:{' '}
              <code className="rounded bg-white px-2 py-0.5 font-mono text-xs font-semibold text-blue-800 border border-blue-200">
                {dirHandle
                  ? `Pasta Conectada no PC: ${linkedFolderName} (Gravação Automática de PDF + JSON + RAR)`
                  : `${serverFolderPath}  (e na pasta "Downloads" ao baixar PDF/RAR)`}
              </code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleChooseLocalFolder} className={ghostBtn}>
              📂 {dirHandle ? `Trocar Pasta (${linkedFolderName})` : 'Escolher Pasta no Computador'}
            </button>
            <button type="button" onClick={handleDownloadBackupRar} className={primaryBtn}>
              📦 Baixar Backup Local (.rar)
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".rar,.zip,.json"
              aria-label="Selecionar arquivo de backup para restaurar"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className={ghostBtn}
            >
              ♻️ Restaurar Backup (.rar / .json)
            </button>
          </div>
        </div>

        <div className="border-t border-blue-200/70 pt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
          <span className="font-semibold text-slate-700">
            ☁️ Backup e Restauração nos Principais Serviços de Nuvem:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={syncingCloud}
              onClick={handleSyncSystemCloud}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
            >
              {syncingCloud ? 'Sincronizando...' : '🔄 Nuvem do Sistema (Sincronizar / Restaurar)'}
            </button>
            {CLOUD_PROVIDERS.map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => handleCloudBackup(prov)}
                title={prov.hint}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                {prov.icon} Backup no {prov.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário Principal de Ordem de Serviço (Abrir, Editar, Encerrar) e Checklist */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">
                ✅ Ordem de Serviço e Checklist de Bancada
              </h2>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  osStatus === 'encerrada'
                    ? 'bg-slate-800 text-white'
                    : editingId
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {osStatus === 'encerrada'
                  ? `🔒 O.S. ENCERRADA (${osNumber || 'Concluída'})`
                  : editingId
                    ? `✏️ EDITANDO ${osNumber || 'O.S.'} (ABERTA)`
                    : '🟢 NOVA O.S. (ABERTURA)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Abra uma O.S. na entrada do aparelho, edite o andamento na bancada, gere o Laudo em PDF ou WhatsApp e encerre a O.S. na entrega.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editingId && (
              <button type="button" onClick={resetForm} className={ghostBtn}>
                ➕ Nova O.S. em Branco
              </button>
            )}
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="chk-os" className="mb-1 block text-xs font-medium text-slate-700">
              Nº da Ordem de Serviço (O.S.)
            </label>
            <input
              id="chk-os"
              value={osNumber}
              onChange={(e) => setOsNumber(e.target.value)}
              placeholder="Automático (ex: OS-0001)"
              className={inputClass}
            />
          </div>

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
            <label htmlFor="chk-imei" className="mb-1 block text-xs font-medium text-slate-700">
              IMEI do Aparelho (*#06#)
            </label>
            <input
              id="chk-imei"
              value={imei}
              maxLength={40}
              onChange={(e) => setImei(e.target.value)}
              placeholder="Ex: 354891101234567"
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
              placeholder="Nome do cliente"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="chk-phone" className="mb-1 block text-xs font-medium text-slate-700">
              WhatsApp / Telefone do Cliente
            </label>
            <input
              id="chk-phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
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
              placeholder="Ex: 0.00A standby / 1.8A carga"
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

          <div>
            <label htmlFor="chk-value" className="mb-1 block text-xs font-medium text-slate-700">
              Valor / Orçamento (R$)
            </label>
            <input
              id="chk-value"
              value={serviceValue}
              onChange={(e) => setServiceValue(e.target.value)}
              placeholder="Ex: 350,00"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            Atalhos rápidos de preenchimento do checklist:
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => markAllAs('ok')} className={ghostBtn}>
              Tudo ✅ OK
            </button>
            <button type="button" onClick={() => markAllAs('nao_testado')} className={ghostBtn}>
              Aparelho Apagado ⚠️
            </button>
            <button type="button" onClick={resetForm} className={ghostBtn}>
              Limpar Campos
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="chk-notes" className="mb-1 block text-xs font-medium text-slate-700">
              Observações de Entrada / Relato do Cliente / Estado Físico
            </label>
            <textarea
              id="chk-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Tampa traseira trincada no canto inferior, cliente relatou queda na água..."
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="chk-closure" className="mb-1 block text-xs font-medium text-slate-700">
              Serviço Executado / Laudo de Encerramento e Garantia
            </label>
            <textarea
              id="chk-closure"
              rows={3}
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              placeholder="Ex: Troca da subplaca original com NTC e desoxidação. Garantia de 90 dias no serviço executado."
              className={inputClass}
            />
          </div>
        </div>

        {/* Barra de Ações: Abrir/Editar/Encerrar O.S., Copiar WhatsApp, Gerar PDF e IA */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleOpenOrSaveOs} className={primaryBtn}>
                {editingId ? '💾 Salvar Edição da O.S.' : '🟢 Abrir Ordem de Serviço (Salvar no Histórico Local)'}
              </button>

              {osStatus !== 'encerrada' ? (
                <button
                  type="button"
                  onClick={() => handleCloseOs(null)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  🔒 Encerrar O.S.
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReopenOs(null)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  🔓 Reabrir O.S.
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDiagnoseWithAI}
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              🤖 Diagnosticar {failingItems.length > 0 ? `(${failingItems.length} defeito${failingItems.length > 1 ? 's' : ''})` : 'Aparelho'} na IA
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={handleCopyReport} className={ghostBtn}>
              {copied ? '✓ Laudo Copiado para o WhatsApp!' : '📋 Copiar Laudo (WhatsApp / O.S.)'}
            </button>
            <button
              type="button"
              onClick={() => handleGeneratePdf(null)}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              📄 Gerar Laudo em PDF
            </button>
          </div>
        </div>
      </section>

      {/* Painel de Ordens de Serviço Salvas (Abertas e Encerradas) */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              🗂️ Ordens de Serviço da Bancada ({filteredHistory.length})
            </h3>
            <p className="text-xs text-slate-500">
              Clique em <strong>Editar O.S.</strong> para continuar o atendimento, <strong>Gerar PDF</strong> para baixar o laudo ou <strong>Encerrar O.S.</strong> na conclusão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'todas', label: `Todas (${savedHistory.length})` },
              {
                id: 'abertas',
                label: `🟢 Abertas (${savedHistory.filter((o) => o.status !== 'encerrada').length})`,
              },
              {
                id: 'encerradas',
                label: `🔒 Encerradas (${savedHistory.filter((o) => o.status === 'encerrada').length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filterStatus === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <input
              type="search"
              value={searchOs}
              onChange={(e) => setSearchOs(e.target.value)}
              placeholder="Buscar O.S., cliente, IMEI ou modelo..."
              className={`${inputClass} sm:w-64`}
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nenhuma Ordem de Serviço encontrada neste filtro. Preencha os dados acima e clique em <strong>🟢 Abrir Ordem de Serviço</strong>.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHistory.map((entry) => {
              const isClosed = entry.status === 'encerrada'
              return (
                <article
                  key={entry.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 shadow-2xs text-xs space-y-3 ${
                    editingId === entry.id
                      ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {entry.osNumber} — {entry.deviceModel}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isClosed
                            ? 'bg-slate-800 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isClosed ? '🔒 Encerrada' : '🟢 Aberta'}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {entry.clientName ? `👤 ${entry.clientName}` : '👤 Cliente não informado'}
                      {entry.clientPhone ? ` · 📞 ${entry.clientPhone}` : ''}
                    </p>
                    {entry.imei && (
                      <p className="font-mono text-[11px] text-slate-600">
                        🏷️ IMEI: <strong>{entry.imei}</strong>
                      </p>
                    )}
                    <p className="text-slate-400 text-[11px]">
                      Aberta em: {entry.createdAt}
                      {entry.closedAt ? ` · Encerrada: ${entry.closedAt}` : ''}
                    </p>
                    <p className="font-medium text-slate-700 pt-0.5">
                      {entry.failCount > 0 ? (
                        <span className="text-red-600">❌ {entry.failCount} item(ns) com defeito</span>
                      ) : (
                        <span className="text-emerald-700">✅ Todos os itens OK</span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadEntry(entry)}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        ✏️ Editar O.S.
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGeneratePdf(entry)}
                        className="font-semibold text-red-600 hover:underline"
                      >
                        📄 PDF
                      </button>
                      {!isClosed ? (
                        <button
                          type="button"
                          onClick={() => handleCloseOs(entry)}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          🔒 Encerrar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReopenOs(entry)}
                          className="font-semibold text-amber-700 hover:underline"
                        >
                          🔓 Reabrir
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry)}
                      className="text-slate-400 hover:text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
