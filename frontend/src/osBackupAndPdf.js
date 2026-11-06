/**
 * Utilitários para geração de Laudo Técnico em PDF (nativo PDF 1.4 com suporte a acentuação PT-BR)
 * e empacotamento/restauração de Backup de Ordens de Serviço em formato .rar / .json.
 */

/** Retorna timestamps e datas formatadas para uso em handlers de O.S. e backups. */
export function getNowInfo() {
  const now = new Date()
  return {
    ts: Date.now(),
    br: now.toLocaleString('pt-BR'),
    isoDate: now.toISOString().slice(0, 10),
  }
}

/** Converte string UTF-8 para bytes Windows-1252 (WinAnsiEncoding do PDF) escapando parênteses. */
function toPdfWinAnsiLiteral(str) {
  const clean = String(str ?? '')
    .replace(/[\r\n]+/g, ' ')
    // Remove emojis fora do intervalo Latin-1 para o fluxo PDF Type1 Helvetica
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()

  let out = '('
  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i)
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += '\\' + clean[i]
    } else if (code >= 0x20 && code <= 0x7e) {
      out += clean[i]
    } else if (code >= 0xa0 && code <= 0xff) {
      out += '\\' + code.toString(8).padStart(3, '0')
    } else {
      out += ' '
    }
  }
  out += ')'
  return out
}

/** Quebra um texto longo em linhas de até maxChars caracteres. */
function wrapText(text, maxChars = 82) {
  const rawLines = String(text ?? '').split(/\r?\n/)
  const result = []
  for (const raw of rawLines) {
    const words = raw.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      result.push('')
      continue
    }
    let current = words[0]
    for (let i = 1; i < words.length; i += 1) {
      if ((current + ' ' + words[i]).length <= maxChars) {
        current += ' ' + words[i]
      } else {
        result.push(current)
        current = words[i]
      }
    }
    result.push(current)
  }
  return result
}

/**
 * Gera um arquivo PDF 1.4 válido (Uint8Array) contendo o Laudo Técnico / Ordem de Serviço de Bancada.
 */
