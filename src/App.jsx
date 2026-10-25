import { useEffect, useState } from 'react'
import Landing from './components/Landing.jsx'
import Workspace from './components/Workspace.jsx'
import HelpWidget from './components/HelpWidget.jsx'
import Logo from './components/Logo.jsx'

const pageFromHash = () => (window.location.hash === '#/book' ? 'book' : 'home')

export default function App() {
  const [page, setPage] = useState(pageFromHash)
  const [helpContext, setHelpContext] = useState('')

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (p) => { window.location.hash = p === 'book' ? '#/book' : '#/' }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => go('home')} aria-label="Tuskers Freight home">
            <Logo className="h-10" />
          </button>
          <nav className="flex gap-1 text-sm">
            <button onClick={() => go('home')}
              className={`px-3 py-1.5 rounded-md ${page === 'home' ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
              Routes
            </button>
            <button onClick={() => go('book')}
              className={`px-3 py-1.5 rounded-md ${page === 'book' ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
              Book a shipment
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {page === 'home' ? <Landing onStart={() => go('book')} /> : <Workspace onContext={setHelpContext} />}
      </main>
      <HelpWidget context={helpContext} />
    </div>
  )
}
