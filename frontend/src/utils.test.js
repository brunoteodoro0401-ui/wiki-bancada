import { describe, expect, it } from 'vitest'
import { buildPartGroups, filterBySearch, linkMatchesTerms, normalize, parseTags, searchPartGroups, searchTerms } from './utils'
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

describe('compatibilidade de peças', () => {
  const devices = [
    { id: 1, marca: 'Samsung', modelo: 'Galaxy A12' },
    { id: 2, marca: 'Samsung', modelo: 'Galaxy M12' },
    { id: 3, marca: 'Motorola', modelo: 'Moto G20' },
  ]
  const parts = [
    { id: 10, nome: 'Bateria EB-BA217ABY / WT-S-N28', categoria: 'Bateria' },
    { id: 11, nome: 'Tela Frontal Galaxy A12 — sem aro', categoria: 'Display' },
    { id: 12, nome: 'Bateria JK50', categoria: 'Bateria' },
    { id: 13, nome: 'Peça sem vínculo', categoria: 'Flex' },
  ]
  const compats = [
    { id: 1, device_id: 1, part_id: 10, notas: 'Mesma célula', device_label: 'Samsung Galaxy A12' },
    { id: 2, device_id: 2, part_id: 10, notas: 'Mesma célula', device_label: 'Samsung Galaxy M12' },
    { id: 3, device_id: 1, part_id: 11, notas: 'Encaixa também no A02', device_label: 'Samsung Galaxy A12' },
    { id: 4, device_id: 3, part_id: 12, notas: null, device_label: 'Motorola Moto G20' },
  ]
  const groups = buildPartGroups(parts, compats, devices)

  it('agrupa por peça, lista modelos e deduz marcas e nota compartilhada', () => {
    const bateria = groups.find((g) => g.id === 10)
    expect(bateria.links.map((l) => l.modelo)).toEqual(['Galaxy A12', 'Galaxy M12'])
    expect(bateria.brands).toEqual(['Samsung'])
    expect(bateria.sharedNote).toBe('Mesma célula')
    expect(groups.find((g) => g.id === 12).sharedNote).toBe('')
    expect(groups.find((g) => g.id === 13).links).toEqual([])
  })

  it('busca pelo nome/código da peça e mostra os modelos compatíveis', () => {
    const r = searchPartGroups(groups, 'eb-ba217aby')
    expect(r.map((g) => g.id)).toEqual([10])
    expect(searchPartGroups(groups, 'bateria').map((g) => g.id).sort()).toEqual([10, 12])
  })

  it('busca pelo modelo do aparelho (sem acento/caixa) e exige todos os termos', () => {
    expect(searchPartGroups(groups, 'GALAXY a12').map((g) => g.id).sort()).toEqual([10, 11])
    expect(searchPartGroups(groups, 'bateria galaxy a12').map((g) => g.id)).toEqual([10])
    expect(searchPartGroups(groups, 'xyz')).toEqual([])
  })

  it('combina com filtros de marca e tipo e põe primeiro quem tem o termo no nome', () => {
    expect(searchPartGroups(groups, '', { brand: 'Motorola' }).map((g) => g.id)).toEqual([12])
    expect(searchPartGroups(groups, '', { category: 'Display' }).map((g) => g.id)).toEqual([11])
    expect(searchPartGroups(groups, 'a12')[0].id).toBe(11)
  })

  it('destaca o modelo que casa com a busca', () => {
    const terms = searchTerms('m12')
    const bateria = groups.find((g) => g.id === 10)
    expect(bateria.links.map((l) => linkMatchesTerms(l, terms))).toEqual([false, true])
    expect(linkMatchesTerms(bateria.links[0], [])).toBe(false)
  })
})