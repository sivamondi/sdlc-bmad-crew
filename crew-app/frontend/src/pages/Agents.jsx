import { useState, useEffect } from 'react'
import AgentIcon from '../components/AgentIcon'

const PHASES = [
  {
    id: 'planning',
    label: 'Discovery & Planning',
    color: 'bg-indigo-600',
    light: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-700',
    steps: [
      { label: 'PRD Upload',     agent: null,                  icon: '📄' },
      { label: 'Epics & Stories', agent: 'bmad-agent-pm',      icon: null },
      { label: 'Architecture',   agent: 'bmad-agent-architect', icon: null },
      { label: 'Sprint Planning', agent: 'bmad-agent-dev',     icon: null },
      { label: 'Acceptance Tests', agent: 'bmad-agent-dev',    icon: null },
    ],
  },
  {
    id: 'build',
    label: 'Build & Quality Assurance',
    color: 'bg-emerald-600',
    light: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    steps: [
      { label: 'Implement Code', agent: 'bmad-agent-dev', icon: null },
      { label: 'Code Review',    agent: 'bmad-agent-dev', icon: null },
      { label: 'Test Execution', agent: 'bmad-agent-dev', icon: null },
    ],
  },
  {
    id: 'release',
    label: 'Release & Retrospective',
    color: 'bg-violet-600',
    light: 'bg-violet-50 border-violet-200',
    text: 'text-violet-700',
    steps: [
      { label: 'API Documentation',  agent: 'bmad-agent-tech-writer', icon: null },
      { label: 'Release Readiness',  agent: 'bmad-agent-architect',   icon: null },
      { label: 'Retrospective',      agent: 'bmad-agent-dev',         icon: null },
    ],
  },
]

const AGENT_NAMES = {
  'bmad-agent-pm':          'John',
  'bmad-agent-analyst':     'Mary',
  'bmad-agent-architect':   'Winston',
  'bmad-agent-dev':         'Amelia',
  'bmad-agent-tech-writer': 'Paige',
  'bmad-agent-ux-designer': 'Sally',
}

function SDLCDiagram() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 overflow-x-auto">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">SDLC Lifecycle</h2>
      <div className="flex items-start gap-3 min-w-max">
        {PHASES.map((phase, pi) => (
          <div key={phase.id} className="flex items-start gap-3">
            {/* Phase block */}
            <div className="flex flex-col gap-1">
              {/* Phase label */}
              <div className={`text-center text-xs font-semibold px-3 py-1 rounded-full text-white mb-2 ${phase.color}`}>
                {phase.label}
              </div>
              {/* Steps row */}
              <div className="flex items-center gap-1.5">
                {phase.steps.map((step, si) => (
                  <div key={si} className="flex items-center gap-1.5">
                    {/* Step card */}
                    <div className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border w-24 ${phase.light}`}>
                      {step.icon ? (
                        <span className="text-xl">{step.icon}</span>
                      ) : (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                          <AgentIcon agentId={step.agent} size="sm" />
                        </div>
                      )}
                      <span className={`text-xs font-medium text-center leading-tight ${phase.text}`}>
                        {step.label}
                      </span>
                      {step.agent && (
                        <span className="text-xs text-gray-400">{AGENT_NAMES[step.agent]}</span>
                      )}
                    </div>
                    {/* Arrow within phase */}
                    {si < phase.steps.length - 1 && (
                      <span className={`text-sm font-bold ${phase.text} opacity-50`}>→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Arrow between phases */}
            {pi < PHASES.length - 1 && (
              <div className="flex items-center mt-8">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-8 h-0.5 bg-gray-300" />
                  <span className="text-gray-400 text-xs">▶</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [skills, setSkills] = useState([])
  const [search, setSearch] = useState('')
  const [expandedAgent, setExpandedAgent] = useState(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => {})
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(() => {})
  }, [])

  const agentIds = new Set(agents.map(a => a.id))
  const generalSkills = skills.filter(s => !agentIds.has(s.id))

  const filteredSkills = generalSkills.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  function groupLabel(skillId) {
    if (skillId.startsWith('bmad-create'))   return 'Create'
    if (skillId.startsWith('bmad-dev'))      return 'Development'
    if (skillId.startsWith('bmad-arch'))     return 'Architecture'
    if (skillId.startsWith('bmad-prd'))      return 'Product'
    if (skillId.startsWith('bmad-doc'))      return 'Documentation'
    if (skillId.startsWith('bmad-advanced')) return 'Elicitation'
    if (skillId.startsWith('bmad-market'))   return 'Research'
    if (skillId.startsWith('bmad-domain'))   return 'Research'
    if (skillId.startsWith('bmad-compet'))   return 'Research'
    if (skillId.startsWith('bmad-ux'))       return 'UX & Design'
    if (skillId.startsWith('bmad-ui'))       return 'UX & Design'
    return 'Other'
  }

  const groups = {}
  filteredSkills.forEach(s => {
    const g = groupLabel(s.id)
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  })
  const groupOrder = ['Research', 'Elicitation', 'Product', 'Create', 'Development', 'Architecture', 'UX & Design', 'Documentation', 'Other']
  const sortedGroups = groupOrder.filter(g => groups[g]).map(g => [g, groups[g]])

  return (
    <div>
      <SDLCDiagram />
    <div className="flex gap-6 h-full min-h-0" style={{ maxWidth: '100%' }}>

      {/* ── LEFT: Agents ── */}
      <div className="w-80 shrink-0 flex flex-col min-h-0">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">🤖 Agents</h1>
          <p className="text-xs text-gray-400 mt-0.5">{agents.length} agents · click to expand</p>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          {agents.length === 0 ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : agents.map(agent => {
            const isOpen = expandedAgent === agent.id
            return (
              <div key={agent.id}
                className={`bg-white rounded-xl border transition-colors cursor-pointer ${isOpen ? 'border-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setExpandedAgent(isOpen ? null : agent.id)}
              >
                {/* Always visible header */}
                <div className="flex items-center gap-3 p-3">
                  <AgentIcon agentId={agent.id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{agent.name}</p>
                    <p className="text-xs text-gray-400 truncate">{agent.title}</p>
                  </div>
                  <span className="text-gray-300 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 space-y-3">
                    <p className="text-xs text-gray-600">{agent.description}</p>

                    {agent.principles?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Principles</p>
                        <ul className="space-y-0.5">
                          {agent.principles.map((p, i) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                              <span className="text-indigo-400 shrink-0">•</span>{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {agent.menu?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.menu.map((m, i) => {
                            const sk = skills.find(s => s.id === m.skill)
                            return (
                              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                                {sk?.name || m.skill}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs font-mono text-gray-300">{agent.id}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="w-px bg-gray-200 shrink-0" />

      {/* ── RIGHT: Skills ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">🛠 Skills</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {generalSkills.length} skills · <code className="bg-gray-100 px-1 rounded">.claude/skills/</code>
            </p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
          />
        </div>

        <div className="overflow-y-auto space-y-5 pr-1" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          {sortedGroups.length === 0 ? (
            <p className="text-sm text-gray-400">No skills match "{search}".</p>
          ) : sortedGroups.map(([group, groupSkills]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sticky top-0 bg-gray-50 py-1">{group}</h3>
              <div className="space-y-1.5">
                {groupSkills.map(s => (
                  <div key={s.id} className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono text-gray-300 shrink-0 pt-0.5 hidden xl:block">{s.id}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
    </div>
  )
}
