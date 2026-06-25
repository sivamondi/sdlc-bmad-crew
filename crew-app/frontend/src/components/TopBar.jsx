const PAGE_LABELS = {
  build: 'Build',
  workflow: 'Workflow',
  agents: 'Agents',
  reports: 'Reports',
  settings: 'Settings',
}

export default function TopBar({ page }) {
  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <span className="text-sm text-gray-500 font-medium">{PAGE_LABELS[page]}</span>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-green-600 font-medium">Connected</span>
      </div>
    </header>
  )
}