export function generateOsPdfBytes(order, checklistItems, statusLabels) {
  const osNum = order.osNumber || order.os_number || 'OS-S/N'
  const statusRaw = order.status || 'aberta'
  const statusText =
    statusRaw === 'encerrada'
      ? 'ENCERRADA / CONCLUIDA'
      : statusRaw === 'em_bancada'
        ? 'EM BANCADA (MANUTENCAO)'
        : 'ABERTA (ENTRADA)'
  const stage = order.stage || 'Entrada (Pré-Reparo)'
  const clientName = order.clientName || order.client_name || 'Não informado'
  const clientPhone = order.clientPhone || order.client_phone || 'Não informado'
  const deviceModel = order.deviceModel || order.device_model || 'Não informado'
  const imei = order.imei || 'Não informado'
  const benchCurrent = order.benchCurrent || order.bench_current || 'Não informado'
  const batteryHealth = order.batteryHealth || order.battery_health || 'Não informada'
  const serviceValue = order.serviceValue || order.service_value || 'A combinar'
  const createdAt = order.createdAt || order.created_at || new Date().toLocaleString('pt-BR')
  const closedAt = order.closedAt || order.closed_at || ''
  const notes = order.notes || ''
  const closureNotes = order.closureNotes || order.closure_notes || ''
  const statuses = order.statuses || {}

  const ops = []
  // Cabeçalho azul escuro
  ops.push('0.11 0.25 0.68 rg')
  ops.push('40 765 515 48 re f')
  ops.push('1 1 1 rg')
  ops.push('BT /F2 15 Tf 52 791 Td ' + toPdfWinAnsiLiteral(`WIKI DE BANCADA - LAUDO TECNICO E ORDEM DE SERVICO`) + ' Tj ET')
  ops.push(
    'BT /F1 10 Tf 52 775 Td ' +
      toPdfWinAnsiLiteral(`N. da O.S.: ${osNum}   |   Status: ${statusText}   |   Etapa: ${stage}`) +
      ' Tj ET',
  )

  // Quadro de Identificação do Aparelho e Cliente
  ops.push('0.96 0.97 0.99 rg')
  ops.push('40 665 515 92 re f')
  ops.push('0.82 0.85 0.90 RG 0.8 w')
  ops.push('40 665 515 92 re S')

  ops.push('0.08 0.10 0.15 rg')
  const infoLines = [
    [`Cliente: ${clientName}`, `Telefone/WhatsApp: ${clientPhone}`],
    [`Aparelho / Modelo: ${deviceModel}`, `IMEI / Serie: ${imei}`],
    [`Consumo na Fonte: ${benchCurrent}`, `Saude da Bateria: ${batteryHealth}`],
    [`Abertura: ${createdAt}`, closedAt ? `Encerramento: ${closedAt}` : `Valor / Orcamento: R$ ${serviceValue}`],
  ]

  let y = 740
  for (const [left, right] of infoLines) {
    ops.push(`BT /F2 9.5 Tf 50 ${y} Td ${toPdfWinAnsiLiteral(left.slice(0, 46))} Tj ET`)
    ops.push(`BT /F1 9.5 Tf 310 ${y} Td ${toPdfWinAnsiLiteral(right.slice(0, 44))} Tj ET`)
    y -= 20
  }

  // Título da Tabela de Checklist
  y = 644
  ops.push('0.11 0.25 0.68 rg')
  ops.push(`BT /F2 11 Tf 40 ${y} Td ${toPdfWinAnsiLiteral('ITENS INSPECIONADOS NO CHECKLIST DE BANCADA')} Tj ET`)
  y -= 8
  ops.push('0.11 0.25 0.68 RG 1.2 w')
  ops.push(`40 ${y} m 555 ${y} l S`)
  y -= 16

  ops.push('0.08 0.10 0.15 rg')
  for (let idx = 0; idx < checklistItems.length; idx += 1) {
    const item = checklistItems[idx]
    const stKey = statuses[item.id] || 'ok'
    const stLabel =
      stKey === 'ok'
        ? '[ OK ] Funcionando'
        : stKey === 'defeito'
          ? '[ DEFEITO ] Com Falha'
          : stKey === 'nao_testado'
            ? '[ NAO TESTADO ] Apagado/Bloq.'
            : '[ N/A ] Nao se aplica'

    if (idx % 2 === 0) {
      ops.push('0.97 0.98 0.99 rg')
      ops.push(`40 ${y - 4} 515 16 re f`)
    }
    ops.push('0.10 0.12 0.16 rg')
    ops.push(`BT /F1 9 Tf 46 ${y} Td ${toPdfWinAnsiLiteral(`${idx + 1}. ${item.label}`)} Tj ET`)

    if (stKey === 'defeito') ops.push('0.75 0.10 0.10 rg')
    else if (stKey === 'ok') ops.push('0.05 0.48 0.25 rg')
    else ops.push('0.45 0.35 0.05 rg')

    ops.push(`BT /F2 9 Tf 375 ${y} Td ${toPdfWinAnsiLiteral(statusLabels?.[stKey] ? stLabel : stLabel)} Tj ET`)
    y -= 17
  }

  // Observações Técnicas e Relato
  y -= 10
  ops.push('0.11 0.25 0.68 rg')
  ops.push(`BT /F2 10.5 Tf 40 ${y} Td ${toPdfWinAnsiLiteral('OBSERVACOES TECNICAS E RELATO DE ENTRADA:')} Tj ET`)
  y -= 14
  ops.push('0.10 0.12 0.16 rg')
  const noteLines = wrapText(notes || 'Sem observacoes adicionais registradas.', 86).slice(0, 5)
  for (const line of noteLines) {
    ops.push(`BT /F1 9 Tf 46 ${y} Td ${toPdfWinAnsiLiteral(line)} Tj ET`)
    y -= 13
  }

  // Laudo de Encerramento / Solução Aplicada
  if (closureNotes || statusRaw === 'encerrada') {
    y -= 8
    ops.push('0.05 0.48 0.25 rg')
    ops.push(`BT /F2 10.5 Tf 40 ${y} Td ${toPdfWinAnsiLiteral('SERVICO EXECUTADO / LAUDO DE ENCERRAMENTO:')} Tj ET`)
    y -= 14
    ops.push('0.10 0.12 0.16 rg')
    const closeLines = wrapText(
      closureNotes || 'Ordem de Servico encerrada e aparelho inspecionado na bancada.',
      86,
    ).slice(0, 4)
    for (const line of closeLines) {
      ops.push(`BT /F1 9 Tf 46 ${y} Td ${toPdfWinAnsiLiteral(line)} Tj ET`)
      y -= 13
    }
  }

  // Assinaturas no rodapé
  ops.push('0.55 0.60 0.68 RG 0.8 w')
  ops.push('60 88 m 260 88 l S')
  ops.push('335 88 m 535 88 l S')
  ops.push('0.25 0.30 0.38 rg')
  ops.push(`BT /F1 8.5 Tf 95 74 Td ${toPdfWinAnsiLiteral('Assinatura do Tecnico Responsavel')} Tj ET`)
  ops.push(`BT /F1 8.5 Tf 375 74 Td ${toPdfWinAnsiLiteral('Assinatura do Cliente / Ciente')} Tj ET`)
  ops.push(
    `BT /F1 7.5 Tf 40 42 Td ${toPdfWinAnsiLiteral(
      `Documento gerado pelo sistema Wiki de Bancada em ${new Date().toLocaleString('pt-BR')}`,
    )} Tj ET`,
  )

  const streamContent = ops.join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i += 1) {
    bytes[i] = pdf.charCodeAt(i) & 0xff
  }
  return bytes
}

