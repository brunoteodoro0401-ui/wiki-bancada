import { parseTags } from '../utils'

const CATEGORY_STYLES = {
  'Alerta Químico': 'bg-red-100 text-red-700',
  'Procedimento': 'bg-blue-100 text-blue-700',
  'Diagnóstico': 'bg-amber-100 text-amber-700',
  'Compatibilidade': 'bg-purple-100 text-purple-700',
  'Resolução de Problemas': 'bg-emerald-100 text-emerald-700',
}

export default function ArticleCard({ article, onEdit, onDelete }) {
  const badge = CATEGORY_STYLES[article.category] ?? 'bg-slate-100 text-slate-700'
  const tags = parseTags(article.tags)

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{article.target_device}</h3>
        {article.category && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge}`}>{article.category}</span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{article.ai_context_text}</p>
      {tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">#{tag}</span>
          ))}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div className="flex gap-3 border-t border-slate-100 pt-3 text-sm">
          {onEdit && <button onClick={() => onEdit(article)} className="text-blue-600 hover:underline">Editar</button>}
          {onDelete && <button onClick={() => onDelete(article)} className="text-red-600 hover:underline">Excluir</button>}
        </div>
      )}
    </article>
  )
}
