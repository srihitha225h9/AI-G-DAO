"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useClimateDAO } from "@/hooks/use-climate-dao"
import { useAIReview } from "@/hooks/use-ai-review"
import { AIReviewDisplay } from "@/components/ai-review-display"
import Link from "next/link"
import { WalletGuard } from "@/components/wallet-guard"
import { useWalletContext } from "@/hooks/use-wallet"
import {
  ArrowLeftIcon, SparklesIcon, CoinsIcon, ClockIcon,
  CheckCircleIcon, XCircleIcon, UsersIcon, UserIcon, ShieldIcon
} from "lucide-react"

const CATEGORY_COLORS: Record<string, string> = {
  'renewable-energy':       'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'carbon-capture':         'bg-green-500/20 text-green-400 border-green-500/50',
  'reforestation':          'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  'ocean-cleanup':          'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'waste-management':       'bg-orange-500/20 text-orange-400 border-orange-500/50',
  'sustainable-agriculture':'bg-lime-500/20 text-lime-400 border-lime-500/50',
  'water-conservation':     'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  'transportation':         'bg-purple-500/20 text-purple-400 border-purple-500/50',
}

export default function ProposalDetailPage() {
  const params = useParams()
  const proposalId = params?.id ? Number(params.id) : null
  const { getProposal } = useClimateDAO()
  const { address } = useWalletContext()
  const { isAnalyzing, reviewResult, analyzeProposalData } = useAIReview()
  const [proposal, setProposal] = useState<any>(null)
  const [aiReview, setAiReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reputation, setReputation] = useState<any>(null)
  const [milestoneVoting, setMilestoneVoting] = useState<Record<number, 'for' | 'against'>>({})  
  const [milestoneVotingId, setMilestoneVotingId] = useState<number | null>(null)

  // Load persisted milestone votes for this wallet+proposal from localStorage
  useEffect(() => {
    if (!address || !proposalId) return
    try {
      const stored = localStorage.getItem(`milestone_votes_${proposalId}_${address}`)
      if (stored) setMilestoneVoting(JSON.parse(stored))
    } catch {}
  }, [address, proposalId])
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [draftMilestones, setDraftMilestones] = useState([
    { title: '', description: '', percent: 33, status: 'pending', voteYes: 0, voteNo: 0 },
    { title: '', description: '', percent: 34, status: 'pending', voteYes: 0, voteNo: 0 },
    { title: '', description: '', percent: 33, status: 'pending', voteYes: 0, voteNo: 0 },
  ])
  const [savingMilestones, setSavingMilestones] = useState(false)

  useEffect(() => {
    if (reviewResult) setAiReview(reviewResult)
  }, [reviewResult])

  useEffect(() => {
    if (!proposalId) return
    const load = async () => {
      setLoading(true)
      try {
        const p = await getProposal(proposalId)
        setProposal(p)
        if (p?.aiReview) {
          setAiReview(p.aiReview)
        } else {
          try {
            const stored = localStorage.getItem(`proposal_ai_${proposalId}`)
            if (stored) setAiReview(JSON.parse(stored))
          } catch {}
        }
        // Load reputation for proposer
        if (p?.creator) {
          try {
            const r = await fetch(`/api/reputation?wallet=${encodeURIComponent(p.creator)}`)
            if (r.ok) setReputation(await r.json())
          } catch {}
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [proposalId])

  const handleMilestoneVote = async (milestoneIdx: number, vote: 'for' | 'against') => {
    if (!proposal || !address) return
    setMilestoneVotingId(milestoneIdx)
    try {
      const updatedMilestones = proposal.milestones.map((m: any, i: number) => {
        if (i !== milestoneIdx) return m
        const newVoteYes = vote === 'for' ? (m.voteYes || 0) + 1 : (m.voteYes || 0)
        const newVoteNo = vote === 'against' ? (m.voteNo || 0) + 1 : (m.voteNo || 0)
        const total = newVoteYes + newVoteNo
        const newStatus = total >= 3 ? (newVoteYes / total > 0.5 ? 'completed' : 'failed') : m.status
        return { ...m, voteYes: newVoteYes, voteNo: newVoteNo, status: newStatus }
      })
      await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposal.id, milestones: updatedMilestones }),
      })
      setProposal((prev: any) => ({ ...prev, milestones: updatedMilestones }))
      // Persist this wallet's vote so buttons hide on reload
      const updated = { ...milestoneVoting, [milestoneIdx]: vote }
      setMilestoneVoting(updated)
      localStorage.setItem(`milestone_votes_${proposal.id}_${address}`, JSON.stringify(updated))
    } finally {
      setMilestoneVotingId(null)
    }
  }

  const handleSaveMilestones = async () => {
    if (!proposal) return
    const totalPercent = draftMilestones.reduce((s, m) => s + m.percent, 0)
    if (totalPercent !== 100) { alert('Percentages must add up to 100%'); return }
    if (draftMilestones.some(m => !m.title.trim())) { alert('Please fill in all milestone titles'); return }
    setSavingMilestones(true)
    try {
      await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposal.id, milestones: draftMilestones }),
      })
      setProposal((prev: any) => ({ ...prev, milestones: draftMilestones }))
      setShowMilestoneForm(false)
    } finally {
      setSavingMilestones(false)
    }
  }

  if (!proposalId) return null

  const totalVotes = proposal ? proposal.voteYes + proposal.voteNo : 0
  const yesPercent = totalVotes > 0 ? (proposal.voteYes / totalVotes) * 100 : 0
  const timeLeft = proposal ? Math.ceil((proposal.endTime - Date.now()) / (24 * 60 * 60 * 1000)) : 0

  return (
    <WalletGuard requireBalance={0}>
      <div className="relative flex flex-col min-h-[100dvh] text-white overflow-hidden">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
          <Link href="/vote" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm">Back to Votes</span>
          </Link>
          <span className="font-bold text-base">Proposal Details</span>
          <div className="flex items-center gap-1 text-yellow-400 text-sm">
            <SparklesIcon className="w-4 h-4" />
            <span className="hidden sm:inline">AI Analysis</span>
          </div>
        </header>

        <main className="relative z-10 flex-1 px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-5">

            {loading ? (
              <div className="text-center py-20">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/50 text-sm">Loading proposal...</p>
              </div>
            ) : !proposal ? (
              <Card className="bg-white/5 border-white/10 rounded-2xl">
                <CardContent className="py-12 text-center text-white/50">Proposal not found.</CardContent>
              </Card>
            ) : (
              <>
                {/* Title + Badges */}
                <div className="space-y-3">
                  <h1 className="text-2xl font-bold text-white leading-snug">{proposal.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={CATEGORY_COLORS[proposal.category] || 'bg-gray-500/20 text-gray-400'}>
                      {proposal.category.replace(/-/g, ' ')}
                    </Badge>
                    <Badge className={
                      proposal.status === 'active'   ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                      proposal.status === 'passed'   ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      proposal.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }>
                      {proposal.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: CoinsIcon,       color: 'text-purple-400', val: `$${proposal.fundingAmount.toLocaleString()}`, label: 'Funding' },
                    { icon: UsersIcon,       color: 'text-blue-400',   val: totalVotes,                                    label: 'Total Votes' },
                    { icon: CheckCircleIcon, color: 'text-green-400',  val: `${yesPercent.toFixed(0)}%`,                  label: 'Yes Votes' },
                    { icon: ClockIcon,       color: 'text-yellow-400', val: proposal.status === 'active' ? `${timeLeft}d` : '—', label: 'Time Left' },
                  ].map(({ icon: Icon, color, val, label }) => (
                    <Card key={label} className="bg-white/5 border-white/10 rounded-2xl">
                      <CardContent className="p-3 text-center">
                        <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
                        <div className="text-lg font-bold text-white">{val}</div>
                        <div className="text-xs text-white/50">{label}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Vote bar */}
                <Card className="bg-white/5 border-white/10 rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm text-white/60">
                      <span>✓ Yes — {proposal.voteYes} votes ({yesPercent.toFixed(0)}%)</span>
                      <span>✗ No — {proposal.voteNo} votes ({(100 - yesPercent).toFixed(0)}%)</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          proposal.status === 'passed' ? 'bg-green-500' :
                          proposal.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${yesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40 text-center">
                      {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · needs 3 to decide
                    </p>
                  </CardContent>
                </Card>

                {/* Passed banner */}
                {proposal.status === 'passed' && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <CoinsIcon className="w-5 h-5 text-green-400 shrink-0" />
                    <div>
                      <p className="text-green-400 font-semibold text-sm">Proposal Approved!</p>
                      <p className="text-green-300/70 text-xs">${proposal.fundingAmount.toLocaleString()} approved. Funding released in milestones.</p>
                    </div>
                  </div>
                )}

                {/* Reputation badge */}
                {reputation && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <ShieldIcon className={`w-5 h-5 shrink-0 ${
                      reputation.reputation_score >= 75 ? 'text-green-400' :
                      reputation.reputation_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-white/80 text-sm font-medium">Proposer Reputation</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`text-xs font-bold ${
                          reputation.reputation_score >= 75 ? 'text-green-400' :
                          reputation.reputation_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{reputation.reputation_score}/100</span>
                        <span className="text-white/40 text-xs">{reputation.milestones_completed} milestones completed</span>
                        <span className="text-white/40 text-xs">{reputation.proposals_submitted} proposals submitted</span>
                        <span className="text-white/40 text-xs">Max: {reputation.max_funding_algo} ALGO</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MILESTONE SECTION (only shown after proposal passes) ── */}
                {proposal.status === 'passed' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-semibold flex items-center gap-2">
                        <CoinsIcon className="w-4 h-4 text-purple-400" />
                        Funding Milestones
                      </h2>
                    </div>

                    {/* Proposer hasn't defined milestones yet */}
                    {!proposal.milestones && address === proposal.creator && !showMilestoneForm && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
                        <p className="text-yellow-300 text-sm font-medium">🎉 Your proposal was approved!</p>
                        <p className="text-white/60 text-xs">Now define how you'll use the funds across 3 milestones. The community will vote to release each tranche after you complete it.</p>
                        <Button
                          onClick={() => setShowMilestoneForm(true)}
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 rounded-xl text-sm"
                        >
                          📋 Define Milestones
                        </Button>
                      </div>
                    )}

                    {/* Waiting message for non-proposer when milestones not defined */}
                    {!proposal.milestones && address !== proposal.creator && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-white/50 text-sm text-center">⏳ Waiting for proposer to define funding milestones...</p>
                      </div>
                    )}

                    {/* Milestone definition form — only proposer, only once */}
                    {showMilestoneForm && (
                      <Card className="bg-white/5 border border-yellow-500/20 rounded-2xl">
                        <CardContent className="p-4 space-y-4">
                          <p className="text-white/70 text-xs">Split your ${proposal.fundingAmount.toLocaleString()} into 3 stages. Percentages must total 100%.</p>
                          {/* Quick split buttons */}
                          <div className="flex gap-1 flex-wrap">
                            {[[33,34,33],[30,40,30],[25,50,25],[50,30,20]].map(vals => (
                              <button key={vals.join()} type="button"
                                onClick={() => setDraftMilestones(prev => prev.map((m,i) => ({ ...m, percent: vals[i] })))}
                                className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/15 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                              >{vals.join('% / ')}%</button>
                            ))}
                          </div>
                          {draftMilestones.map((m, i) => {
                            const amt = Math.round((proposal.fundingAmount * m.percent) / 100)
                            return (
                              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    i === 0 ? 'bg-blue-500/30 text-blue-300' :
                                    i === 1 ? 'bg-purple-500/30 text-purple-300' :
                                    'bg-green-500/30 text-green-300'
                                  }`}>{i+1}</span>
                                  <span className="text-white/60 text-xs">Stage {i+1} — {m.percent}% (${amt.toLocaleString()})</span>
                                  <input type="number" min={1} max={98}
                                    value={m.percent}
                                    onChange={e => setDraftMilestones(prev => prev.map((x,j) => j===i ? {...x, percent: Number(e.target.value)} : x))}
                                    className="ml-auto w-14 bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2 py-1 text-center"
                                  />
                                  <span className="text-white/40 text-xs">%</span>
                                </div>
                                <input
                                  placeholder={['e.g. Purchase equipment & permits','e.g. Installation & setup complete','e.g. System operational, photos submitted'][i]}
                                  value={m.title}
                                  onChange={e => setDraftMilestones(prev => prev.map((x,j) => j===i ? {...x, title: e.target.value} : x))}
                                  className="w-full bg-white/5 border border-white/15 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                                />
                                <textarea
                                  placeholder="What proof will you submit? (photos, invoices, reports...)"
                                  value={m.description}
                                  onChange={e => setDraftMilestones(prev => prev.map((x,j) => j===i ? {...x, description: e.target.value} : x))}
                                  rows={2}
                                  className="w-full bg-white/5 border border-white/15 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-white/30"
                                />
                              </div>
                            )
                          })}
                          <div className="flex gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setShowMilestoneForm(false)}
                              className="flex-1 text-white/50 hover:text-white border border-white/10 rounded-xl text-sm">
                              Cancel
                            </Button>
                            <Button onClick={handleSaveMilestones} disabled={savingMilestones}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                              {savingMilestones ? 'Saving...' : '✓ Submit Milestones'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Milestone cards — shown once proposer has defined them */}
                    {proposal.milestones && proposal.milestones.map((m: any, i: number) => {
                      const amount = Math.round((proposal.fundingAmount * m.percent) / 100)
                      const mTotal = (m.voteYes || 0) + (m.voteNo || 0)
                      const mYesPct = mTotal > 0 ? Math.round((m.voteYes / mTotal) * 100) : 0
                      const myVote = milestoneVoting[i]          // persisted vote for this wallet
                      const isVoting = milestoneVotingId === i
                      const isProposer = address === proposal.creator
                      // milestone i is open when all previous milestones are completed
                      const prevCompleted = i === 0 || proposal.milestones[i - 1]?.status === 'completed'
                      const canVote = m.status === 'pending' && prevCompleted && !myVote && !isProposer && !!address

                      return (
                        <Card key={i} className={`border rounded-2xl ${
                          m.status === 'completed' ? 'bg-green-500/5 border-green-500/20' :
                          m.status === 'failed'    ? 'bg-red-500/5 border-red-500/20' :
                          'bg-white/5 border-white/10'
                        }`}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  i === 0 ? 'bg-blue-500/30 text-blue-300' :
                                  i === 1 ? 'bg-purple-500/30 text-purple-300' :
                                  'bg-green-500/30 text-green-300'
                                }`}>{i + 1}</span>
                                <span className="text-white font-medium text-sm">{m.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-white/50 text-xs">${amount.toLocaleString()} ({m.percent}%)</span>
                                <Badge className={`text-xs ${
                                  m.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                  m.status === 'failed'    ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                  'bg-white/10 text-white/50 border-white/20'
                                }`}>
                                  {m.status === 'completed' ? '✓ Released' : m.status === 'failed' ? '✗ Rejected' : '⏳ Pending'}
                                </Badge>
                              </div>
                            </div>

                            {m.description && <p className="text-white/50 text-xs pl-8">{m.description}</p>}

                            {/* Vote bar — always visible once anyone has voted */}
                            {mTotal > 0 && (
                              <div className="pl-8 space-y-1">
                                <div className="flex justify-between text-xs text-white/40">
                                  <span>✓ {m.voteYes || 0} yes ({mYesPct}%)</span>
                                  <span>✗ {m.voteNo || 0} no · needs 3</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${
                                    m.status === 'completed' ? 'bg-green-500' :
                                    m.status === 'failed'    ? 'bg-red-500' : 'bg-blue-500'
                                  }`} style={{ width: `${mYesPct}%` }} />
                                </div>
                              </div>
                            )}

                            {/* Vote buttons — community only, once per wallet */}
                            {canVote && (
                              <div className="flex gap-2 pl-8 pt-1">
                                <Button size="sm" onClick={() => handleMilestoneVote(i, 'for')} disabled={isVoting}
                                  className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl h-8 text-xs">
                                  {isVoting ? '...' : '✓ Approve Release'}
                                </Button>
                                <Button size="sm" onClick={() => handleMilestoneVote(i, 'against')} disabled={isVoting}
                                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl h-8 text-xs">
                                  {isVoting ? '...' : '✗ Reject'}
                                </Button>
                              </div>
                            )}

                            {/* Already voted — show what they voted */}
                            {myVote && m.status === 'pending' && (
                              <p className={`text-xs pl-8 ${
                                myVote === 'for' ? 'text-green-400/70' : 'text-red-400/70'
                              }`}>
                                ✓ You voted {myVote === 'for' ? 'Approve' : 'Reject'} — waiting for more votes
                              </p>
                            )}

                            {/* Locked — previous milestone not done */}
                            {m.status === 'pending' && !prevCompleted && (
                              <p className="text-xs text-white/30 pl-8">🔒 Unlocks after Milestone {i} is completed</p>
                            )}

                            {/* Proposer view */}
                            {m.status === 'pending' && prevCompleted && isProposer && (
                              <p className="text-xs text-white/30 pl-8">⏳ Waiting for community to vote ({mTotal}/3 votes so far)</p>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {/* Description */}
                <Card className="bg-white/5 border-white/10 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-base">Project Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
                  </CardContent>
                </Card>

                {/* Submitter */}
                <div className="flex items-center gap-2 text-white/40 text-xs px-1">
                  <UserIcon className="w-3 h-3" />
                  <span className="font-mono truncate">Submitted by: {proposal.creator}</span>
                </div>

                {/* AI Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-white font-semibold">AI Analysis</h2>
                  </div>

                  {aiReview ? (
                    <AIReviewDisplay review={aiReview} />
                  ) : (
                    <Card className="bg-white/5 border-white/10 rounded-2xl">
                      <CardContent className="py-8 text-center space-y-3">
                        <SparklesIcon className="w-10 h-10 text-white/20 mx-auto" />
                        <p className="text-white/50 text-sm">No AI analysis available for this proposal yet.</p>
                        <Button
                          onClick={() => analyzeProposalData({
                            title: proposal.title,
                            description: proposal.description,
                            category: proposal.category || 'general',
                            fundingAmount: String(proposal.fundingAmount || 0),
                            expectedImpact: proposal.expectedImpact || 'To be determined',
                            location: proposal.location || 'Global',
                          }, proposalId)}
                          disabled={isAnalyzing}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        >
                          {isAnalyzing ? 'Analyzing...' : '🤖 Run AI Analysis'}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Back to vote */}
                <Link href="/vote">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl mt-2">
                    ← Back to Community Votes
                  </Button>
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    </WalletGuard>
  )
}