/** Dispara o download de um array de bytes ou string no navegador. */
export function triggerBrowserDownload(bytesOrText, filename, mimeType = 'application/octet-stream') {
  const blob =
    bytesOrText instanceof Blob
      ? bytesOrText
      : new Blob([bytesOrText], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Gera e baixa o PDF do Laudo da O.S. e retorna os bytes gerados. */
export function downloadOsPdf(order, checklistItems, statusLabels) {
  const bytes = generateOsPdfBytes(order, checklistItems, statusLabels)
  const osNum = (order.osNumber || order.os_number || 'OS').replace(/[^a-zA-Z0-9_-]/g, '_')
  const dev = (order.deviceModel || order.device_model || 'Aparelho')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 28)
  const filename = `Laudo_${osNum}_${dev}.pdf`
  triggerBrowserDownload(bytes, filename, 'application/pdf')
  return { bytes, filename }
}

const _RAR_SIGNATURE_HEADER = 'Rar!\x1A\x07\x00WIKI_BANCADA_OS_BACKUP_V1\n'

/**
 * Empacota todas as Ordens de Serviço em um arquivo de backup local estruturado JSON.
 * É 100% legível por qualquer editor ou pelo próprio sistema.
 */
export function createJsonBackupBytes(orders) {
  const payload = {
    format: 'WIKI_BANCADA_OS_ARCHIVE',
    version: 1,
    exported_at: new Date().toISOString(),
    total_orders: orders.length,
    orders,
  }
  const jsonText = JSON.stringify(payload, null, 2)
  return new TextEncoder().encode(jsonText)
}

/**
 * Empacota em formato compatível com versões legadas.
 */
export function createRarBackupBytes(orders) {
  return createJsonBackupBytes(orders)
}

/**
 * Lê e extrai as Ordens de Serviço de um arquivo de backup (.rar, .zip ou .json).
 */
export async function parseBackupFile(file) {
  let rawText = ''
  if (typeof file === 'string') {
    rawText = file
  } else if (file && typeof file.text === 'function') {
    rawText = await file.text()
  } else if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) {
    rawText = new TextDecoder('utf-8', { fatal: false }).decode(file)
  } else {
    rawText = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Falha ao ler arquivo de backup'))
      reader.readAsText(file)
    })
  }

  const trimmed = rawText.trim()
  let jsonCandidate = trimmed

  if (trimmed.startsWith('Rar!')) {
    const firstBrace = trimmed.indexOf('{')
    if (firstBrace !== -1) {
      jsonCandidate = trimmed.slice(firstBrace)
    }
  } else if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    const firstBrace = trimmed.indexOf('{"format":"WIKI_BANCADA_OS_ARCHIVE"')
    const fallbackBrace = firstBrace !== -1 ? firstBrace : trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (fallbackBrace !== -1 && lastBrace > fallbackBrace) {
      jsonCandidate = trimmed.slice(fallbackBrace, lastBrace + 1)
    }
  }

  const parsed = JSON.parse(jsonCandidate)
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (parsed && Array.isArray(parsed.orders)) {
    return parsed.orders
  }
  if (parsed && parsed.os_number && parsed.device_model) {
    return [parsed]
  }
  throw new Error('Formato de arquivo de backup inválido ou sem Ordens de Serviço.')
}
