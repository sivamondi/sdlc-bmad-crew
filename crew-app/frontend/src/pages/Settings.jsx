import { useState, useEffect } from 'react'

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function Settings() {
  const [s, setS]       = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setS).catch(() => {})
  }, [])

  function set(key) { return val => setS(prev => ({ ...prev, [key]: val })) }

  async function save() {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">⚙️ Settings</h1>

      <div className="space-y-5">
        {/* Claude */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Claude / Anthropic</h2>
          <div className="space-y-4">
            <Field
              label="Anthropic API Key" type="password"
              value={s.anthropic_api_key || ''} onChange={set('anthropic_api_key')}
              placeholder="sk-ant-..."
              hint="Required. Get yours at console.anthropic.com"
            />
            <Field
              label="Default Model"
              value={s.default_model || 'claude-opus-4-6'} onChange={set('default_model')}
              placeholder="claude-opus-4-6"
              hint="Model ID used by all agents unless overridden per workflow"
            />
          </div>
        </section>

        {/* JIRA */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">JIRA Integration</h2>
          <p className="text-xs text-gray-400 mb-4">Optional. When configured, stories are pushed directly to JIRA.</p>
          <div className="space-y-4">
            <Field
              label="JIRA Server URL"
              value={s.jira_url || ''} onChange={set('jira_url')}
              placeholder="https://yourcompany.atlassian.net"
            />
            <Field
              label="JIRA Email"
              value={s.jira_email || ''} onChange={set('jira_email')}
              placeholder="you@company.com"
            />
            <Field
              label="JIRA API Token" type="password"
              value={s.jira_api_token || ''} onChange={set('jira_api_token')}
              placeholder="ATATT..."
              hint="Generate at id.atlassian.com/manage-profile/security/api-tokens"
            />
            <Field
              label="JIRA Project Key"
              value={s.jira_project_key || ''} onChange={set('jira_project_key')}
              placeholder="FEAT"
              hint="The short key for your project (e.g. FEAT, PROD, APP)"
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Settings
          </button>
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </div>
    </div>
  )
}
