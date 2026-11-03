import { describe, expect, it } from 'vitest'
import { filterBySearch, normalize, parseTags } from './utils'
import { createRarBackupBytes, generateOsPdfBytes, parseBackupFile } from './osBackupAndPdf'

describe('parseTags', () => {
  it('divide, limpa espaços e ignora vazios', () => {
    expect(parseTags('iphone 11,  display , ,calor')).toEqual(['iphone 11', 'display', 'calor'])
  })
  it('aceita null/undefined', () => {
    expect(parseTags(null)).toEqual([])
    expect(parseTags(undefined)).toEqual([])
  })
})

describe('normalize', () => {
  it('remove acentos e caixa', () => {
    expect(normalize('  Diagnóstico ÁLCOOL ')).toBe('diagnostico alcool')
  })
})

describe('filterBySearch', () => {
  const items = [
    { id: 1, nome: 'Tela iPhone 11', categoria: 'Display', notas: null },
    { id: 2, nome: 'Bateria Galaxy', categoria: 'Bateria', notas: 'Atenção ao flex' },
  ]
  it('retorna tudo com busca vazia', () => {
    expect(filterBySearch(items, '  ', ['nome'])).toHaveLength(2)
  })
  it('busca sem diferenciar acento/caixa', () => {
    expect(filterBySearch(items, 'ATENCAO', ['notas']).map((i) => i.id)).toEqual([2])
  })
  it('ignora campos nulos sem quebrar', () => {
    expect(filterBySearch(items, 'display', ['notas', 'categoria']).map((i) => i.id)).toEqual([1])
  })
  it('retorna vazio quando nada casa', () => {
    expect(filterBySearch(items, 'xyz', ['nome'])).toEqual([])
  })
})

describe('osBackupAndPdf', () => {
  const sampleOrder = {
    osNumber: 'OS-0042',
    status: 'aberta',
    stage: 'Entrada (Pré-Reparo)',
    clientName: 'João Teste',
    deviceModel: 'iPhone 13 Pro',
    imei: '354891101234567',
    statuses: { tela_touch: 'ok', biometria_faceid: 'defeito' },
    notes: 'Trinco no canto',
  }

  it('gera um documento PDF 1.4 válido com dados da O.S. e IMEI', () => {
    const pdfBytes = generateOsPdfBytes(
      sampleOrder,
      [{ id: 'tela_touch', label: 'Tela / Touch' }],
      { ok: 'OK' },
    )
    const text = new TextDecoder('latin1').decode(pdfBytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('OS-0042')
    expect(text).toContain('354891101234567')
    expect(text.endsWith('%%EOF')).toBe(true)
  })

  it('cria backup em formato .rar e restaura as Ordens de Serviço com fidelidade', async () => {
    const rarBytes = createRarBackupBytes([sampleOrder])
    const restored = await parseBackupFile(rarBytes)
    expect(restored).toHaveLength(1)
    expect(restored[0].osNumber).toBe('OS-0042')
    expect(restored[0].imei).toBe('354891101234567')
  })
})
