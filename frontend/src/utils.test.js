import { describe, expect, it } from 'vitest'
import { filterBySearch, normalize, parseTags } from './utils'

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
