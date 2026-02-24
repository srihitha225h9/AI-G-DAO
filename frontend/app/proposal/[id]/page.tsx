"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useClimateDAO } from "@/hooks/use-climate-dao"
import { useAIReview } from "@/hooks/use-ai-review"
import { AIReviewDisplay } from "@/components/ai-review-display"
import Link from "next/link"
import { WalletGuard } from "@/components/wallet-guard"
import { ArrowLeftIcon, SparklesIcon } from "lucide-react"
import { useWalletContext } from "@/hooks/use-wallet"

export default function ProposalDetailPage() {
  const params = useParams()
  const idParam = params?.id
  const proposalId = idParam ? Number(idParam) : null
  const { getProposal } = useClimateDAO()
  const [proposal, setProposal] = useState<any | null>(null)
  const { isAnalyzing, reviewResult, analyzeProposalData } = useAIReview()
  const [aiReview, setAiReview] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // When hook's reviewResult updates, reflect it in local component state
  useEffect(() => {
    if (reviewResult) setAiReview(reviewResult)
  }, [reviewResult])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (!proposalId) return
        const p = await getProposal(proposalId)
        setProposal(p)

        // Load persisted AI review from localStorage if present
        try {
          const stored = localStorage.getItem(`proposal_ai_${proposalId}`)
          if (stored) setAiReview(JSON.parse(stored))
        } catch (err) {
          console.warn('Failed to load AI review for proposal:', err)
        }
      } catch (err) {
        console.error('Failed to load proposal:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [proposalId, getProposal])

  if (!proposalId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <p>Invalid proposal id</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <WalletGuard requireBalance={0}>
      <div className="relative flex flex-col min-h-[100dvh] text-white overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-white/80">
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
          </div>

          <div className="text-white font-bold text-lg">Proposal Details</div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-yellow-400" />
              <div className="text-sm text-white/90">AI Analysis</div>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Proposal #{proposalId}</h1>
              <Link href="/dashboard">
                <Button variant="ghost">Back</Button>
              </Link>
            </div>

            {loading ? (
              <Card>
                <CardContent>
                  <p className="text-white/60">Loading proposal...</p>
                </CardContent>
              </Card>
            ) : !proposal ? (
              <Card>
                <CardContent>
                  <p className="text-white/60">Proposal not found</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Project Card */}
                <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white">{proposal.title}</CardTitle>
                    <CardDescription className="text-white/60">{proposal.category} • Funding: ${proposal.fundingAmount.toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/80 mb-4 whitespace-pre-wrap">{proposal.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-white/60 text-sm">Submitted by: {proposal.creator}</div>
                      {proposal.txId && (
                        <div className="text-xs text-white/60">TX: <a className="underline" target="_blank" rel="noreferrer" href={`https://testnet.algoscan.app/tx/${proposal.txId}`}>{proposal.txId}</a></div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Banner */}
                {aiReview && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <SparklesIcon className="w-5 h-5 text-yellow-400" />
                        <div>
                          <div className="text-sm font-medium text-yellow-300">Analysis from submission</div>
                          <div className="text-xs text-white/60">Detailed AI insights for this proposal</div>
                        </div>
                      </div>
                      {proposal.txId && <div className="text-xs text-white/60">TX: {proposal.txId}</div>}
                    </div>
                  </div>
                )}

                {/* AI Analysis Section */}
                <div className="mt-6 space-y-4">
                  {aiReview ? (
                    <AIReviewDisplay review={aiReview} />
                  ) : (
                    <>
                      <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                        <CardContent>
                          <p className="text-white/60">No AI analysis is available for this proposal yet.</p>
                        </CardContent>
                      </Card>
                      <div className="text-right">
                        <Button
                          onClick={async () => {
                            if (!proposal) return
                            try {
                              await analyzeProposalData({
                                title: proposal.title,
                                description: proposal.description,
                                category: proposal.category || 'general',
                                fundingAmount: String(proposal.fundingAmount || 0),
                                expectedImpact: proposal.expectedImpact || 'To be determined',
                                location: proposal.location || 'Global'
                              }, proposalId || undefined)
                            } catch (err) {
                              console.error('Failed to analyze proposal:', err)
                              alert('AI analysis failed')
                            }
                          }}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        >
                          {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </WalletGuard>
  )
}