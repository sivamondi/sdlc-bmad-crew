import { useState, useEffect, useRef } from 'react'
import AgentIcon, { AgentDot } from '../components/AgentIcon'

// ── helpers ───────────────────────────────────────────────────────────────────

function dl(data, filename, type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
}

// ── sub-components ────────────────────────────────────────────────────────────

function Select({ label, icon, value, onChange, options, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {icon && <span className="mr-1">{icon}</span>}
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function DocumentUpload({ file, onFile }) {
  const inputRef = useRef()
  const [drag,    setDrag]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState(null)

  async function upload(f) {
    setLoading(true); setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res  = await fetch('/api/extract-text', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Extraction failed')
      onFile({ name: f.name, content: json.text, chars: json.chars })
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">
          📄 PRD / BRD Document <span className="text-gray-400 font-normal">(optional but recommended)</span>
        </span>
        {file && <button onClick={() => { onFile(null); setErr(null) }} className="text-xs text-gray-400 hover:text-red-500">Remove</button>}
      </div>

      {err && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">❌ {err}</div>
      )}

      {file ? (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-2xl">📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.chars / 1024).toFixed(1)} KB of text extracted</p>
          </div>
          <span className="text-xs text-indigo-600 font-medium">✓ Ready</span>
        </div>
      ) : loading ? (
        <div className="border-2 border-dashed border-indigo-300 rounded-lg px-6 py-8 text-center bg-indigo-50">
          <p className="text-2xl mb-2 animate-spin inline-block">⟳</p>
          <p className="text-sm text-indigo-600 mt-2">Extracting text…</p>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current.click()}
          className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${drag ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
        >
          <p className="text-3xl mb-2">📂</p>
          <p className="text-sm text-gray-600">Drop your PRD or BRD here, or <span className="text-indigo-600 font-medium">browse</span></p>
          <p className="text-xs text-gray-400 mt-1">.txt · .md · .pdf · .docx</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".txt,.md,.pdf,.docx" className="hidden"
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]) }} />
    </div>
  )
}

function PipelineStep({ step, agents, status, log }) {
  const agent = agents.find(a => a.id === step.agent_id)
  const colors = {
    waiting: 'bg-gray-50  border-gray-200 text-gray-400',
    running: 'bg-blue-50  border-blue-200 text-blue-700',
    done:    'bg-green-50 border-green-200 text-green-700',
    error:   'bg-red-50   border-red-200   text-red-700',
  }
  const icons = { waiting: '⏳', running: '⚡', done: '✅', error: '❌' }

  return (
    <div className={`border rounded-lg p-3 transition-all ${colors[status] || colors.waiting}`}>
      <div className="flex items-center gap-2.5">
        <AgentIcon agentId={step.agent_id} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{agent?.name || step.agent_id}</span>
          <span className="text-xs ml-2 opacity-60 font-mono">{step.skill_id}</span>
        </div>
        <span className="text-base">{icons[status] || icons.waiting}</span>
      </div>
      {log && <p className="text-xs mt-1.5 opacity-80 pl-11">{log}</p>}
    </div>
  )
}

// ── Results rendering ─────────────────────────────────────────────────────────

