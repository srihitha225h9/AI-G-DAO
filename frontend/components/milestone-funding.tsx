"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRightIcon, CoinsIcon } from "lucide-react"
import { useWalletContext } from "@/hooks/use-wallet"

interface MilestoneFundingProps {
  proposalId: number
  proposalCreator: string
  totalFunding: number
}

export function MilestoneFunding({ proposalId, proposalCreator, totalFunding }: MilestoneFundingProps) {
  const { address } = useWalletContext()
  const [milestones, setMilestones] = useState<any[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null)
  const [releasedMilestones, setReleasedMilestones] = useState<number[]>([])
  const [votingIdx, setVotingIdx] = useState<number | null>(null)
  const [releasingIdx, setReleasingIdx] = useState<number | null>(null)
  const [releaseModal, setReleaseModal] = useState<{ idx: number; amount: number; allDone: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState<Record<number, "for" | "against">>({})

  const isProposer = address === proposalCreator
  const voteThreshold = memberCount > 1 ? memberCount - 1 : 1

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

  const fetchData = useCallback(async () => {
    try {
      const [pRes, mRes, tRes] = await Promise.all([
        fetch(`/api/proposals/${proposalId}`),
        fetch("/api/members"),
        fetch(`/api/treasury?proposalId=${proposalId}`),
      ])
      if (pRes.ok) {
        const p = await pRes.json()
        const ms = p.milestones || []
        let needsPatch = false
        const fixed = ms.map((m: any, idx: number) => {
          if ((m.status === "active" || m.status === "pending") && (m.voteYes || 0) > 0 && (m.voteNo || 0) === 0) {
            const prevReleased = idx === 0 || ms[idx - 1]?.status === "released"
            if (prevReleased) { needsPatch = true; return { ...m, status: "completed" } }
          }
          if (m.status === "completed" && idx > 0 && ms[idx - 1]?.status !== "released") {
            needsPatch = true
            return { ...m, status: "locked", voteYes: 0, voteNo: 0 }
          }
          return m
        })
        if (needsPatch) {
          await fetch("/api/proposals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: proposalId, milestones: fixed }),
          })
          setMilestones(fixed)
        } else {
          setMilestones(ms)
        }
      }
      if (mRes.ok) {
        const md = await mRes.json()
        setMemberCount(md.count || (md.members || []).length || 0)
      }
      if (tRes.ok) {
        const td = await tRes.json()
        setTreasuryBalance(td.balanceAlgo)
        setReleasedMilestones(td.released || [])
      }
    } catch {}
    finally { setLoading(false) }
  }, [proposalId])

  useEffect(() => {
    fetchData()
    fetchMyVotes()
    const interval = setInterval(() => { fetchData(); fetchMyVotes() }, 8000)
    return () => clearInterval(interval)
  }, [fetchData, fetchMyVotes])

  useEffect(() => {
    setMyVotes({})
    fetchMyVotes()
  }, [address, fetchMyVotes])

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
      let threshold = voteThreshold
      if (mRes.ok) {
        const md = await mRes.json()
        const eligible = (md.members || []).map((m: any) => m.address).filter((a: string) => a !== proposalCreator)
        threshold = eligible.length > 0 ? eligible.length : 1
      }
      const updated = freshMilestones.map((m: any, i: number) => {
        if (i !== milestoneIdx) return m
        const newYes = vote === "for" ? (m.voteYes || 0) + 1 : (m.voteYes || 0)
        const newNo = vote === "against" ? (m.voteNo || 0) + 1 : (m.voteNo || 0)
        const total = newYes + newNo
        const allVoted = total >= threshold
        const newStatus = allVoted && newNo === 0 ? "completed" : allVoted && newNo > 0 ? "failed" : m.status
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
      if (res.ok) {
        setMilestones(updated)
        setMyVotes(prev => ({ ...prev, [milestoneIdx]: vote }))
      } else {
        alert("Vote failed. Please try again.")
      }
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`)
    } finally {
      setVotingIdx(null)
    }
  }

  // Release: record in DB — treasury balance = live Algorand balance minus all DB releases (handled in /api/treasury)
  const handleRelease = async (milestoneIdx: number, amountAlgo: number) => {
    setReleasingIdx(milestoneIdx)
    try {
      const txId = `release_${proposalId}_m${milestoneIdx}_${Date.now()}`
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
      setReleaseModal({ idx: milestoneIdx, amount: amountAlgo, allDone: nextReleased.length >= milestones.length })
    } catch (err: any) {
      alert(`Release failed: ${err.message}`)
    } finally {
      setReleasingIdx(null)
    }
  }

  if (loading) return (
    <Card className="bg-white/5 border-white/10 rounded-2xl">
      <CardContent className="p-6 text-center">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
      </CardContent>
    </Card>
  )

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
            const voteYes = m.voteYes || 0
            const voteNo = m.voteNo || 0
            const totalVotes = voteYes + voteNo
            const myVote = myVotes[i]
            const canVote = isActive && !isProposer && !myVote && !!address

            return (
              <div key={i}>
                <div className={`rounded-2xl border p-4 space-y-2 transition-all ${
                  isReleased  ? "bg-purple-500/5 border-purple-500/20" :
                  isCompleted ? "bg-green-500/5 border-green-500/20" :
                  isFailed    ? "bg-red-500/5 border-red-500/20" :
                  isLocked    ? "bg-white/5 border-white/5 opacity-50" :
                  "bg-white/5 border-white/10"
                }`}>
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
                      <Badge className={`text-xs ${
                        isReleased  ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                        isCompleted ? "bg-green-500/20 text-green-400 border-green-500/30" :
                        isFailed    ? "bg-red-500/20 text-red-400 border-red-500/30" :
                        isLocked    ? "bg-white/5 text-white/30 border-white/10" :
                        "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }`}>
                        {isReleased ? "💸 Released" : isCompleted ? "✅ Approved" : isFailed ? "✗ Rejected" : isLocked ? "🔒 Locked" : "⏳ Active"}
                      </Badge>
                    </div>
                  </div>

                  {m.description && <p className="text-white/50 text-xs pl-8">{m.description}</p>}

                  {isActive && (
                    <div className="pl-8 space-y-1">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>✓ {voteYes} yes · ✗ {voteNo} no</span>
                        <span>{totalVotes}/{voteThreshold} votes needed</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${voteThreshold > 0 ? Math.min((totalVotes / voteThreshold) * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {canVote && (
                    <div className="flex gap-2 pl-8 pt-1">
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

                  {myVote && isActive && (
                    <p className={`text-xs pl-8 ${myVote === "for" ? "text-green-400/70" : "text-red-400/70"}`}>
                      ✓ You voted {myVote === "for" ? "Approve" : "Reject"} — waiting for others ({totalVotes}/{voteThreshold})
                    </p>
                  )}

                  {isActive && isProposer && (
                    <p className="text-xs text-white/30 pl-8">⏳ Waiting for community votes ({totalVotes}/{voteThreshold})</p>
                  )}

                  {isLocked && (
                    <p className="text-xs text-white/30 pl-8">🔒 Unlocks after Milestone {i} funds are released</p>
                  )}

                  {isCompleted && !isReleased && (
                    <div className="pl-8 pt-1">
                      {isProposer ? (
                        <Button size="sm" onClick={() => handleRelease(i, amountAlgo)} disabled={releasingIdx === i}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-8 text-xs px-4">
                          {releasingIdx === i ? "⏳ Releasing..." : `💸 Release ${amountAlgo} ALGO`}
                        </Button>
                      ) : (
                        <p className="text-yellow-400/70 text-xs">⏳ Awaiting proposer to release {amountAlgo} ALGO</p>
                      )}
                    </div>
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
                <p className="text-white/60 text-sm">All {milestones.length} milestones completed. Full funding sent to proposer.</p>
              </>
            ) : (
              <>
                <h2 className="text-white font-bold text-xl">Milestone {releaseModal.idx + 1} Funded!</h2>
                <p className="text-white/60 text-sm">
                  <span className="text-purple-300 font-semibold">{releaseModal.amount} ALGO</span> released to proposer.
                </p>
                <p className="text-white/30 text-xs">{milestones.length - releasedMilestones.length} milestone(s) remaining</p>
              </>
            )}
            <Button onClick={() => setReleaseModal(null)} className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
              {releaseModal.allDone ? "🎉 Done" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
