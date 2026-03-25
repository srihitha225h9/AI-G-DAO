"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRightIcon, CoinsIcon } from "lucide-react"
import { useWalletContext } from "@/hooks/use-wallet"
import algosdk from "algosdk"
import { PeraWalletConnect } from "@perawallet/connect"

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")

interface MilestoneFundingProps {
  proposalId: number
  proposalCreator: string
  totalFunding: number
  initialMilestones?: any[]
}

export function MilestoneFunding({ proposalId, proposalCreator, totalFunding, initialMilestones }: MilestoneFundingProps) {
  const { address } = useWalletContext()
  const [milestones, setMilestones] = useState<any[]>(initialMilestones || [])
  const [eligibleVoters, setEligibleVoters] = useState<string[]>([])
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null)
  const [releasedMilestones, setReleasedMilestones] = useState<number[]>([])
  const [votingIdx, setVotingIdx] = useState<number | null>(null)
  const [releasingIdx, setReleasingIdx] = useState<number | null>(null)
  const [releaseModal, setReleaseModal] = useState<{ idx: number; amount: number; txId: string; allDone: boolean } | null>(null)
  const [myVotes, setMyVotes] = useState<Record<number, "for" | "against">>({})
  const [proofInputs, setProofInputs] = useState<Record<number, string>>({})
  const [submittingProof, setSubmittingProof] = useState<number | null>(null)
  const [pera] = useState(() => typeof window !== "undefined" ? new PeraWalletConnect() : null)

  const isProposer = address === proposalCreator
  // All members except proposer must vote
  // Minimum 2 community members must vote — ensures at least 2 approvals needed
  const requiredVotes = eligibleVoters.length > 0 ? eligibleVoters.length : 1

  useEffect(() => {
    if (initialMilestones?.length) setMilestones(initialMilestones)
  }, [initialMilestones])

  const fetchMyVotes = useCallback(async () => {
    if (!address || !proposalId) return
    try {
      const res = await fetch(`/api/milestone-votes?proposalId=${proposalId}&voterAddress=${encodeURIComponent(address)}`)
      if (res.ok) {
        const data = await res.json()
        const map: Record<number, "for" | "against"> = {}
        for (const row of data.votes || []) map[row.milestone_idx] = row.vote
        setMyVotes(map)
      }
    } catch {}
  }, [address, proposalId])

  const fetchBackground = useCallback(async () => {
    try {
      const [mRes, tRes, pRes] = await Promise.all([
        fetch("/api/members"),
        fetch(`/api/treasury?proposalId=${proposalId}`),
        fetch(`/api/proposals/${proposalId}`),
      ])
      if (mRes.ok) {
        const md = await mRes.json()
        const all: string[] = (md.members || []).map((m: any) => m.address)
        setEligibleVoters(all.filter(a => a !== proposalCreator))
      }
      if (tRes.ok) { const td = await tRes.json(); setTreasuryBalance(td.balanceAlgo); setReleasedMilestones(td.released || []) }
      if (pRes.ok) { const p = await pRes.json(); if (p.milestones?.length) setMilestones(p.milestones) }
    } catch {}
  }, [proposalId, proposalCreator])

  useEffect(() => {
    fetchMyVotes(); fetchBackground()
    const interval = setInterval(() => { fetchBackground(); fetchMyVotes() }, 10000)
    return () => clearInterval(interval)
  }, [fetchBackground, fetchMyVotes])

  useEffect(() => { setMyVotes({}); fetchMyVotes() }, [address, fetchMyVotes])

  const handleSubmitProof = async (milestoneIdx: number) => {
    const proof = proofInputs[milestoneIdx]?.trim()
    if (!proof) return alert("Please describe your proof of completion.")
    setSubmittingProof(milestoneIdx)
    try {
      const pRes = await fetch(`/api/proposals/${proposalId}`)
      const fresh = await pRes.json()
      const updated = (fresh.milestones || []).map((m: any, i: number) =>
        i !== milestoneIdx ? m : { ...m, status: "pending_proof", proof, voteYes: 0, voteNo: 0 }
      )
      await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposalId, milestones: updated }),
      })
      setMilestones(updated)
      setProofInputs(prev => ({ ...prev, [milestoneIdx]: "" }))
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setSubmittingProof(null)
    }
  }

  const handleVote = async (milestoneIdx: number, vote: "for" | "against") => {
    if (!address || isProposer) return
    setVotingIdx(milestoneIdx)
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`/api/proposals/${proposalId}`),
        fetch("/api/members"),
      ])
      const fresh = await pRes.json()
      const freshMilestones = fresh.milestones || []

      // Get fresh eligible voters
      let freshEligible: string[] = eligibleVoters
      if (mRes.ok) {
        const md = await mRes.json()
        freshEligible = (md.members || []).map((m: any) => m.address).filter((a: string) => a !== proposalCreator)
      }
      const needed = freshEligible.length > 0 ? freshEligible.length : 1

      const updated = freshMilestones.map((m: any, i: number) => {
        if (i !== milestoneIdx) return m
        const newYes = vote === "for" ? (m.voteYes || 0) + 1 : (m.voteYes || 0)
        const newNo = vote === "against" ? (m.voteNo || 0) + 1 : (m.voteNo || 0)
        const total = newYes + newNo
        // ALL eligible members must have voted
        const allVoted = total >= needed
        // ALL must approve (no rejections) for completed
        const newStatus = allVoted && newNo === 0 ? "completed"
          : allVoted && newNo > 0 ? "failed"
          : m.status
        return { ...m, voteYes: newYes, voteNo: newNo, status: newStatus }
      })

      await fetch("/api/milestone-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, milestoneIdx, voterAddress: address, vote }),
      })
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposalId, milestones: updated }),
      })
      if (res.ok) { setMilestones(updated); setMyVotes(prev => ({ ...prev, [milestoneIdx]: vote })) }
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`)
    } finally {
      setVotingIdx(null)
    }
  }

  const handleRelease = async (milestoneIdx: number, amountAlgo: number) => {
    if (!pera) return
    setReleasingIdx(milestoneIdx)
    try {
      let accounts: string[] = []
      try { accounts = await pera.reconnectSession() } catch {}
      if (!accounts.includes(TREASURY)) accounts = await pera.connect()
      if (!accounts.includes(TREASURY)) {
        alert(`Please import the treasury wallet into Pera.\n\nTreasury: ${TREASURY}`)
        return
      }
      const params = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: TREASURY,
        receiver: proposalCreator,
        amount: Math.round(amountAlgo * 1_000_000),
        suggestedParams: params,
        note: new Uint8Array(Buffer.from(`EcoNexus milestone ${milestoneIdx + 1} release`)),
      })
      const signedTxns = await pera.signTransaction([[{ txn, signers: [TREASURY] }]])
      const sendRes = await algodClient.sendRawTransaction(signedTxns[0]).do()
      const txId = sendRes.txid || sendRes.txId || String(sendRes)
      await algosdk.waitForConfirmation(algodClient, txId, 10)
      await fetch("/api/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, milestoneIdx, amountAlgo, txId }),
      })
      const pRes = await fetch(`/api/proposals/${proposalId}`)
      const freshP = await pRes.json()
      const finalMilestones = (freshP.milestones || []).map((m: any, i: number) => {
        if (i === milestoneIdx) return { ...m, status: "released" }
        if (i === milestoneIdx + 1 && m.status === "locked") return { ...m, status: "active" }
        return m
      })
      await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposalId, milestones: finalMilestones }),
      })
      setMilestones(finalMilestones)
      const nextReleased = [...releasedMilestones, milestoneIdx]
      setReleasedMilestones(nextReleased)
      setTreasuryBalance(prev => prev !== null ? prev - amountAlgo : null)
      setReleaseModal({
        idx: milestoneIdx, amount: amountAlgo,
        txId: typeof txId === "string" ? txId : String(txId),
        allDone: nextReleased.length >= milestones.length,
      })
    } catch (err: any) {
      alert(`Release failed: ${err.message}`)
    } finally {
      setReleasingIdx(null)
    }
  }

  if (!milestones.length) return null

  const releasedCount = milestones.filter(m => m.status === "released").length

  return (
    <>
      <Card className="bg-white/5 border-white/10 rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <CoinsIcon className="w-4 h-4 text-purple-400" />
              Funding Milestones
            </CardTitle>
            <span className="text-white/40 text-xs">{releasedCount}/{milestones.length} released</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
              style={{ width: `${milestones.length > 0 ? (releasedCount / milestones.length) * 100 : 0}%` }} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-5">
          {milestones.map((m: any, i: number) => {
            const pct = m.fundingPercent ?? m.percent ?? 0
            const amountAlgo = parseFloat((totalFunding * pct / 100).toFixed(4))
            const isReleased = m.status === "released" || releasedMilestones.includes(i)
            const isCompleted = m.status === "completed"
            const isFailed = m.status === "failed"
            const isLocked = m.status === "locked"
            const isActive = m.status === "active" || m.status === "pending"
            const isPendingProof = m.status === "pending_proof"
            const voteYes = m.voteYes || 0
            const voteNo = m.voteNo || 0
            const totalVotes = voteYes + voteNo
            const myVote = myVotes[i]
            const canVote = isPendingProof && !isProposer && !myVote && !!address
            // Release only visible when ALL eligible members approved (voteYes === requiredVotes)
            const allApproved = isCompleted && voteYes >= requiredVotes && voteNo === 0

            const statusLabel = isReleased ? "💸 Released"
              : isCompleted ? "✅ All Approved"
              : isFailed ? "✗ Rejected"
              : isLocked ? "🔒 Locked"
              : isPendingProof ? "📋 Proof Submitted"
              : "⏳ Active"

            const statusColor = isReleased ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
              : isCompleted ? "bg-green-500/20 text-green-400 border-green-500/30"
              : isFailed ? "bg-red-500/20 text-red-400 border-red-500/30"
              : isLocked ? "bg-white/5 text-white/30 border-white/10"
              : isPendingProof ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              : "bg-blue-500/20 text-blue-400 border-blue-500/30"

            const cardBg = isReleased ? "bg-purple-500/5 border-purple-500/20"
              : isCompleted ? "bg-green-500/5 border-green-500/20"
              : isFailed ? "bg-red-500/5 border-red-500/20"
              : isLocked ? "bg-white/5 border-white/5 opacity-50"
              : isPendingProof ? "bg-yellow-500/5 border-yellow-500/20"
              : "bg-white/5 border-white/10"

            return (
              <div key={i}>
                <div className={`rounded-2xl border p-4 space-y-2 transition-all ${cardBg}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? "bg-blue-500/30 text-blue-300" :
                        i === 1 ? "bg-purple-500/30 text-purple-300" :
                        "bg-green-500/30 text-green-300"
                      }`}>{i + 1}</span>
                      <span className="text-white font-medium text-sm">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/40 text-xs">{amountAlgo} ALGO ({pct}%)</span>
                      <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                    </div>
                  </div>

                  {m.description && <p className="text-white/50 text-xs pl-8">{m.description}</p>}

                  {/* STEP 1: Active — proposer submits proof after completing work */}
                  {isActive && isProposer && (
                    <div className="pl-8 space-y-2 pt-1">
                      <p className="text-blue-300 text-xs font-medium">📝 Complete this milestone then submit proof:</p>
                      <textarea
                        placeholder="Describe what you completed (links, photos, invoices, reports...)"
                        value={proofInputs[i] || ""}
                        onChange={e => setProofInputs(prev => ({ ...prev, [i]: e.target.value }))}
                        rows={2}
                        className="w-full bg-white/5 border border-white/15 text-white placeholder-white/30 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-white/30"
                      />
                      <Button size="sm" onClick={() => handleSubmitProof(i)} disabled={submittingProof === i}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-8 text-xs px-4">
                        {submittingProof === i ? "Submitting..." : "📤 Submit Proof"}
                      </Button>
                    </div>
                  )}
                  {isActive && !isProposer && (
                    <p className="text-white/30 text-xs pl-8">⏳ Waiting for proposer to complete work and submit proof...</p>
                  )}

                  {/* STEP 2: Proof submitted — ALL community members must vote */}
                  {isPendingProof && (
                    <div className="pl-8 space-y-2 pt-1">
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                        <p className="text-yellow-400 text-xs font-medium mb-1">📋 Proof submitted:</p>
                        <p className="text-white/70 text-xs">{m.proof}</p>
                      </div>
                      <div className="flex justify-between text-xs text-white/40">
                        <span>✓ {voteYes} yes · ✗ {voteNo} no</span>
                        <span>{totalVotes}/{requiredVotes} members voted</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full transition-all"
                          style={{ width: `${requiredVotes > 0 ? Math.min((totalVotes / requiredVotes) * 100, 100) : 0}%` }} />
                      </div>
                      {canVote && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleVote(i, "for")} disabled={votingIdx === i}
                            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl h-8 text-xs">
                            {votingIdx === i ? "..." : "✓ Approve"}
                          </Button>
                          <Button size="sm" onClick={() => handleVote(i, "against")} disabled={votingIdx === i}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl h-8 text-xs">
                            {votingIdx === i ? "..." : "✗ Reject"}
                          </Button>
                        </div>
                      )}
                      {myVote && (
                        <p className={`text-xs ${myVote === "for" ? "text-green-400/70" : "text-red-400/70"}`}>
                          ✓ You voted {myVote === "for" ? "Approve" : "Reject"} — waiting for all members ({totalVotes}/{requiredVotes})
                        </p>
                      )}
                      {isProposer && (
                        <p className="text-yellow-400/70 text-xs">⏳ Waiting for all community members to vote ({totalVotes}/{requiredVotes})</p>
                      )}
                    </div>
                  )}

                  {/* STEP 3: ALL approved — release button visible to proposer */}
                  {allApproved && !isReleased && (
                    <div className="pl-8 pt-1 space-y-1">
                      {isProposer ? (
                        <>
                          <p className="text-green-400 text-xs">✅ All {requiredVotes} members approved! Release funds:</p>
                          <Button size="sm" onClick={() => handleRelease(i, amountAlgo)} disabled={releasingIdx === i}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-8 text-xs px-4">
                            {releasingIdx === i ? "⏳ Confirm in Pera..." : `💸 Release ${amountAlgo} ALGO`}
                          </Button>
                          <p className="text-white/30 text-xs">Treasury wallet will be prompted in Pera</p>
                        </>
                      ) : (
                        <p className="text-yellow-400/70 text-xs">⏳ Awaiting proposer to release {amountAlgo} ALGO</p>
                      )}
                    </div>
                  )}

                  {/* Rejected — proposer resubmits */}
                  {isFailed && isProposer && (
                    <div className="pl-8 space-y-2 pt-1">
                      <p className="text-red-400/70 text-xs">✗ Proof rejected. Submit updated proof:</p>
                      <textarea
                        placeholder="Update your proof with more details..."
                        value={proofInputs[i] || ""}
                        onChange={e => setProofInputs(prev => ({ ...prev, [i]: e.target.value }))}
                        rows={2}
                        className="w-full bg-white/5 border border-red-500/20 text-white placeholder-white/30 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none"
                      />
                      <Button size="sm" onClick={() => handleSubmitProof(i)} disabled={submittingProof === i}
                        className="bg-red-600/50 hover:bg-red-600 text-white rounded-xl h-8 text-xs px-4">
                        {submittingProof === i ? "Submitting..." : "📤 Resubmit Proof"}
                      </Button>
                    </div>
                  )}
                  {isFailed && !isProposer && (
                    <p className="text-red-400/70 text-xs pl-8">✗ Proof rejected — waiting for proposer to resubmit</p>
                  )}

                  {isLocked && (
                    <p className="text-xs text-white/30 pl-8">🔒 Unlocks after Milestone {i} funds are released</p>
                  )}
                  {isReleased && (
                    <p className="text-xs text-purple-400/70 pl-8">💸 {amountAlgo} ALGO released to proposer</p>
                  )}
                </div>

                {i < milestones.length - 1 && (
                  <div className="flex justify-center my-1">
                    <ChevronRightIcon className="w-4 h-4 text-white/20 rotate-90" />
                  </div>
                )}
              </div>
            )
          })}

          {treasuryBalance !== null && (
            <div className="flex justify-between text-xs text-white/40 px-1 pt-1 border-t border-white/5">
              <span>Treasury balance</span>
              <span className="text-purple-300 font-medium">{treasuryBalance.toFixed(2)} ALGO</span>
            </div>
          )}
        </CardContent>
      </Card>

      {releaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReleaseModal(null)} />
          <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <span className="text-3xl">{releaseModal.allDone ? "🎉" : "💸"}</span>
            </div>
            {releaseModal.allDone ? (
              <>
                <h2 className="text-white font-bold text-xl">All Funds Released!</h2>
                <p className="text-white/60 text-sm">All {milestones.length} milestones completed.</p>
              </>
            ) : (
              <>
                <h2 className="text-white font-bold text-xl">Milestone {releaseModal.idx + 1} Funded!</h2>
                <p className="text-white/60 text-sm">
                  <span className="text-purple-300 font-semibold">{releaseModal.amount} ALGO</span> released on-chain.
                </p>
                <p className="text-white/30 text-xs">{milestones.length - releasedMilestones.length} milestone(s) remaining</p>
              </>
            )}
            <p className="text-white/20 text-xs font-mono truncate">TX: {releaseModal.txId.slice(0, 24)}...</p>
            <Button onClick={() => setReleaseModal(null)} className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
              {releaseModal.allDone ? "🎉 Done" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
