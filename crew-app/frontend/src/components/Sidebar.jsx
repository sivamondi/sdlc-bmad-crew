const NAV = [
  { id: 'build',    label: 'Build',    icon: '🚀' },
  { id: 'workflow', label: 'Workflow', icon: '🔀' },
  { id: 'agents',   label: 'Agents',   icon: '🤖' },
  { id: 'reports',  label: 'Reports',  icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ current, onNavigate, running }) {
  return (
    <aside className="w-56 bg-sidebar flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">B</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">BMAD</p>
            <p className="text-gray-400 text-xs">SDLC Crew</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              current === item.id
                ? 'bg-sidebar-active text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-sidebar-hover'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.id === 'build' && running && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-gray-400 text-xs">Connected</span>
        </div>
      </div>
    </aside>
  )
}
