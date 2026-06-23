'use client'

import { useState } from 'react'

const TRADES = [
  'Electrician', 'Plumber', 'HVAC Technician', 'Welder', 'Carpenter',
  'Pipefitter', 'Ironworker', 'Sheet Metal Worker', 'Roofer', 'Bricklayer',
  'Painter', 'Concrete Finisher', 'Heavy Equipment Operator', 'Mechanic',
  'Diesel Technician', 'Millwright', 'Boilermaker', 'Insulator',
]

const EXPERIENCE_LEVELS = [
  'Apprentice (0–2 years)',
  'Journeyman (3–7 years)',
  'Senior / Master (8+ years)',
  'Foreman / Supervisor',
]

export default function Home() {
  const [form, setForm] = useState({
    trade: '',
    experience: '',
    skills: '',
    jobTitle: '',
    companyName: '',
    yourName: '',
  })
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [usesLeft, setUsesLeft] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('usesLeft') ?? 3)
    }
    return 3
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleGenerate = async () => {
    if (usesLeft <= 0) {
      setError('You have used your 3 free cover letters. Upgrade to Pro for unlimited access.')
      return
    }
    if (!form.trade || !form.experience || !form.yourName) {
      setError('Please fill in your trade, experience level, and your name.')
      return
    }
    setError('')
    setLoading(true)
    setLetter('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setLetter(data.letter)
      const newUses = usesLeft - 1
      setUsesLeft(newUses)
      localStorage.setItem('usesLeft', String(newUses))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔧</span>
          <span className="font-bold text-lg text-orange-400">TradesCoverLetter</span>
          <span className="text-stone-400 text-sm">.com</span>
        </div>
        <div className="text-xs text-stone-400 bg-stone-800 px-3 py-1 rounded-full">
          {usesLeft} free {usesLeft === 1 ? 'use' : 'uses'} left
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-6 py-14 max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
          Land the job.<br />
          <span className="text-orange-400">Skip the blank page.</span>
        </h1>
        <p className="text-stone-400 text-lg mb-2">
          A professional cover letter built for trades workers — in under 60 seconds.
        </p>
        <p className="text-stone-500 text-sm">
          Electricians · Plumbers · HVAC · Welders · Carpenters · and more
        </p>
      </section>

      {/* Form */}
      <section className="max-w-xl mx-auto px-6 pb-20">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-stone-300 mb-1">Your Name *</label>
              <input
                name="yourName"
                value={form.yourName}
                onChange={handleChange}
                placeholder="John Smith"
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-300 mb-1">Your Trade *</label>
              <select
                name="trade"
                value={form.trade}
                onChange={handleChange}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
              >
                <option value="">Select trade...</option>
                {TRADES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-stone-300 mb-1">Experience Level *</label>
            <select
              name="experience"
              value={form.experience}
              onChange={handleChange}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
            >
              <option value="">Select level...</option>
              {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-stone-300 mb-1">Your Top Skills / Certifications <span className="text-stone-500">(optional)</span></label>
            <input
              name="skills"
              value={form.skills}
              onChange={handleChange}
              placeholder="e.g. OSHA 10, conduit bending, PLC troubleshooting"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-orange-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-stone-300 mb-1">Job Title Applying For <span className="text-stone-500">(optional)</span></label>
              <input
                name="jobTitle"
                value={form.jobTitle}
                onChange={handleChange}
                placeholder="e.g. Lead Electrician"
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-300 mb-1">Company Name <span className="text-stone-500">(optional)</span></label>
              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                placeholder="e.g. Apex Electric Co."
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || usesLeft <= 0}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold py-3 rounded-xl transition-colors text-base"
          >
            {loading ? '✍️ Writing your letter...' : '⚡ Generate My Cover Letter'}
          </button>

          {usesLeft <= 0 && (
            <div className="text-center text-sm text-stone-400 bg-stone-800 rounded-xl p-4">
              <p className="font-semibold text-white mb-1">You've used all 3 free letters</p>
              <p>Upgrade to Pro for unlimited cover letters — <span className="text-orange-400">$7/month</span></p>
              <button className="mt-3 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors">
                Upgrade to Pro →
              </button>
            </div>
          )}
        </div>

        {/* Output */}
        {letter && (
          <div className="mt-6 bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-orange-400">Your Cover Letter</h2>
              <button
                onClick={handleCopy}
                className="text-xs bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-stone-200 leading-relaxed font-sans">{letter}</pre>
          </div>
        )}

        {/* Social proof */}
        <div className="mt-10 text-center text-stone-500 text-xs space-y-1">
          <p>⭐⭐⭐⭐⭐ "Got a callback within 2 days of sending this letter." — Mike T., Plumber</p>
          <p>⭐⭐⭐⭐⭐ "Finally a tool that speaks like a real tradesman." — Sara K., HVAC Tech</p>
        </div>
      </section>
    </main>
  )
}
