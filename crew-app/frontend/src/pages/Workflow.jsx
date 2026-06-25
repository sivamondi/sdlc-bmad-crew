import { useState, useEffect } from 'react'
import { AgentDot } from '../components/AgentIcon'

function StepRow({ step, agents, skills, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const agent = agents.find(a => a.id === step.agent_id)
  const skill = skills.find(s => s.id === step.skill_id)

  // Which skills are "native" to this agent (from their menu)
  const agentSkillIds = new Set((agent?.menu || []).map(m => m.skill))
  const isNativeSkill = skill && agentSkillIds.has(skill.id)

  function pickSkill(skillId) {
    const s = skills.find(x => x.id === skillId)
    onUpdate({ ...step, skill_id: skillId, label: s?.name || '' })
  }

  return (
    <div className={`border rounded-lg transition-colors ${step.enabled !== false ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
      {/* Top row: reorder + pickers + toggle + remove */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex flex-col gap-0.5 pt-1 shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▲</button>
          <button onClick={onMoveDown} disabled={isLast}  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▼</button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3 min-w-0">
          {/* Agent picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Agent</label>
            <select
              value={step.agent_id || ''}
              onChange={e => onUpdate({ ...step, agent_id: e.target.value, skill_id: '', label: '' })}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Pick agent…</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.icon} {a.name} — {a.title}</option>
              ))}
            </select>
          </div>

          {/* Skill picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Skill
              {agent && !step.skill_id && (
                <span className="text-indigo-500 ml-1 font-normal">↓ see suggestions below</span>
              )}
            </label>
            <select
              value={step.skill_id || ''}
              onChange={e => pickSkill(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Pick skill…</option>
              {agent?.menu?.length > 0 && (
                <optgroup label={`★ ${agent.name}'s skills (recommended)`}>
                  {agent.menu.map(m => {
                    const sk = skills.find(s => s.id === m.skill)
                    return <option key={m.skill} value={m.skill}>{sk?.name || m.skill}</option>
                  })}
                </optgroup>
              )}
              <optgroup label="All 46 skills">
                {skills.filter(s => !agentSkillIds.has(s.id)).map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.id}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <button
          onClick={() => onUpdate({ ...step, enabled: step.enabled === false ? true : false })}
          title={step.enabled !== false ? 'Disable step' : 'Enable step'}
          className={`shrink-0 mt-5 w-10 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
            step.enabled !== false ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
          }`}
        >
          <span className="w-4 h-4 bg-white rounded-full shadow block" />
        </button>

        <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors text-sm shrink-0 mt-5" title="Remove step">✕</button>
      </div>

      {/* Agent skill guide — shown when agent is picked but no skill chosen yet */}
      {agent && !step.skill_id && agent.menu?.length > 0 && (
        <div className="px-3 pb-3 pl-8">
          <p className="text-xs text-gray-400 mb-1.5">
            <span className="font-medium text-gray-600">{agent.name}</span> can run these skills:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {agent.menu.map(m => {
              const sk = skills.find(s => s.id === m.skill)
              return (
                <button
                  key={m.skill}
                  onClick={() => pickSkill(m.skill)}
                  title={sk?.description || m.description}
                  className="group flex flex-col items-start text-left px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                >
                  <span className="text-xs font-medium text-indigo-700">{sk?.name || m.skill}</span>
                  <span className="text-xs text-indigo-500 line-clamp-1 max-w-[180px]">{m.description}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected skill preview */}
      {skill && (
        <div className={`px-3 pb-3 pl-8 border-t mt-0 pt-2.5 ${isNativeSkill ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100 bg-gray-50/40'}`}>
          <div className="flex items-center gap-2 mb-0.5">
            {isNativeSkill
              ? <span className="text-xs text-indigo-600 font-medium">★ {agent?.name}'s native skill</span>
              : <span className="text-xs text-gray-400 font-medium">Custom skill assignment</span>
            }
            <span className="text-xs font-mono text-gray-400">{skill.id}</span>
          </div>
          <p className="text-xs text-gray-600">{skill.description || skill.overview || 'No description available.'}</p>
        </div>
      )}
    </div>
  )
}

function WorkflowEditor({ workflow, agents, skills, onSave, onCancel }) {
  const [name,  setName]  = useState(workflow?.name || '')
  const [desc,  setDesc]  = useState(workflow?.description || '')
  const [steps, setSteps] = useState(workflow?.steps || [])

  function addStep() {
    setSteps(prev => [...prev, { agent_id: '', skill_id: '', label: '', enabled: true }])
  }

  function updateStep(i, s) { setSteps(prev => prev.map((x, j) => j === i ? s : x)) }
  function removeStep(i)     { setSteps(prev => prev.filter((_, j) => j !== i)) }
  function move(i, dir) {
    setSteps(prev => {
      const n = [...prev], t = i + dir
      if (t < 0 || t >= n.length) return n
      ;[n[i], n[t]] = [n[t], n[i]]
      return n
    })
  }

  const valid = name.trim() && steps.length > 0 && steps.every(s => s.agent_id && s.skill_id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">{workflow ? 'Edit Workflow' : 'New Workflow'}</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. PRD → JIRA Stories" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What this workflow produces" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Steps <span className="text-gray-400 font-normal">(each step = agent + skill)</span>
            </label>
            <button onClick={addStep}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              + Add Step
            </button>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-gray-400">No steps yet. Add a step to pick an agent and skill.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <StepRow key={i} step={s} agents={agents} skills={skills}
                  onUpdate={ns => updateStep(i, ns)}
                  onRemove={() => removeStep(i)}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  isFirst={i === 0} isLast={i === steps.length - 1} />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => onSave({ ...workflow, name, description: desc, steps })}
            disabled={!valid}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            Save Workflow
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Workflow() {
  const [workflows, setWorkflows] = useState([])
  const [agents,    setAgents]    = useState([])
  const [skills,    setSkills]    = useState([])
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/workflows').then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
    ]).then(([wfs, ags, sks]) => {
      setWorkflows(wfs); setAgents(ags); setSkills(sks); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function saveWorkflow(wf) {
    const method = wf.id ? 'PUT' : 'POST'
    const url    = wf.id ? `/api/workflows/${wf.id}` : '/api/workflows'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wf) })
    const saved  = await res.json()
    setWorkflows(prev => wf.id ? prev.map(w => w.id === wf.id ? saved : w) : [...prev, saved])
    setEditing(null)
  }

  async function del(id) {
    if (!confirm('Delete this workflow?')) return
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    setWorkflows(prev => prev.filter(w => w.id !== id))
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">🔀 Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Each step = a BMAD agent running a specific skill</p>
        </div>
        <button onClick={() => setEditing('new')}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          + New Workflow
        </button>
      </div>

      {editing && (
        <div className="mb-6">
          <WorkflowEditor
            workflow={editing === 'new' ? null : editing}
            agents={agents} skills={skills}
            onSave={saveWorkflow} onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Loading…</p>
        : workflows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔀</p>
            <p className="text-sm">No workflows yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{wf.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {(wf.steps || []).filter(s => s.enabled !== false).map((s, i) => {
                        const ag = agents.find(a => a.id === s.agent_id)
                        const sk = skills.find(x => x.id === s.skill_id)
                        return (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                            <span className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-full">
                              <AgentDot agentId={s.agent_id} size={11} />
                              {ag?.name} · <span className="font-mono">{sk?.name || s.skill_id}</span>
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditing(wf)}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Edit</button>
                    <button onClick={() => del(wf.id)}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
