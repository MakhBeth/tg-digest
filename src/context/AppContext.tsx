import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { telegramService } from '../lib/telegram/service'

export type View = 'onboarding' | 'home' | 'settings'

interface AppCtx { view: View; setView: (v: View) => void; authChecked: boolean }

const Ctx = createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('onboarding')
  const [authChecked, setAuthChecked] = useState(false)
  useEffect(() => {
    telegramService.isAuthorized().then(ok => {
      setView(ok ? 'home' : 'onboarding')
      setAuthChecked(true)
    })
  }, [])
  return <Ctx.Provider value={{ view, setView, authChecked }}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp fuori da AppProvider')
  return ctx
}
