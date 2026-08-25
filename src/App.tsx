import { AppProvider, useApp } from './context/AppContext'
import { Onboarding } from './components/Onboarding'
import styles from './App.module.css'

function AppShell() {
  const { view, authChecked } = useApp()

  if (!authChecked) {
    return (
      <div className={styles.splash}>
        <h1>tg-digest</h1>
      </div>
    )
  }

  switch (view) {
    case 'onboarding':
      return <Onboarding />
    case 'home':
      return <p className={styles.app}>home</p>
    case 'settings':
      return <p className={styles.app}>impostazioni</p>
  }
}

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}

export default App
