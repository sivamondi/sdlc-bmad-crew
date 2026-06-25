import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Build from './pages/Build'
import Workflow from './pages/Workflow'
import Agents from './pages/Agents'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App() {
  const [page,    setPage]    = useState('build')
  const [running, setRunning] = useState(false)

  const pages = {
    build: <Build onRunningChange={setRunning} />,
    workflow: <Workflow onNavigate={setPage} />,
    agents: <Agents />,
    reports: <Reports />,
    settings: <Settings />,
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar current={page} onNavigate={setPage} running={running} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar page={page} />
        <main className="flex-1 overflow-y-auto p-6">
          {pages[page]}
        </main>
      </div>
    </div>
  )
}
