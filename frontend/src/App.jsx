import { useState } from 'react'
import { AuthProvider, useAuth } from './auth'
import AuthModal from './components/AuthModal'
import WikiView from './views/WikiView'
import DevicesView from './views/DevicesView'
import PartsView from './views/PartsView'
import AssistantView from './views/AssistantView'
import SourcesView from './views/SourcesView'
import { ghostBtn, inputClass } from './components/EntityFormModal'

const TABS = [
  { id: 'wiki', label: 'Dicas' },
  { id: 'devices', label: 'Aparelhos' },
  { id: 'parts', label: 'Peças e compatibilidade' },
  { id: 'sources', label: 'Fontes da IA' },
  { id: 'assistant', label: 'Assistente IA' },
]

function Shell() {
  const { user, ready, logout } = useAuth()
  const [tab, setTab] = useState('wiki')
  const [query, setQuery] = useState('')
  const [showAuth, setShowAuth] = useState(false)

  if (!ready) return <p className="p-8 text-slate-500">Carregando...</p>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold text-slate-900">🔧 Wiki de Bancada</h1>
            <div className="flex items-center gap-3">
              {tab !== 'assistant' && tab !== 'sources' && (
                <>
                  <label htmlFor="search" className="sr-only">Buscar</label>
                  <input
                    id="search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por aparelho, peça, dica ou tag..."
                    className={`${inputClass} sm:w-80`}
                  />
                </>
              )}
              {user ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="hidden sm:inline">
                    {user.nome} <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">{user.role}</span>
                  </span>
                  <button onClick={logout} className={ghostBtn}>Sair</button>
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)} className={ghostBtn}>Entrar</button>
              )}
            </div>
          </div>
          <nav aria-label="Seções" className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === 'wiki' && <WikiView search={query} />}
        {tab === 'devices' && <DevicesView search={query} />}
        {tab === 'parts' && <PartsView search={query} />}
        {tab === 'sources' && <SourcesView />}
        {tab === 'assistant' && <AssistantView onRequireLogin={() => setShowAuth(true)} />}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
