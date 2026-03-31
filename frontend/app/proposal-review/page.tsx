"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftIcon, SparklesIcon, CheckCircleIcon, CoinsIcon, MapPinIcon, ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { useAIReview } from "@/hooks/use-ai-review"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

const AIReviewDisplay = dynamic(() => import("@/components/ai-review-display").then(mod => ({ default: mod.AIReviewDisplay })), {
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-64"></div>
})

const CATEGORY_COLORS: Record<string, string> = {
  'renewable-energy':        'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'carbon-capture':          'bg-green-500/20 text-green-400 border-green-500/50',
  'reforestation':           'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  'ocean-cleanup':           'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'waste-management':        'bg-orange-500/20 text-orange-400 border-orange-500/50',
  'sustainable-agriculture': 'bg-lime-500/20 text-lime-400 border-lime-500/50',
  'water-conservation':      'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  'transportation':          'bg-purple-500/20 text-purple-400 border-purple-500/50',
  'climate-education':       'bg-pink-500/20 text-pink-400 border-pink-500/50',
}

export default function ProposalReviewPage() {
  const { isAnalyzing, reviewResult, analyzeProposalData } = useAIReview()
  const router = useRouter()
  const [proposal, setProposal] = useState<any>(null)
  const [proposalId, setProposalId] = useState<number | null>(null)

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const draft = sessionStorage.getItem('proposalDraft')
      if (!draft) { router.push('/submit-proposal'); return }
      const parsed = JSON.parse(draft)
      setProposal(parsed)
      if (parsed.proposalId) setProposalId(parsed.proposalId)

      // Auto-run AI analysis
      analyzeProposalData({
        title: parsed.title || '',
        description: parsed.description || '',
        category: parsed.category || 'general',
        fundingAmount: parsed.fundingAmount ? String(parsed.fundingAmount) : '0',
        expectedImpact: parsed.expectedImpact || 'To be determined',
        location: parsed.location || 'Global',
      }, parsed.proposalId)

      sessionStorage.removeItem('proposalDraft')
    } catch (err) {
      console.warn('Failed to load proposal draft:', err)
    }
  }, [])

  // Save AI review to DB once done
  useEffect(() => {
    if (!reviewResult || !proposalId) return
    fetch('/api/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: proposalId, ai_review: reviewResult }),
    }).catch(() => {})
  }, [reviewResult, proposalId])

  if (!proposal) return null

  return (
    <div className="relative flex flex-col min-h-[100dvh] text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
        <Link href="/submit-proposal" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>
        <span className="font-bold text-base">Proposal Submitted</span>
        <div className="flex items-center gap-1 text-green-400 text-sm">
          <CheckCircleIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Saved</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Success banner */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-4 flex items-center gap-3">
            <CheckCircleIcon className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 font-semibold text-sm">Proposal submitted successfully!</p>
              <p className="text-green-300/70 text-xs">Your proposal is now live for community voting.</p>
            </div>
          </div>

          {/* Proposal summary */}
          <Card className="bg-white/5 border-white/10 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Your Proposal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <h2 className="text-white font-bold text-lg leading-snug">{proposal.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge className={CATEGORY_COLORS[proposal.category] || 'bg-gray-500/20 text-gray-400'}>
                  {(proposal.category || '').replace(/-/g, ' ')}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">ACTIVE</Badge>
              </div>
              <div className="flex items-center gap-4 text-white/50 text-xs flex-wrap">
                <span className="flex items-center gap-1">
                  <CoinsIcon className="w-3 h-3" />${Number(proposal.fundingAmount).toLocaleString()} requested
                </span>
                {proposal.location && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="w-3 h-3" />{proposal.location}
                  </span>
                )}
                {proposal.duration && (
                  <span className="text-white/40">⏱ {proposal.duration}</span>
                )}
              </div>

              <div className="border-t border-white/10 pt-3 space-y-3">
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-1">Description</p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
                </div>

                {proposal.expectedImpact && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                    <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Expected Climate Impact</p>
                    <p className="text-white/70 text-sm leading-relaxed">{proposal.expectedImpact}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-yellow-400" />
              <h2 className="text-white font-semibold">AI Analysis</h2>
              {isAnalyzing && (
                <div className="flex items-center gap-1.5 text-yellow-400/70 text-xs">
                  <div className="w-3 h-3 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                  Analyzing...
                </div>
              )}
            </div>

            {isAnalyzing && !reviewResult && (
              <Card className="bg-white/5 border-white/10 rounded-2xl">
                <CardContent className="py-10 text-center space-y-3">
                  <div className="w-10 h-10 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto" />
                  <p className="text-white/50 text-sm">Running AI analysis on your proposal...</p>
                </CardContent>
              </Card>
            )}

            {reviewResult && <AIReviewDisplay review={reviewResult} />}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/vote" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 flex items-center gap-2">
                View in Community Votes
                <ArrowRightIcon className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/submit-proposal" className="flex-1">
              <Button variant="ghost" className="w-full border border-white/10 text-white/60 hover:text-white rounded-xl h-11">
                Submit Another Proposal
              </Button>
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
