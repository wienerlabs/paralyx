import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ConnectModal } from './components/ConnectModal'
import { Header } from './components/Header'
import { LangContext, type Lang } from './lib/i18n'
import { WalletProvider } from './lib/wallet'
import { Home } from './pages/Home'
import { Stats } from './pages/Stats'

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('paralyx.lang') as Lang) || 'tr'
    } catch {
      return 'tr'
    }
  })
  const update = (next: Lang) => {
    setLang(next)
    try {
      localStorage.setItem('paralyx.lang', next)
    } catch {
      return
    }
  }
  return (
    <LangContext.Provider value={{ lang, setLang: update }}>
      <WalletProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-white text-ink">
            <Header />
            <ConnectModal />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/stats" element={<Stats />} />
            </Routes>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </LangContext.Provider>
  )
}
