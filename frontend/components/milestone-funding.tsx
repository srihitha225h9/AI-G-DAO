"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircleIcon,
  LockIcon,
  ClockIcon,
  XCircleIcon,
  ChevronRightIcon,
  CoinsIcon,
  FileTextIcon,
  AlertCircleIcon,
} from "lucide-react"
import { useWalletContext } from "@/hooks/use-wallet"

export interface Milestone {
  id: number
  title: string
  description: string
  fundingPercent: number
  status: "locked" | "active" | "pending_release" | "completed" | "failed"
  completedAt?: number
  txId?: string
  evidence?: string
}

interface MilestoneFundingProps {
  proposalId: number
  proposalCreator: string
  totalFunding: number
}

const STATUS_CONFIG = {
  locked: {
    icon: LockIcon,
    color: "text-white/40",
    bg: "bg-white/5",
    border: "border-white/10",
    badge: "bg-white/10 text-white/40",
    label: "Locked",
  },
  active: {
    icon: AlertCircleIcon,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400",
    label: "Active — Submit Evidence",
  },
  pending_release: {
    icon: ClockIcon,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/20 text-yellow-400",
    label: "Pending DAO Approval",
  },
  completed: {
    icon: CheckCircleIcon,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    badge: "bg-green-500/20 text-green-400",
    label: "Completed & Funded",
  },
  failed: {
    icon: XCircleIcon,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400",
    label: "Rejected — Resubmit",
  },
}

