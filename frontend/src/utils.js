/** Divide a string de tags ("a, b, c") em uma lista limpa. */
export function parseTags(tags) {
  return (tags ?? '').split(',').map((t) => t.trim()).filter(Boolean)
}

/** Filtra uma lista de objetos: algum dos `fields` deve conter o termo (sem acento/caixa). */
export function filterBySearch(items, query, fields) {
  const q = normalize(query)
  if (!q) return items
  return items.filter((item) =>
    fields.some((f) => item[f] != null && normalize(String(item[f])).includes(q)),
  )
}

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Agrupa as compatibilidades por peça: cada peça vira um cartão com a lista de
 * modelos compatíveis ({ id, device_id, label, modelo, marca, notas }).
 */
export function buildPartGroups(parts, compats, devices) {
  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const linksByPart = new Map()
  for (const c of compats) {
    const d = deviceById.get(c.device_id)
    const link = {
      id: c.id,
      device_id: c.device_id,
      label: c.device_label ?? (d ? `${d.marca} ${d.modelo}` : ''),
      modelo: d?.modelo ?? c.device_label ?? '',
      marca: d?.marca ?? '',
      notas: c.notas ?? '',
    }
    if (!linksByPart.has(c.part_id)) linksByPart.set(c.part_id, [])
    linksByPart.get(c.part_id).push(link)
  }

  return parts
    .map((p) => {
      const links = (linksByPart.get(p.id) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label, 'pt-BR', { numeric: true }),
      )
      const brands = [...new Set(links.map((l) => l.marca).filter(Boolean))]
      const notes = [...new Set(links.map((l) => l.notas).filter(Boolean))]
      // Nota única repetida em todos os modelos é mostrada uma vez só no cartão.
      const sharedNote = notes.length === 1 && links.every((l) => l.notas) ? notes[0] : ''
      return { ...p, links, brands, sharedNote }
    })
    .sort(
      (a, b) =>
        (a.brands[0] ?? 'zzz').localeCompare(b.brands[0] ?? 'zzz', 'pt-BR') ||
        (a.categoria ?? '').localeCompare(b.categoria ?? '', 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }),
    )
}

/** Separa a busca em termos normalizados (sem acento/caixa). */
export function searchTerms(query) {
  return normalize(query).split(/\s+/).filter(Boolean)
}

/**
 * Filtra os grupos de peças por texto livre (nome da peça, código, modelo, nota),
 * marca e categoria. Todos os termos digitados precisam aparecer. Peças cujo
 * próprio nome contém todos os termos vêm primeiro.
 */
export function searchPartGroups(groups, query, { brand = '', category = '' } = {}) {
  const terms = searchTerms(query)
  const matched = groups.filter((g) => {
    if (brand && !g.brands.includes(brand)) return false
    if (category && g.categoria !== category) return false
    if (terms.length === 0) return true
    const haystack = normalize(
      [g.nome, g.categoria, ...g.brands, ...g.links.map((l) => l.label), ...g.links.map((l) => l.notas)].join(' '),
    )
    return terms.every((t) => haystack.includes(t))
  })
  if (terms.length === 0) return matched
  const nameHit = (g) => {
    const name = normalize(g.nome)
    return terms.every((t) => name.includes(t)) ? 0 : 1
  }
  return [...matched].sort((a, b) => nameHit(a) - nameHit(b))
}

/** Verdadeiro se o modelo (link) casa com algum termo da busca — usado para destacar o chip. */
export function linkMatchesTerms(link, terms) {
  if (terms.length === 0) return false
  const label = normalize(link.label)
  return terms.some((t) => label.includes(t))
}