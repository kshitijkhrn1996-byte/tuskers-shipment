import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import Landing from './components/Landing.jsx'
import Workspace from './components/Workspace.jsx'
import ChecksPage from './components/ChecksPage.jsx'
import CarriersPage from './components/CarriersPage.jsx'
import HelpWidget from './components/HelpWidget.jsx'
import Logo from './components/Logo.jsx'

const PAGES = ['home', 'checks', 'carriers', 'book']
const pageFromHash = () => {
  const p = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(p) ? p : 'home'
}

export default function App() {
  const [page, setPage] = useState(pageFromHash)
  const [helpContext, setHelpContext] = useState('')

  useEffect(() => {
    const onHash = () => { setPage(pageFromHash()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (p) => { window.location.hash = p === 'home' ? '#/' : `#/${p}` }
  const nav = [['home', 'Home'], ['checks', 'Pre-flight checks'], ['carriers', 'Carriers']]

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col">
        {/* soft colour behind the frosted panels */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-teal-200/40 blur-3xl" />
          <div className="absolute -right-32 top-24 h-[30rem] w-[30rem] rounded-full bg-amber-100/60 blur-3xl" />
          <div className="absolute bottom-[-12rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-sky-100/60 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:22px_22px]" />
        </div>

        <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl backdrop-saturate-150 print:hidden">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
            <button onClick={() => go('home')} aria-label="Tuskers Freight home" className="shrink-0 transition-transform duration-200 hover:scale-[1.02]">
              <Logo className="h-10" />
            </button>
            <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm">
              {nav.map(([k, label]) => (
                <button key={k} onClick={() => go(k)}
                  className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors duration-200 ${page === k ? 'text-ink' : 'text-slate-500 hover:text-ink'}`}>
                  {page === k && (
                    <motion.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-slate-900/[0.06]" />
                  )}
                  {label}
                </button>
              ))}
              <button onClick={() => go('book')}
                className={`ml-1 whitespace-nowrap ${page === 'book' ? 'btn-dark' : 'btn-primary'} px-3.5 py-1.5`}>
                Book a shipment
              </button>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              {page === 'home' && <Landing go={go} />}
              {page === 'checks' && <ChecksPage go={go} />}
              {page === 'carriers' && <CarriersPage go={go} />}
              {/* keep the workspace mounted so a booking in progress survives page switches */}
            </motion.div>
          </AnimatePresence>
          <div className={page === 'book' ? '' : 'hidden'}><Workspace onContext={setHelpContext} /></div>
        </main>
        <HelpWidget context={helpContext} />
      </div>
    </MotionConfig>
  )
}
