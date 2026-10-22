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
