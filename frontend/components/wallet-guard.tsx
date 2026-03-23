"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletContext } from '@/hooks/use-wallet'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { WalletIcon, AlertCircleIcon } from 'lucide-react'
import Link from 'next/link'

interface WalletGuardProps {
  children: React.ReactNode
  requireBalance?: number // Minimum ALGO balance required
  showBalanceWarning?: boolean
}

export function WalletGuard({ 
  children, 
  requireBalance = 0.1,
  showBalanceWarning = true 
}: WalletGuardProps) {
  const { isConnected, address, balance, loading } = useWalletContext()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isConnected) {
      // Save current path so we can return after connecting
      if (typeof window !== 'undefined') {
        localStorage.setItem('redirect_after_connect', window.location.pathname)
      }
      router.push('/connect-wallet')
    }
  }, [isConnected, loading, router])

  // Show loading while checking wallet status
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-white/70 mt-4">Checking wallet connection...</p>
        </div>
      </div>
    )
  }

  // Redirect if not connected
  if (!isConnected || !address) {
    return null // Will redirect via useEffect
  }

  // Show balance warning if insufficient funds
  if (showBalanceWarning && balance < requireBalance) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl p-8 text-center">
            <AlertCircleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Insufficient Balance</h2>
            <p className="text-white/70 mb-6">
              You need at least <strong>{requireBalance} ALGO</strong> to use this feature. 
              Your current balance: <strong>{balance.toFixed(4)} ALGO</strong>
            </p>
            <div className="space-y-4">
              <Link href="https://testnet.algoexplorer.io/dispenser" target="_blank">
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                  Get TestNet ALGOs
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard')}
                className="w-full border-white/30 text-white hover:bg-white/10 bg-transparent"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // All checks passed, render children
  return <>{children}</>
}

// Component for displaying wallet info in headers
export function WalletInfo({ showFullAddress = false }: { showFullAddress?: boolean }) {
  const { isConnected, address, balance } = useWalletContext()

  if (!isConnected || !address) {
    return (
      <Link href="/connect-wallet">
        <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
          <WalletIcon className="w-4 h-4 mr-2" />
          Connect Wallet
        </Button>
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm text-white/90 font-medium">
          {balance.toFixed(2)} ALGO
        </div>
        <div className="text-xs text-white/70">
          {showFullAddress 
            ? address 
            : `${address.slice(0, 6)}...${address.slice(-4)}`
          }
        </div>
      </div>
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
    </div>
  )
}