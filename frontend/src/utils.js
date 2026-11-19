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

/** Formata "Marca Modelo" sem repetir a marca quando o modelo já inicia com ela. */
export function formatDeviceLabel(marca, modelo) {
  const m = (marca ?? '').trim()
  const mod = (modelo ?? '').trim()
  if (!m) return mod
  if (!mod) return m
  return normalize(mod).startsWith(normalize(m) + ' ') || normalize(mod) === normalize(m)
    ? mod
    : `${m} ${mod}`
}

function inferBrandFromName(name) {
  const n = normalize(name)
  if (!n) return ''
  if (/\b(iphone|ipad|apple|watch)\b/.test(n)) return 'Apple'
  if (/\b(galaxy|samsung)\b/.test(n)) return 'Samsung'
  if (/\b(moto|motorola|edge)\b/.test(n)) return 'Motorola'
  if (/\b(redmi|poco|xiaomi|mi\s?\d|mi\s?a\d)\b/.test(n)) return 'Xiaomi'
  if (/\blg\b/.test(n)) return 'LG'
  if (/\brealme\b/.test(n)) return 'Realme'
  if (/\bdell\b/.test(n)) return 'Dell'
  if (/\blenovo|thinkpad|ideapad\b/.test(n)) return 'Lenovo'
  if (/\bhp\b|probook/.test(n)) return 'HP'
  if (/\brefox\b/.test(n)) return 'Refox'
  return ''
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Verifica com fronteira de palavra se uma dica da Wiki refere-se ao aparelho. */
export function matchesDeviceTarget(targetDevice, marca, modelo) {
  const target = normalize(targetDevice)
  const mod = normalize(modelo)
  const brand = normalize(marca)
  if (!target) return false
  if (brand && target.includes(brand) && target.includes('geral')) return true
  if (!mod) return false
  // Segmentos separados por "/" com eventual prefixo herdado (ex: "iPhone 12 / 12 Pro" ou "Redmi Note 10 / 11")
  const exactBoundary = new RegExp(`(^|[^a-z0-9])${escapeRegex(mod)}($|[^a-z0-9])`)
  if (exactBoundary.test(target)) {
    // Evita que "iPhone 12" case dentro de "iPhone 12 Pro" quando o target é apenas "iPhone 12 Pro"
    const cleanSegments = target.split('/').map((s) => s.trim())
    const modNoBrand = brand && mod.startsWith(brand + ' ') ? mod.slice(brand.length + 1) : mod
    return cleanSegments.some((seg) => {
      if (seg === mod || seg === modNoBrand) return true
      // Também aceita "Marca Modelo" (ex: "Samsung Galaxy A54" ou "Motorola Moto G20")
      if (brand && seg === `${brand} ${mod}`) return true
      // Ou prefixo antes de parênteses (ex: "Galaxy A12 (SM-A125)")
      const noParen = seg.replace(/\([^)]*\)/g, '').trim()
      return noParen === mod || noParen === modNoBrand || (brand && noParen === `${brand} ${mod}`)
    })
  }
  return false
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
      label: d ? formatDeviceLabel(d.marca, d.modelo) : (c.device_label ?? ''),
      modelo: d?.modelo ?? c.device_label ?? '',
      marca: d?.marca ?? '',
      device_code: d?.model_code ?? c.device_code ?? '',
      compatibility_type: c.compatibility_type || 'Direta',
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
      const linkBrands = [...new Set(links.map((l) => l.marca).filter(Boolean))]
      const inferred = linkBrands.length === 0 ? inferBrandFromName(p.nome) : ''
      const brands = linkBrands.length > 0 ? linkBrands : (inferred ? [inferred] : [])
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
      [
        g.nome,
        g.part_code,
        g.quality_tier,
        g.categoria,
        ...g.brands,
        ...g.links.map((l) => l.label),
        ...g.links.map((l) => l.device_code),
        ...g.links.map((l) => l.notas),
      ].join(' '),
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