export function MilestoneFunding({ proposalId, proposalCreator, totalFunding }: MilestoneFundingProps) {
  const { address } = useWalletContext()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [evidenceInputs, setEvidenceInputs] = useState<Record<number, string>>({})
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null)

  const isCreator = address === proposalCreator

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await fetch(`/api/milestones?proposalId=${proposalId}`)
      const data = await res.json()
      setMilestones(data.milestones || [])
    } catch {
      setMilestones([])
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  const notify = (msg: string, type: "success" | "error") => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Creator submits evidence for the active milestone
  const handleSubmitEvidence = async (milestoneId: number) => {
    const evidence = evidenceInputs[milestoneId]?.trim()
    if (!evidence) return notify("Please describe the evidence of completion.", "error")

    setActionLoading(milestoneId)
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, milestoneId, evidence, callerAddress: address }),
      })
      const data = await res.json()
      if (!res.ok) return notify(data.error || "Failed to submit evidence", "error")
      setMilestones(data.milestones)
      setEvidenceInputs(prev => ({ ...prev, [milestoneId]: "" }))
      notify("Evidence submitted! Waiting for DAO approval.", "success")
    } catch {
      notify("Network error. Please try again.", "error")
    } finally {
      setActionLoading(null)
    }
  }

  // DAO member approves or rejects a pending milestone
  const handleAction = async (milestoneId: number, action: "approve" | "reject") => {
    setActionLoading(milestoneId)
    try {
      const res = await fetch("/api/milestones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, milestoneId, action, callerAddress: address }),
      })
      const data = await res.json()
      if (!res.ok) return notify(data.error || "Action failed", "error")
      setMilestones(data.milestones)
      if (action === "approve") {
        notify(`Milestone approved! Funds released. TxID: ${data.txId?.slice(0, 20)}...`, "success")
      } else {
        notify("Milestone rejected. Creator can resubmit evidence.", "error")
      }
    } catch {
      notify("Network error. Please try again.", "error")
    } finally {
      setActionLoading(null)
    }
  }

  const completedFunding = milestones
    .filter(m => m.status === "completed")
    .reduce((sum, m) => sum + (totalFunding * m.fundingPercent) / 100, 0)

  const totalPercent = milestones.reduce((sum, m) => sum + m.fundingPercent, 0)

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (milestones.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
        <CardContent className="p-6 text-center text-white/40">
          <CoinsIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No milestones defined for this proposal.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center">
              <CoinsIcon className="w-5 h-5 text-white" />
            </div>
            Milestone Funding
          </CardTitle>
          <div className="text-right">
            <p className="text-white font-bold">${completedFunding.toLocaleString()} released</p>
            <p className="text-white/50 text-xs">of ${totalFunding.toLocaleString()} total</p>
          </div>
        </div>

        {/* Progress bar across all milestones */}
        <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700 rounded-full"
            style={{
              width: `${milestones.filter(m => m.status === "completed").length / milestones.length * 100}%`,
            }}
          />
        </div>
        <p className="text-white/40 text-xs mt-1">
          {milestones.filter(m => m.status === "completed").length} of {milestones.length} milestones completed
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pb-6">
        {/* Notification */}
        {notification && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
            notification.type === "success"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}>
            {notification.msg}
          </div>
        )}

        {milestones.map((milestone, idx) => {
          const cfg = STATUS_CONFIG[milestone.status]
          const Icon = cfg.icon
          const fundingForThis = (totalFunding * milestone.fundingPercent) / 100
          const isLast = idx === milestones.length - 1

          return (
            <div key={milestone.id}>
              <div className={`rounded-2xl border p-4 transition-all duration-300 ${cfg.bg} ${cfg.border}`}>
                {/* Milestone header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">
                          Milestone {idx + 1}: {milestone.title}
                        </span>
                        <Badge className={`text-xs px-2 py-0.5 ${cfg.badge}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-white/50 text-xs mt-1">{milestone.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-semibold text-sm">${fundingForThis.toLocaleString()}</p>
                    <p className="text-white/40 text-xs">{milestone.fundingPercent}%</p>
                  </div>
                </div>

                {/* Completed: show txId */}
                {milestone.status === "completed" && milestone.txId && (
                  <div className="mt-3 px-3 py-2 bg-green-500/10 rounded-xl border border-green-500/20">
                    <p className="text-green-400 text-xs font-medium">Funds Released</p>
                    <p className="text-white/50 text-xs font-mono mt-0.5 truncate">TxID: {milestone.txId}</p>
                    {milestone.completedAt && (
                      <p className="text-white/30 text-xs mt-0.5">
                        {new Date(milestone.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Pending: show evidence + approve/reject for DAO members */}
                {milestone.status === "pending_release" && (
                  <div className="mt-3 space-y-3">
                    {milestone.evidence && (
                      <div className="px-3 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <p className="text-yellow-400 text-xs font-medium flex items-center gap-1">
                          <FileTextIcon className="w-3 h-3" /> Evidence Submitted
                        </p>
                        <p className="text-white/70 text-xs mt-1">{milestone.evidence}</p>
                      </div>
                    )}
                    {/* Any connected wallet (DAO member) can approve/reject */}
                    {address && !isCreator && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl text-xs h-9"
                          onClick={() => handleAction(milestone.id, "approve")}
                          disabled={actionLoading === milestone.id}
                        >
                          {actionLoading === milestone.id ? "Processing..." : "✓ Approve & Release Funds"}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs h-9"
                          onClick={() => handleAction(milestone.id, "reject")}
                          disabled={actionLoading === milestone.id}
                        >
                          ✗ Reject
                        </Button>
                      </div>
                    )}
                    {isCreator && (
                      <p className="text-yellow-400/70 text-xs text-center">
                        Waiting for DAO members to review your evidence...
                      </p>
                    )}
                  </div>
                )}

                {/* Active: creator submits evidence */}
                {milestone.status === "active" && isCreator && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Describe how you completed this milestone (links, metrics, proof)..."
                      value={evidenceInputs[milestone.id] || ""}
                      onChange={e => setEvidenceInputs(prev => ({ ...prev, [milestone.id]: e.target.value }))}
                      rows={2}
                      className="bg-white/5 border-white/20 text-white placeholder-white/30 text-xs rounded-xl resize-none"
                    />
                    <Button
                      size="sm"
                      className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs h-9"
                      onClick={() => handleSubmitEvidence(milestone.id)}
                      disabled={actionLoading === milestone.id}
                    >
                      {actionLoading === milestone.id ? "Submitting..." : "Submit Evidence for Review"}
                    </Button>
                  </div>
                )}

                {milestone.status === "active" && !isCreator && (
                  <p className="text-blue-400/70 text-xs mt-2">
                    Waiting for project creator to submit completion evidence...
                  </p>
                )}
              </div>

              {/* Arrow connector between milestones */}
              {!isLast && (
                <div className="flex justify-center my-1">
                  <ChevronRightIcon className="w-4 h-4 text-white/20 rotate-90" />
                </div>
              )}
            </div>
          )
        })}

        {/* Summary */}
        <div className="mt-2 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex justify-between text-xs text-white/50">
            <span>Total milestones: {milestones.length}</span>
            <span>Funding %: {totalPercent}%</span>
            <span>Released: ${completedFunding.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