function EpicsResult({ data }) {
  const epics = data?.epics || (data?.stories ? [{ id: 'E1', title: 'Stories', stories: data.stories }] : [])
  if (!epics.length) return <p className="text-sm text-gray-400">No epics found in output.</p>

  return (
    <div className="space-y-4">
      {epics.map((epic, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <span className="text-xs font-mono text-indigo-500">{epic.id || `E${i+1}`}</span>
            <span className="text-sm font-semibold text-gray-900">{epic.title}</span>
            <span className="ml-auto text-xs text-indigo-600">{(epic.stories || []).length} stories</span>
          </div>
          <div className="divide-y divide-gray-100">
            {(epic.stories || []).map((s, j) => (
              <div key={j} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{s.id || `S${j+1}`}</span>
                    <span className="text-sm font-medium text-gray-900">{s.title}</span>
                  </div>
                  {s.story_points && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">{s.story_points} pts</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 italic mb-2 ml-5">{s.description}</p>
                {s.acceptance_criteria?.length > 0 && (
                  <ul className="ml-5 space-y-0.5">
                    {s.acceptance_criteria.map((ac, k) => (
                      <li key={k} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-green-500 shrink-0">✓</span>{ac}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FindingsResult({ data }) {
  return (
    <div className="space-y-3">
      {data?.summary && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">{data.summary}</div>
      )}
      {(data?.findings || []).map((f, i) => (
        <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-900">{f.title}</p>
          <p className="text-xs text-gray-600 mt-1">{f.detail}</p>
        </div>
      ))}
      {data?.recommendations?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Recommendations</p>
          {data.recommendations.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs text-gray-700 mb-1">
              <span className="text-indigo-400 shrink-0">→</span>{r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GherkinResult({ data }) {
  if (!data?.files?.length) return <p className="text-sm text-gray-400">No feature files in output.</p>
  return (
    <div className="space-y-3 gherkin">
      {data.files.map((f, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-mono font-medium text-gray-700">{f.filename}</span>
            <button onClick={() => dl(f.content, f.filename, 'text/plain')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">↓ Download</button>
          </div>
          <pre className="text-xs overflow-x-auto p-4 bg-gray-900 text-green-300">{f.content}</pre>
        </div>
      ))}
    </div>
  )
}

function SmartValue({ val, depth = 0 }) {
  if (val === null || val === undefined) return <span className="text-gray-400 text-xs italic">—</span>
  if (typeof val === 'boolean') return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{String(val)}</span>
  if (typeof val === 'number')  return <span className="text-indigo-700 font-mono text-sm">{val}</span>
  if (typeof val === 'string') {
    if (val.length === 0) return <span className="text-gray-400 text-xs italic">empty</span>
    if (val.length < 120) return <span className="text-gray-800 text-sm">{val}</span>
    return <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{val}</p>
  }
  if (Array.isArray(val)) return <SmartArray items={val} depth={depth} />
  if (typeof val === 'object') return <SmartObject obj={val} depth={depth} />
  return <span className="text-gray-700 text-sm">{String(val)}</span>
}

function SmartArray({ items, depth }) {
  if (!items.length) return <span className="text-gray-400 text-xs italic">empty list</span>
  if (typeof items[0] === 'string' || typeof items[0] === 'number') {
    return (
      <ul className="space-y-1 mt-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 items-start text-sm text-gray-700">
            <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
            <span>{String(it)}</span>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="space-y-2 mt-1">
      {items.map((it, i) => (
        <div key={i} className={`rounded-lg border p-3 ${depth === 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
          {typeof it === 'object' && it !== null
            ? <SmartObject obj={it} depth={depth + 1} />
            : <SmartValue val={it} depth={depth + 1} />}
        </div>
      ))}
    </div>
  )
}

function SmartObject({ obj, depth }) {
  const entries = Object.entries(obj)
  if (!entries.length) return <span className="text-gray-400 text-xs italic">empty</span>
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        const isComplex = typeof v === 'object' && v !== null
        return (
          <div key={k}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <SmartValue val={v} depth={depth + 1} />
          </div>
        )
      })}
    </div>
  )
}

function RawResult({ data }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Result</p>
      <SmartValue val={data} depth={0} />
    </div>
  )
}

function ArchitectureResult({ data }) {
  const spine = data.architecture_spine || data
  const [openInv, setOpenInv] = useState(null)

  const sections = Object.entries(spine).filter(([k]) =>
    !['paradigm','decision_timestamp','altitude','target_audience'].includes(k)
  )

  return (
    <div className="space-y-5">
      {/* Paradigm headline */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">Architecture Paradigm</p>
        <p className="text-sm font-semibold text-gray-900">{spine.paradigm}</p>
        {spine.target_audience && (
          <p className="text-xs text-gray-500 mt-1">Audience: {spine.target_audience}</p>
        )}
      </div>

      {/* Invariants */}
      {spine.invariants?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">System Invariants</p>
          <div className="space-y-2">
            {spine.invariants.map((inv, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setOpenInv(openInv === i ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors">
                  <span className="text-xs font-mono text-amber-600 shrink-0">{inv.id}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1">{inv.title}</span>
                  <span className="text-gray-400 text-xs">{openInv === i ? '▲' : '▼'}</span>
                </button>
                {openInv === i && (
                  <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed">{inv.rule}</p>
                    {inv.rationale && (
                      <p className="text-xs text-gray-500 italic">{inv.rationale}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All other sections */}
      {sections.map(([key, val]) => (
        <div key={key}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {key.replace(/_/g, ' ')}
          </p>
          {Array.isArray(val) ? (
            <div className="space-y-2">
              {val.map((item, i) => (
                <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                  {typeof item === 'string' ? item : (
                    <div className="space-y-1">
                      {item.title && <p className="font-medium text-gray-900">{item.title}</p>}
                      {item.description && <p>{item.description}</p>}
                      {item.rule && <p>{item.rule}</p>}
                      {item.decision && <p>{item.decision}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-700 p-3 bg-white border border-gray-200 rounded-lg">
              {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function SprintResult({ data }) {
  const ss = data.sprint_status || data
  const [openIdx, setOpenIdx] = useState(0)

  const STATUS_COLOR = {
    'IN_PROGRESS': 'bg-blue-100 text-blue-700',
    'TODO':        'bg-gray-100 text-gray-600',
    'DONE':        'bg-green-100 text-green-700',
    'BLOCKED':     'bg-red-100 text-red-700',
  }

  function StoryRow({ s }) {
    return (
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="text-xs font-mono text-gray-400 shrink-0 mt-0.5">{s.id || '—'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">{s.title || s.name || s.description}</p>
          {s.sprint && <p className="text-xs text-indigo-500 mt-0.5">Sprint {s.sprint}</p>}
          {s.assignee && <p className="text-xs text-gray-400 mt-0.5">{s.assignee}</p>}
        </div>
        {s.story_points && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">{s.story_points}pts</span>
        )}
        {s.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[s.status?.toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>
            {s.status}
          </span>
        )}
      </div>
    )
  }

  // Normalise into a list of groups to render
  let groups = []

  if (ss.epics?.length) {
    // Shape: { epics: [{ id, title, stories: [] }] }
    groups = ss.epics.map(e => ({ label: `${e.id ? e.id + ' · ' : ''}${e.title}`, stories: e.stories || [], status: e.status }))
  } else if (ss.sprints?.length) {
    // Shape: { sprints: [{ sprint_number, goal, stories: [] }] }
    groups = ss.sprints.map(s => ({ label: `Sprint ${s.sprint_number}${s.goal ? ': ' + s.goal : ''}`, stories: s.stories || [] }))
  } else if (ss.stories?.length) {
    // Shape: { sprint_number, goal, stories: [] } — single sprint, flat stories
    const label = ss.sprint_number ? `Sprint ${ss.sprint_number}${ss.goal ? ': ' + ss.goal : ''}` : (ss.goal || 'Sprint')
    groups = [{ label, stories: ss.stories }]
  } else {
    // Nothing recognisable — fall through to SmartResult
    return <SmartValue val={ss} />
  }

  const totalPts = groups.flatMap(g => g.stories).reduce((a, s) => a + (s.story_points || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-0.5">Sprint Plan</p>
          <p className="text-sm font-semibold text-gray-900">{ss.project || ss.project_name || ''}</p>
          <p className="text-xs text-gray-500 mt-0.5">{groups.length} {groups.length === 1 ? 'sprint' : 'epics/sprints'} · {groups.flatMap(g => g.stories).length} stories</p>
        </div>
        {totalPts > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-700">{totalPts}</div>
            <div className="text-xs text-emerald-500">story points</div>
          </div>
        )}
      </div>

      {groups.map((group, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-left transition-colors">
            <span className="text-sm font-semibold text-gray-900 flex-1">{group.label}</span>
            {group.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[group.status?.toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>
                {group.status}
              </span>
            )}
            <span className="text-xs text-indigo-400 shrink-0">{group.stories.length} stories {openIdx === i ? '▲' : '▼'}</span>
          </button>
          {openIdx === i && (
            <div className="divide-y divide-gray-100">
              {group.stories.map((s, j) => <StoryRow key={j} s={s} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function QATestResult({ data }) {
  const ts = data.test_summary || {}
  const files = data.files || data.test_files || []
  const [openFile, setOpenFile] = useState(null)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Tests', value: ts.total_tests_generated ?? files.length },
          { label: 'API Test Files', value: ts.api_test_files ?? '—' },
          { label: 'E2E Test Files', value: ts.e2e_test_files ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{value}</div>
            <div className="text-xs text-indigo-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Coverage by AC */}
      {ts.coverage_by_ac && Object.keys(ts.coverage_by_ac).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Acceptance Criteria Coverage</p>
          <div className="space-y-1">
            {Object.entries(ts.coverage_by_ac).map(([ac, status]) => (
              <div key={ac} className="flex items-start gap-2 text-xs py-1.5 px-3 bg-green-50 border border-green-100 rounded-lg">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <span className="font-mono text-gray-600 shrink-0">{ac}</span>
                <span className="text-gray-500 ml-auto text-right">{status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test files */}
      {files.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Generated Test Files</p>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-mono font-medium text-gray-700">{f.filename || f.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setOpenFile(openFile === i ? null : i)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {openFile === i ? 'Hide' : 'View'}
                    </button>
                    <button onClick={() => dl(f.content, f.filename || f.name, 'text/plain')}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium">↓</button>
                  </div>
                </div>
                {openFile === i && (
                  <pre className="text-xs overflow-x-auto p-4 bg-gray-900 text-green-300 max-h-80">{f.content}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {ts.next_steps?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Next Steps</p>
          <div className="space-y-1">
            {ts.next_steps.map((s, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-700 py-1">
                <span className="text-indigo-400 shrink-0">{i + 1}.</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CodeFilesResult({ data }) {
  const files = data.files || []
  const summary = data.implementation_summary || {}
  const [openFile, setOpenFile] = useState(null)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Files Generated', value: summary.total_files ?? files.length },
          { label: 'Stories Implemented', value: (summary.stories_implemented ?? []).length },
          { label: 'Layers', value: (summary.layers ?? []).join(', ') || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-emerald-700">{value}</div>
            <div className="text-xs text-emerald-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {/* Files */}
      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-gray-700">{f.filename}</span>
                {f.story_id && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">{f.story_id}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpenFile(openFile === i ? null : i)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  {openFile === i ? 'Hide' : 'View'}
                </button>
                <button onClick={() => dl(f.content, f.filename, 'text/plain')}
                  className="text-xs text-gray-500 hover:text-gray-700">↓</button>
              </div>
            </div>
            {openFile === i && (
              <pre className="text-xs overflow-x-auto p-4 bg-gray-900 text-green-300 max-h-96">{f.content}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TestResultsResult({ data }) {
  const tr = data.test_results || {}
  const summary = tr.summary || {}
  const suites  = tr.suites  || []
  const [openSuite, setOpenSuite] = useState(0)

  const STATUS = { PASSED: 'text-green-600 bg-green-50', FAILED: 'text-red-600 bg-red-50', SKIPPED: 'text-gray-500 bg-gray-50' }

  const passRate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Passed',  value: summary.passed,  color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Failed',  value: summary.failed,  color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Skipped', value: summary.skipped, color: 'bg-gray-50 border-gray-200 text-gray-600' },
          { label: 'Coverage', value: `${summary.coverage_percent ?? passRate}%`, color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded-lg p-3 text-center ${color}`}>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            <div className="text-xs mt-0.5 opacity-75">{label}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${passRate}%` }} />
      </div>
      {/* Suites */}
      {suites.map((suite, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setOpenSuite(openSuite === i ? null : i)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
            <span className="text-xs font-mono text-gray-500">{suite.file}</span>
            <span className="text-sm font-medium text-gray-900 flex-1">{suite.name}</span>
            <span className="text-xs text-gray-400">{(suite.scenarios||[]).length} tests {openSuite === i ? '▲' : '▼'}</span>
          </button>
          {openSuite === i && (
            <div className="divide-y divide-gray-100">
              {(suite.scenarios || []).map((sc, j) => (
                <div key={j} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${STATUS[sc.status] || STATUS.SKIPPED}`}>
                    {sc.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800">{sc.name}</p>
                    {sc.message && <p className="text-xs text-red-500 mt-0.5">{sc.message}</p>}
                  </div>
                  {sc.duration_ms && <span className="text-xs text-gray-400 shrink-0">{sc.duration_ms}ms</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CodeReviewResult({ data }) {
  const layers = data.parallel_review_layers || []
  const ctx    = data.review_context || {}
  const SEVER  = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-gray-100 text-gray-600', INFO: 'bg-blue-100 text-blue-700' }
  const allFindings = layers.flatMap(l => (l.findings || []).map(f => ({ ...f, layer: l.layer })))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Project',  value: ctx.project || '—' },
          { label: 'Findings', value: allFindings.length },
          { label: 'Layers',   value: layers.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-700 truncate">{value}</div>
            <div className="text-xs text-amber-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {allFindings.map((f, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-start gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${SEVER[f.severity] || SEVER.INFO}`}>{f.severity}</span>
              {f.file && <span className="text-xs font-mono text-gray-400">{f.file}</span>}
              <span className="text-xs text-indigo-500 ml-auto shrink-0">{f.layer?.replace(/_/g,' ')}</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{f.issue}</p>
            {f.detail && <p className="text-xs text-gray-500 mt-1">{f.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadinessResult({ data }) {
  const ra = data.readiness_assessment || {}
  const score = parseInt(ra.readiness_score) || 0
  const isPassing = score >= 80
  const SEVER = { CRITICAL: 'bg-red-100 text-red-700 border-red-200', HIGH: 'bg-amber-100 text-amber-700 border-amber-200', MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200' }

  return (
    <div className="space-y-4">
      {/* Score banner */}
      <div className={`p-4 rounded-xl border ${isPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${isPassing ? 'text-green-700' : 'text-red-700'}`}>{ra.readiness_score}</div>
          <div>
            <p className={`text-sm font-semibold ${isPassing ? 'text-green-800' : 'text-red-800'}`}>{ra.overall_status}</p>
            {ra.recommendation && <p className="text-xs text-gray-600 mt-0.5 max-w-lg">{ra.recommendation}</p>}
          </div>
        </div>
        {/* Score bar */}
        <div className="mt-3 w-full bg-white rounded-full h-2 border border-gray-200">
          <div className={`h-2 rounded-full ${isPassing ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Blockers */}
      {ra.critical_blockers?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Critical Blockers</p>
          <div className="space-y-2">
            {ra.critical_blockers.map((b, i) => (
              <div key={i} className={`border rounded-lg p-3 ${SEVER[b.severity] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono">{b.id}</span>
                  <span className="text-xs font-medium">{b.category}</span>
                </div>
                <p className="text-sm">{b.finding}</p>
                {b.impact && <p className="text-xs opacity-75 mt-1">{b.impact}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other sections */}
      {Object.entries(ra).filter(([k]) => !['assessment_date','project_name','overall_status','readiness_score','recommendation','critical_blockers'].includes(k)).map(([k, v]) => (
        Array.isArray(v) && v.length > 0 && (
          <div key={k}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{k.replace(/_/g,' ')}</p>
            <div className="space-y-1.5">
              {v.map((item, i) => (
                <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                  {typeof item === 'string' ? item : (item.finding || item.description || item.title || JSON.stringify(item))}
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

function RetrospectiveResult({ data }) {
  // Unwrap any nesting — handle retrospective_session, retrospective, or flat
  const retro = data.retrospective_session || data.retrospective || data

  const getText = item =>
    typeof item === 'string' ? item
    : item.item || item.action || item.risk || item.description || item.text || item.finding
    || (typeof item === 'object' ? Object.values(item).filter(v => typeof v === 'string')[0] : null)
    || JSON.stringify(item)

  // Normalised sections — cover all key aliases the agent might use
  const SECTIONS = [
    { keys: ['went_well', 'what_went_well', 'successes', 'positives'],
      label: 'What Went Well', icon: '✅', color: 'bg-green-50 border-green-200 text-green-800' },
    { keys: ['to_improve', 'improvements', 'what_to_improve', 'areas_for_improvement', 'deltas', 'challenges'],
      label: 'Improvements', icon: '🔧', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    { keys: ['action_items', 'actions', 'next_steps', 'follow_ups'],
      label: 'Action Items', icon: '→', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { keys: ['risks', 'blockers', 'concerns', 'flags'],
      label: 'Risks / Blockers', icon: '⚠️', color: 'bg-red-50 border-red-200 text-red-800' },
  ]

  const rendered = new Set()
  const sectionItems = SECTIONS.map(s => {
    const key = s.keys.find(k => retro[k]?.length)
    const items = key ? retro[key] : []
    if (key) rendered.add(key)
    return { ...s, items }
  })

  // Metrics
  const metrics = retro.metrics || retro.sprint_metrics || retro.kpis || null

  // Any leftover array keys not yet rendered
  const leftover = Object.entries(retro).filter(
    ([k, v]) => !rendered.has(k) && Array.isArray(v) && v.length &&
    !['sprint','sprint_number','project','project_name'].includes(k)
  )

  const hasContent = sectionItems.some(s => s.items.length) || leftover.length

  // Nothing at all — fall back to generic renderer
  if (!hasContent) return <SmartValue val={retro} />

  return (
    <div className="space-y-4">
      {/* Header */}
      {(retro.summary || retro.sprint || retro.project) && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          {retro.project && <p className="text-xs text-indigo-500 mb-0.5">{retro.project}</p>}
          {retro.sprint  && <p className="text-sm font-semibold text-indigo-900">{retro.sprint}</p>}
          {retro.summary && <p className="text-sm text-indigo-800 mt-1">{retro.summary}</p>}
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(metrics).map(([k, v]) => (
            <div key={k} className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-purple-700">{v}</div>
              <div className="text-xs text-purple-500 mt-0.5">{k.replace(/_/g,' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Known sections */}
      {sectionItems.map(({ label, icon, color, items }) => {
        if (!items.length) return null
        return (
          <div key={label}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={i} className={`flex gap-2 items-start p-3 border rounded-lg text-sm ${color}`}>
                  <span className="shrink-0">{icon}</span>
                  <span>{getText(item)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Leftover array keys */}
      {leftover.map(([k, v]) => (
        <div key={k}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{k.replace(/_/g,' ')}</p>
          <div className="space-y-1.5">
            {v.map((item, i) => (
              <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">{getText(item)}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StepResult({ skillId, data }) {
  if (!data) return null

  if (data.epics || data.stories)                    return <EpicsResult data={data} />
  if (data.architecture_spine)                       return <ArchitectureResult data={data} />
  if (data.sprint_status)                            return <SprintResult data={data} />
  if (data.test_results)                             return <TestResultsResult data={data} />
  if (data.test_summary || data.test_files)          return <QATestResult data={data} />
  if (data.readiness_assessment)                     return <ReadinessResult data={data} />
  if (data.retrospective_session || data.went_well)  return <RetrospectiveResult data={data} />
  if (data.parallel_review_layers)                   return <CodeReviewResult data={data} />
  if (data.files && data.files[0]?.type === 'code')  return <CodeFilesResult data={data} />
  if (data.files && data.files[0]?.filename?.endsWith('.feature')) return <GherkinResult data={data} />
  if (data.files)                                    return <CodeFilesResult data={data} />
  if (data.findings || data.summary)                 return <FindingsResult data={data} />
  // Catch common agent output shapes before falling back
  if (data.reviews || data.issues || data.review_findings)
    return <FindingsResult data={{ findings: data.reviews || data.issues || data.review_findings, summary: data.summary }} />
  if (data.output && typeof data.output === 'string' && Object.keys(data).length === 1)
    return <RawResult data={{ output: data.output }} />
  return <RawResult data={data} />
}

function ResultsPanel({ results, workflow, agents, skills }) {
  const entries = Object.entries(results).filter(([k]) => k !== 'jira_links')
  const [active, setActive] = useState(entries[0]?.[0] || '')

  if (!entries.length) return null

  // Find a nice label for each result key
  function tabLabel(skillId) {
    return skills.find(s => s.id === skillId)?.name || skillId
  }

  // Collect all downloadable files
  const allFiles = entries.flatMap(([, d]) => d?.files || [])
  const allEpics = entries.find(([, d]) => d?.epics)?.[1]

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-green-50 border-b border-green-100">
        <span className="text-green-700 font-medium text-sm">✅ Workflow complete</span>
        {results.jira_links && (
          <span className="text-xs text-indigo-600 font-medium">
            🔗 {results.jira_links.length} JIRA issues created
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {allEpics && (
            <button onClick={() => dl(allEpics, 'epics-stories.json')}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              ↓ JIRA JSON
            </button>
          )}
          {allFiles.length > 0 && (
            <button onClick={() => allFiles.forEach(f => dl(f.content, f.filename, 'text/plain'))}
              className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              ↓ .feature files
            </button>
          )}
          <button onClick={() => dl(results, 'bmad-results.json')}
            className="text-xs px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            ↓ All JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-5 overflow-x-auto">
        {entries.map(([key]) => (
          <button key={key} onClick={() => setActive(key)}
            className={`py-3 px-1 mr-6 text-sm border-b-2 whitespace-nowrap transition-colors ${
              active === key
                ? 'border-indigo-600 text-indigo-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tabLabel(key)}
          </button>
        ))}
      </div>

      <div className="p-5">
        <StepResult skillId={active} data={results[active]} />
      </div>
    </div>
  )
}

// ── Chat mode ─────────────────────────────────────────────────────────────────

function ChatMode({ agents }) {
  const [selAgent,   setSelAgent]   = useState('')
  const [input,      setInput]      = useState('')
  const [messages,   setMessages]   = useState([])   // {role, text, streaming?}
  const [streaming,  setStreaming]   = useState(false)
  const [sessionId]                 = useState(() => crypto.randomUUID())
  const wsRef    = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (agents.length && !selAgent) setSelAgent(agents[0].id)
  }, [agents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function connect() {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current
    const ws = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/chat/${sessionId}`
    )
    wsRef.current = ws
    return ws
  }

  function send() {
    if (!input.trim() || streaming) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setStreaming(true)

    const ws = connect()
    const payload = JSON.stringify({ agent_id: selAgent, text })

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    } else {
      ws.onopen = () => ws.send(payload)
    }

    ws.onmessage = e => {
      const ev = JSON.parse(e.data)
      if (ev.type === 'stream_start') {
        setMessages(prev => [...prev, { role: 'assistant', text: '', streaming: true }])
      }
      if (ev.type === 'stream_chunk') {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.streaming) next[next.length - 1] = { ...last, text: last.text + ev.text }
          return next
        })
      }
      if (ev.type === 'stream_end') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, streaming: false } : m
        ))
        setStreaming(false)
      }
      if (ev.type === 'error') {
        setMessages(prev => [...prev, { role: 'error', text: ev.message }])
        setStreaming(false)
      }
    }
  }

  function clearChat() {
    setMessages([])
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ reset: true }))
    }
  }

  const agent = agents.find(a => a.id === selAgent)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Agent picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Chat with agent</label>
          <div className="flex gap-2 flex-wrap">
            {agents.map(a => (
              <button key={a.id} onClick={() => { setSelAgent(a.id); clearChat() }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selAgent === a.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                }`}>
                <AgentDot agentId={a.id} size={10} />
                <span>{a.name}</span>
                <span className={`font-normal ${selAgent === a.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                  · {a.title || a.description || ''}
                </span>
              </button>
            ))}
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-2">
            <AgentDot agentId={selAgent} size={32} />
            <p className="text-sm font-medium text-gray-500">{agent?.name}</p>
            <p className="text-xs max-w-xs">{agent?.description || 'Ask me anything about your project.'}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role !== 'user' && (
              <div className="shrink-0 mt-1"><AgentDot agentId={selAgent} size={24} /></div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : m.role === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{m.text}
                {m.streaming && <span className="animate-pulse text-indigo-400">▌</span>}
              </pre>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={`Message ${agent?.name || 'agent'}… (Enter to send, Shift+Enter for newline)`}
          rows={2}
          className="flex-1 resize-none border-0 focus:outline-none text-sm text-gray-800 placeholder-gray-400"
        />
        <button onClick={send} disabled={!input.trim() || streaming}
          className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
          {streaming ? <span className="animate-spin inline-block">⟳</span> : '↑ Send'}
        </button>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Build({ onRunningChange }) {
  const [mode,        setMode]        = useState('workflow')  // 'workflow' | 'chat'
  const [projects,    setProjects]    = useState([])
  const [workflows,     setWorkflows]     = useState([])
  const [agents,        setAgents]        = useState([])
  const [skills,        setSkills]        = useState([])
  const [selProject,    setSelProject]    = useState('')
  const [selWorkflow,   setSelWorkflow]   = useState('')
  const [docFile,       setDocFile]       = useState(null)
  const [featDesc,      setFeatDesc]      = useState('')
  const [running,       setRunning]       = useState(false)
  const [pipeSteps,     setPipeSteps]     = useState([])
  const [results,       setResults]       = useState(null)
  const [error,         setError]         = useState(null)
  const [newProjName,   setNewProjName]   = useState('')
  const [showNewProj,   setShowNewProj]   = useState(false)
  const [streamAgent,   setStreamAgent]   = useState('')
  const [streamText,    setStreamText]    = useState('')
  const [priorPhases,   setPriorPhases]   = useState([])
  const wsRef        = useRef(null)
  const streamEndRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/workflows').then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
    ]).then(([p, w, a, s]) => {
      if (p.length) { setProjects(p); setSelProject(p[0].id) }
      if (w.length) { setWorkflows(w); setSelWorkflow(w[0].id) }
      setAgents(a); setSkills(s)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selProject) { setPriorPhases([]); return }
    fetch(`/api/projects/${selProject}/context`)
      .then(r => r.json())
      .then(ctx => setPriorPhases(Object.keys(ctx || {})))
      .catch(() => setPriorPhases([]))
  }, [selProject, results])

  function handleBuild() {
    setRunning(true); onRunningChange?.(true); setResults(null); setError(null)

    const wf    = workflows.find(w => w.id === selWorkflow)
    const steps = (wf?.steps || []).filter(s => s.enabled !== false)
    setPipeSteps(steps.map(s => ({ ...s, status: 'waiting', log: null })))

    const runId = crypto.randomUUID()
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${runId}`
    const ws    = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({
      document:            docFile?.content || '',
      feature_description: featDesc,
      workflow_id:         selWorkflow,
      project_name:        projects.find(p => p.id === selProject)?.name || 'Project',
      project_id:          selProject || '',
    }))

    setStreamText(''); setStreamAgent('')

    ws.onmessage = e => {
      const ev = JSON.parse(e.data)
      if (ev.type === 'stream_start') {
        setStreamAgent(`${ev.agent} · ${ev.skill}`)
        setStreamText('')
      }
      if (ev.type === 'stream_chunk') {
        setStreamText(prev => {
          const next = prev + ev.text
          setTimeout(() => streamEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
          return next
        })
      }
      if (ev.type === 'stream_end') {
        // keep text visible until next step starts
      }
      if (ev.type === 'agent_start') {
        setPipeSteps(prev => prev.map((s, i) => i === ev.index ? { ...s, status: 'running' } : s))
      }
      if (ev.type === 'agent_log') {
        setPipeSteps(prev => {
          const idx = prev.findLastIndex(s => s.status === 'running')
          return prev.map((s, i) => i === idx ? { ...s, log: ev.text } : s)
        })
      }
      if (ev.type === 'agent_complete') {
        setPipeSteps(prev => {
          const idx = prev.findLastIndex(s => s.status === 'running')
          return prev.map((s, i) => i === idx ? { ...s, status: 'done', log: null } : s)
        })
      }
      if (ev.type === 'agent_error') {
        setPipeSteps(prev => {
          const idx = prev.findLastIndex(s => s.status === 'running')
          return prev.map((s, i) => i === idx ? { ...s, status: 'error', log: ev.error } : s)
        })
      }
      if (ev.type === 'workflow_complete') { setResults(ev.results); setRunning(false); onRunningChange?.(false) }
      if (ev.type === 'error')             { setError(ev.message);   setRunning(false); onRunningChange?.(false) }
    }

    ws.onerror = () => { setError('Connection failed. Is the backend running on port 8000?'); setRunning(false); onRunningChange?.(false) }
    ws.onclose = ()  => { setRunning(false); onRunningChange?.(false) }
  }

  async function createProject() {
    if (!newProjName.trim()) return
    const res  = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProjName.trim() }) })
    const proj = await res.json()
    setProjects(prev => [...prev, proj])
    setSelProject(proj.id)
    setNewProjName('')
    setShowNewProj(false)
  }

  const selectedWf   = workflows.find(w => w.id === selWorkflow)
  const enabledSteps = (selectedWf?.steps || []).filter(s => s.enabled !== false)

  const showStream = running || (pipeSteps.length > 0 && !results)

  return (
    <div className={`flex gap-6 ${showStream ? '' : 'max-w-3xl'}`}>
    <div className={showStream ? 'w-[520px] shrink-0' : 'flex-1'}>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { id: 'workflow', label: 'Workflow Runner', icon: '⚡' },
          { id: 'chat',     label: 'Agent Chat',      icon: '💬' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === m.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'chat' && <ChatMode agents={agents} />}
      {mode !== 'chat' && <>

      {/* Project + Workflow */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 gap-5">

          {/* Project picker + inline create */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Project <span className="text-red-500">*</span>
            </label>
            {showNewProj ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createProject()
                    if (e.key === 'Escape') { setShowNewProj(false); setNewProjName('') }
                  }}
                  placeholder="Project name…"
                  className="flex-1 border border-indigo-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={createProject} disabled={!newProjName.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  Add
                </button>
                <button onClick={() => { setShowNewProj(false); setNewProjName('') }}
                  className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 text-gray-600">
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={selProject} onChange={e => setSelProject(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {projects.length === 0 && <option value="">No projects yet…</option>}
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={() => setShowNewProj(true)}
                  title="Create new project"
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 text-sm font-medium transition-colors">
                  +
                </button>
              </div>
            )}
          </div>

          <Select label="Workflow" value={selWorkflow} onChange={setSelWorkflow}
            options={workflows.map(w => ({
              value: w.id,
              label: `${w.name} (${(w.steps||[]).filter(s=>s.enabled!==false).length} steps)`
            }))} />
        </div>

        {/* Show pipeline steps */}
        {enabledSteps.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {enabledSteps.map((s, i) => {
              const ag = agents.find(a => a.id === s.agent_id)
              return (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                  <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    <AgentDot agentId={s.agent_id} size={12} />
                    {ag?.name} <span className="text-gray-400 font-mono">· {s.skill_id}</span>
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Document upload */}
      <DocumentUpload file={docFile} onFile={setDocFile} />

      {/* Special Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Special Instructions
          <span className="text-gray-400 font-normal ml-1">What should the agents work on? (optional)</span>
        </label>
        <textarea value={featDesc} onChange={e => setFeatDesc(e.target.value)}
          placeholder="Describe the feature or task. The agents will use this along with your uploaded document…"
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Prior context badge */}
      {priorPhases.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-indigo-500 text-sm">📎</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-800">Cross-phase context loaded</p>
            <p className="text-xs text-indigo-600 truncate">
              Agents will use results from: {priorPhases.join(' → ')}
            </p>
          </div>
        </div>
      )}

      {/* Run button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">🚀 Build Feature</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedWf?.name} · {enabledSteps.length} BMAD agent steps
            </p>
          </div>
          <button onClick={handleBuild} disabled={running}
            className="shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {running ? <><span className="animate-spin inline-block">⟳</span> Running…</> : '🚀 Run Agents'}
          </button>
        </div>
      </div>

      {/* Pipeline progress */}
      {pipeSteps.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Agent Pipeline</h2>
          <div className="space-y-2">
            {pipeSteps.map((s, i) => (
              <PipelineStep key={i} step={s} agents={agents} status={s.status} log={s.log} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">❌ {error}</div>
      )}

      {/* Results */}
      {results && (
        <ResultsPanel results={results} workflow={selectedWf} agents={agents} skills={skills} />
      )}
      </>}
    </div>

    {/* ── Live stream panel ── */}
    {showStream && (
      <div className="flex-1 min-w-0">
        <div className="sticky top-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
            </span>
            <h2 className="text-sm font-semibold text-gray-700">
              {streamAgent || 'Waiting for agent…'}
            </h2>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden"
               style={{ height: 'calc(100vh - 120px)' }}>
            <div className="overflow-y-auto h-full p-4">
              {streamText ? (
                <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {streamText}
                  <span className="animate-pulse text-indigo-400">▌</span>
                </pre>
              ) : (
                <div className="flex items-center gap-2 text-gray-500 text-xs mt-2">
                  <span className="animate-spin inline-block">⟳</span>
                  Agent is thinking…
                </div>
              )}
              <div ref={streamEndRef} />
            </div>
          </div>
        </div>
      </div>
    )}

    </div>
  )
}
