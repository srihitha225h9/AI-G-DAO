"use client"

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'
import { memberTracker } from '@/lib/member-tracker'

const peraWallet = new PeraWalletConnect()

// Algorand TestNet configuration
const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '')

interface WalletState {
  isConnected: boolean
  address: string | null
  balance: number
  loading: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  clearError: () => void
  signTransaction: (txn: algosdk.Transaction) => Promise<Uint8Array>
}

// Create context for wallet state
const WalletContext = createContext<WalletState | null>(null)

// Provider component
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  )
}

// Hook to use wallet context
export function useWalletContext(): WalletState {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

function useWallet(): WalletState {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const accountInfo = await algodClient.accountInformation(addr).do()
      setBalance(Number(accountInfo.amount) / 1000000) // Convert microAlgos to Algos
    } catch (err) {
      console.error('Failed to fetch balance:', err)
      setBalance(0)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to connect to Pera Wallet
      const accounts = await peraWallet.connect()
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please create an account in Pera Wallet.')
      }

      const account = accounts[0]
      
      // Validate that this is a valid Algorand address
      if (!account || account.length !== 58) {
        throw new Error('Invalid Algorand address format. Please ensure you\'re using Pera Wallet.')
      }

      setAddress(account)
      setIsConnected(true)
      
      // Save to localStorage for persistence
      localStorage.setItem('wallet_address', account)
      
      // Fetch balance
      await fetchBalance(account)
      
      // Register member
      try {
        const isNew = await memberTracker.registerMember(account)
        if (isNew) {
          const count = await memberTracker.getMemberCount()
          console.log('🎉 New member joined! Total members:', count)
        }
      } catch (err) {
        console.error('Failed to register member:', err)
      }
      
    } catch (err: any) {
      console.error('Wallet connection failed:', err)
      
      // Check if error is due to Pera Wallet not being available
      if (err.message && (
        err.message.includes('not defined') || 
        err.message.includes('undefined') ||
        err.message.includes('not found') ||
        err.code === 4001 // User rejected
      )) {
        setError('Pera Wallet not detected. Please install Pera Wallet extension or mobile app.')
      } else {
        setError(err.message || 'Failed to connect wallet')
      }
      
      setIsConnected(false)
      setAddress(null)
    } finally {
      setLoading(false)
    }
  }, [fetchBalance])

  const disconnect = useCallback(() => {
    try {
      peraWallet.disconnect()
      setIsConnected(false)
      setAddress(null)
      setBalance(0)
      setError(null)
      
      // Clear localStorage
      localStorage.removeItem('wallet_address')
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const signTransaction = useCallback(async (txn: algosdk.Transaction): Promise<Uint8Array> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected')
    }

    try {
      const txnsToSign = [{
        txn: txn,
        signers: [address]
      }]

      const signedTxns = await peraWallet.signTransaction([txnsToSign])
      return signedTxns[0]
    } catch (err: any) {
      console.error('Transaction signing failed:', err)
      throw new Error(err.message || 'Failed to sign transaction')
    }
  }, [isConnected, address])

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to reconnect to Pera Wallet
        const accounts = await peraWallet.reconnectSession()
        if (accounts.length > 0) {
          const account = accounts[0]
          setAddress(account)
          setIsConnected(true)
          await fetchBalance(account)
          
          // Register member
          try {
            await memberTracker.registerMember(account)
          } catch (err) {
            console.error('Failed to register member:', err)
          }
        }
      } catch (err) {
        console.error('Failed to reconnect wallet:', err)
        // Clear any invalid stored data
        localStorage.removeItem('wallet_address')
      }
    }

    checkConnection()
  }, [fetchBalance])

  // Listen for account changes
  useEffect(() => {
    // Note: Pera Wallet event handling simplified for MVP
    // Real implementation would handle account changes properly
  }, [disconnect, fetchBalance])

  return {
    isConnected,
    address,
    balance,
    loading,
    error,
    connect,
    disconnect,
    clearError,
    signTransaction
  }
}
