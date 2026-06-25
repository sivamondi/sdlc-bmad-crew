import {
  TrendingUp,    // Mary — Analyst: trends, insights, research
  Target,        // John — PM: goals, epics, delivery
  PenTool,       // Sally — UX Designer: design, wireframes
  Network,       // Winston — Architect: systems, connections
  Code2,         // Amelia — Dev: code, implementation
  BookOpen,      // Paige — Tech Writer: documentation, reading
  Bot,           // fallback
} from 'lucide-react'

const ICON_MAP = {
  'bmad-agent-analyst':     { Icon: TrendingUp, bg: 'bg-blue-50',    color: 'text-blue-600' },
  'bmad-agent-pm':          { Icon: Target,     bg: 'bg-violet-50',  color: 'text-violet-600' },
  'bmad-agent-ux-designer': { Icon: PenTool,    bg: 'bg-pink-50',    color: 'text-pink-600' },
  'bmad-agent-architect':   { Icon: Network,    bg: 'bg-amber-50',   color: 'text-amber-600' },
  'bmad-agent-dev':         { Icon: Code2,      bg: 'bg-emerald-50', color: 'text-emerald-600' },
  'bmad-agent-tech-writer': { Icon: BookOpen,   bg: 'bg-orange-50',  color: 'text-orange-600' },
}

export function agentMeta(agentId) {
  return ICON_MAP[agentId] || { Icon: Bot, bg: 'bg-gray-50', color: 'text-gray-500' }
}

// Square icon tile — used in agent cards
export default function AgentIcon({ agentId, size = 'md' }) {
  const { Icon, bg, color } = agentMeta(agentId)
  const dim  = size === 'sm' ? 'w-8 h-8'   : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'
  const icon = size === 'sm' ? 14           : size === 'lg' ? 26           : 18
  return (
    <div className={`${dim} ${bg} rounded-xl flex items-center justify-center shrink-0`}>
      <Icon size={icon} className={color} strokeWidth={1.8} />
    </div>
  )
}

// Inline dot / small badge used in pipeline lists
export function AgentDot({ agentId, size = 16 }) {
  const { Icon, color } = agentMeta(agentId)
  return <Icon size={size} className={color} strokeWidth={1.8} />
}
