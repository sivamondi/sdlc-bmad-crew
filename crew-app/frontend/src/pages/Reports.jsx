import { useState, useEffect } from 'react'

function StatusBadge({ status }) {
  const s = {
    completed: 'bg-green-100 text-green-700',
    running:   'bg-blue-100  text-blue-700',
    failed:    'bg-red-100   text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function Reports() {
  const [runs, setRuns]     = useState([])
  const [loading, setLoad]  = useState(true)
  const [expanded, setExp]  = useState(null)

  useEffect(() => {
    fetch('/api/runs').then(r => r.json()).then(d => { setRuns(d); setLoad(false) })
      .catch(() => setLoad(false))
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">📊 Reports</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No runs yet. Build a feature to see reports here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExp(expanded === run.id ? null : run.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={run.status} />
                  <span className="text-sm font-medium text-gray-900 truncate">{run.project} · {run.workflow}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-gray-400">{new Date(run.created_at + 'Z').toLocaleString()}</span>
                  <span className={`text-gray-400 transition-transform ${expanded === run.id ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>

              {expanded === run.id && run.results && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                  {run.results.requirements && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Features extracted</p>
                      <p className="text-sm text-gray-700">{run.results.requirements.features?.length ?? 0} features · {run.results.requirements.user_roles?.length ?? 0} roles</p>
                    </div>
                  )}
                  {run.results.stories && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">JIRA Stories</p>
                      <p className="text-sm text-gray-700">{run.results.stories.stories?.length ?? 0} stories created</p>
                    </div>
                  )}
                  {run.results.bdd_files && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">BDD Files</p>
                      <p className="text-sm text-gray-700">{run.results.bdd_files.files?.length ?? 0} .feature files generated</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
