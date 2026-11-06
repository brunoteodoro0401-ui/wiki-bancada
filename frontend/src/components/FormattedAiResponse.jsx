import React from 'react'

/**
 * Renderiza texto inline com suporte a **negrito**, `código` e links.
 */
function renderInline(str) {
  if (!str) return null
  // Divide por delimitadores: **bold**, `code`
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-800 border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

/**
 * Renderiza respostas estruturadas da IA com formatação rica de bancada:
 * Títulos, listas com bullets visuais, passos numerados e caixas de alerta.
 */
export function FormattedAiResponse({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let currentList = []

  function flushList() {
    if (currentList.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="my-2 space-y-1.5 pl-1 text-slate-800">
          {currentList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    // Títulos de seção (### ou ##)
    if (trimmed.startsWith('### ')) {
      flushList()
      blocks.push(
        <h4 key={`h4-${i}`} className="mt-3.5 mb-1.5 text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1">
          {renderInline(trimmed.slice(4))}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      blocks.push(
        <h3 key={`h3-${i}`} className="mt-4 mb-2 text-base font-bold text-slate-900 border-b border-slate-200 pb-1">
          {renderInline(trimmed.slice(3))}
        </h3>
      )
      continue
    }

    // Itens de lista com marcador (-, *, •)
    const listMatch = trimmed.match(/^[-*•]\s+(.*)$/)
    if (listMatch) {
      currentList.push(listMatch[1])
      continue
    }

    // Lista numerada (1. , 2. )
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      flushList()
      blocks.push(
        <div key={`num-${i}`} className="my-1.5 flex items-start gap-2 text-slate-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {numMatch[1]}
          </span>
          <div className="pt-0.5">{renderInline(numMatch[2])}</div>
        </div>
      )
      continue
    }

    // Alertas ou avisos (⚠️, Cuidado, Atenção, Alerta)
    if (
      trimmed.startsWith('⚠️') ||
      trimmed.startsWith('Cuidado:') ||
      trimmed.startsWith('Atenção:') ||
      trimmed.startsWith('Alerta:')
    ) {
      flushList()
      blocks.push(
        <div key={`alert-${i}`} className="my-2.5 rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs leading-relaxed text-amber-900 shadow-2xs">
          {renderInline(trimmed)}
        </div>
      )
      continue
    }

    // Parágrafo comum
    flushList()
    blocks.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed text-slate-800">
        {renderInline(trimmed)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-1 text-sm">{blocks}</div>
}
