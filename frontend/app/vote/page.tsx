'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { VoteIcon, CheckCircleIcon, XCircleIcon, ClockIcon, TrendingUpIcon, LeafIcon, WalletIcon, ArrowLeftIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { useWalletContext } from '@/hooks/use-wallet';
import { useClimateDAO } from '@/hooks/use-climate-dao';
import { useNotifications } from '@/hooks/use-notifications';
import dynamic from 'next/dynamic';

// Lazy load heavy components to improve initial page load
const TransactionStatus = dynamic(() => import('@/components/transaction-status').then(mod => ({ default: mod.TransactionStatus })), {
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-32"></div>
});
const VoteConfirmationDialog = dynamic(() => import('@/components/vote-confirmation-dialog').then(mod => ({ default: mod.VoteConfirmationDialog })), {
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-48"></div>
});
import { TransactionResult } from '@/lib/transaction-builder';
import Link from 'next/link';
import { WalletGuard } from '@/components/wallet-guard';

interface Proposal {
  id: number;
  title: string;
  description: string;
  category: string;
  aiScore?: number;
  voteYes: number;
  voteNo: number;
  status: 'active' | 'passed' | 'rejected' | 'expired';
  fundingAmount: number;
  endTime: number;
  creator: string;
}

export default function VotePage() {
  const { isConnected, address, balance } = useWalletContext();
  const { getProposals, voteOnProposal } = useClimateDAO();
  const { notifyTransactionSuccess, notifyTransactionFailure } = useNotifications();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingState, setVotingState] = useState<{
    proposalId: number | null;
    status: 'idle' | 'pending' | 'confirmed' | 'failed';
    txId?: string;
    result?: TransactionResult;
    error?: string;
  }>({ proposalId: null, status: 'idle' });

  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    proposalId: number | null;
    proposal: Proposal | null;
    voteType: 'for' | 'against' | null;
  }>({
    isOpen: false,
    proposalId: null,
    proposal: null,
    voteType: null
  });

  // State for copy feedback
  const [copied, setCopied] = useState(false);

  // Fetch proposals
  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const allProposals = await getProposals();
        setProposals(allProposals);
      } catch (error) {
        console.error('Failed to fetch proposals:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      fetchProposals();
    }
  }, [isConnected]); // Remove function dependencies to prevent infinite loops

  const handleVoteClick = (proposal: Proposal, voteType: 'for' | 'against') => {
    setConfirmationDialog({
      isOpen: true,
      proposalId: proposal.id,
      proposal,
      voteType
    });
  };

  const handleVoteConfirm = async () => {
    if (!confirmationDialog.proposalId || !confirmationDialog.voteType) return;
    
    setVotingState({ 
      proposalId: confirmationDialog.proposalId, 
      status: 'pending' 
    });
    
    try {
      const result = await voteOnProposal(confirmationDialog.proposalId, confirmationDialog.voteType);
      setVotingState({
        proposalId: confirmationDialog.proposalId,
        status: 'confirmed',
        txId: result.txId,
        result
      });
      
      // Notify success
      notifyTransactionSuccess(
        'Vote',
        result.txId,
        `Voted ${confirmationDialog.voteType?.toUpperCase()} on "${confirmationDialog.proposal?.title}"`
      );
      
      // Close dialog
      setConfirmationDialog({
        isOpen: false,
        proposalId: null,
        proposal: null,
        voteType: null
      });
      
      // Refresh proposals after successful vote
      setTimeout(async () => {
        const updatedProposals = await getProposals();
        setProposals(updatedProposals);
        setVotingState({ proposalId: null, status: 'idle' });
      }, 3000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Vote failed';
      setVotingState({
        proposalId: confirmationDialog.proposalId,
        status: 'failed',
        error: errorMessage
      });
      
      // Notify failure
      notifyTransactionFailure('Vote', errorMessage);
      
      // Close dialog on error too
      setConfirmationDialog({
        isOpen: false,
        proposalId: null,
        proposal: null,
        voteType: null
      });
    }
  };

  const handleVote = async (proposalId: number, vote: 'for' | 'against') => {
    // Legacy handler - replaced by handleVoteClick + handleVoteConfirm
    // Keeping for compatibility, but not used anymore
    console.warn('Legacy handleVote called - should use handleVoteClick instead');
  };

  const getCategoryColor = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'renewable-energy': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      'carbon-capture': 'bg-green-500/20 text-green-400 border-green-500/50',
      'reforestation': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'ocean-cleanup': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      'clean-energy': 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    };
    return categoryMap[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  return (
    <WalletGuard requireBalance={0.05}>
      <div className="relative flex flex-col min-h-[100dvh] text-white overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-blue-200 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-white/20"></div>
            <VoteIcon className="w-8 h-8 text-white" />
            <div className="text-white font-bold text-xl">Vote on Proposals</div>
          </div>
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-white/90">Balance: {balance.toFixed(3)} ALGO</div>
                  <div className="text-xs text-white/70">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                  </div>
                </div>
                <WalletIcon className="w-8 h-8 text-green-400" />
              </div>
            ) : null}
          </div>
        </header>

        <main className="relative z-10 flex-1 px-6 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Transaction Status */}
            {votingState.status !== 'idle' && (
              <div className="mb-6">
                <TransactionStatus
                  txId={votingState.txId}
                  result={votingState.result}
                  status={votingState.status}
                  error={votingState.error}
                  onClose={votingState.status !== 'pending' ? () => setVotingState({ proposalId: null, status: 'idle' }) : undefined}
                  estimatedTime={5}
                />
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                <CardContent className="p-4 text-center">
                  <VoteIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{proposals.filter(p => p.status === 'active').length}</div>
                  <div className="text-sm text-white/60">Active Votes</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                <CardContent className="p-4 text-center">
                  <CheckCircleIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{proposals.filter(p => p.status === 'passed').length}</div>
                  <div className="text-sm text-white/60">Passed</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                <CardContent className="p-4 text-center">
                  <XCircleIcon className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{proposals.filter(p => p.status === 'rejected').length}</div>
                  <div className="text-sm text-white/60">Rejected</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl">
                <CardContent className="p-4 text-center">
                  <LeafIcon className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">
                    ${proposals.reduce((sum, p) => sum + p.fundingAmount, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-white/60">Total Funding</div>
                </CardContent>
              </Card>
            </div>

            {/* Proposals List */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                All Proposals ({proposals.length})
              </h2>
              
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white/60">Loading proposals...</p>
                </div>
              ) : proposals.length > 0 ? (
                proposals.map((proposal) => {
                  const totalVotes = proposal.voteYes + proposal.voteNo;
                  const yesPercentage = totalVotes > 0 ? (proposal.voteYes / totalVotes) * 100 : 0;
                  const timeLeft = Math.ceil((proposal.endTime - Date.now()) / (24 * 60 * 60 * 1000));
                  const timeText = timeLeft > 0 ? `${timeLeft}d left` : 'Expired';
                  const isVoting = votingState.proposalId === proposal.id && votingState.status === 'pending';
                  
                  return (
                    <Card key={proposal.id} className="bg-white/5 backdrop-blur-xl border-white/10 rounded-3xl hover:bg-white/10 transition-all duration-300">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <CardTitle className="text-white text-xl">{proposal.title}</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge className={getCategoryColor(proposal.category)}>
                                {proposal.category.replace('-', ' ').toUpperCase()}
                              </Badge>
                              <Badge className={
                                proposal.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 
                                proposal.status === 'passed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                                'bg-red-500/20 text-red-400 border-red-500/50'
                              }>
                                {proposal.status.toUpperCase()}
                              </Badge>
                              {proposal.aiScore && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                                  AI Score: {proposal.aiScore}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-white font-semibold">
                              ${proposal.fundingAmount.toLocaleString()}
                            </div>
                            <Badge className={timeLeft > 0 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}>
                              <ClockIcon className="w-3 h-3 mr-1" />
                              {timeText}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <CardDescription className="text-white/80 text-base">
                          {proposal.description}
                        </CardDescription>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">
                              Yes: {proposal.voteYes} ({yesPercentage.toFixed(1)}%)
                            </span>
                            <span className="text-white/60">
                              No: {proposal.voteNo} ({(100 - yesPercentage).toFixed(1)}%)
                            </span>
                          </div>
                          <Progress 
                            value={yesPercentage} 
                            className="w-full h-2 bg-white/10"
                          />
                          <div className="text-center text-xs text-white/60">
                            Total votes: {totalVotes}
                          </div>
                        </div>
                        
                        {proposal.status === 'active' && (
                          <div className="flex gap-3 pt-2">
                            <Button
                              size="sm"
                              disabled={isVoting}
                              onClick={() => handleVoteClick(proposal, 'for')}
                              className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl"
                            >
                              {isVoting ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 border border-green-400/50 border-t-green-400 rounded-full animate-spin"></div>
                                  Voting...
                                </div>
                              ) : (
                                <>Vote Yes (0.001 ALGO)</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isVoting}
                              onClick={() => handleVoteClick(proposal, 'against')}
                              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl"
                            >
                              {isVoting ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin"></div>
                                  Voting...
                                </div>
                              ) : (
                                <>Vote No (0.001 ALGO)</>
                              )}
                            </Button>
                          </div>
                        )}
                        
                        {/* Transaction ID Box - Always visible for active proposals */}
                        {proposal.status === 'active' && (
                          <div className="mt-4 p-3 bg-black/20 border border-white/20 rounded-xl">
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-white/70 mb-2 block">Transaction ID:</label>
                                <div className="flex items-center gap-2 bg-black/30 rounded-lg p-3">
                                  <code className="text-sm text-blue-400 font-mono break-all flex-1">
                                    {votingState.proposalId === proposal.id && votingState.txId 
                                      ? votingState.txId 
                                      : 'No transaction yet - vote to generate transaction ID'}
                                  </code>
                                  {votingState.proposalId === proposal.id && votingState.txId && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(votingState.txId!);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                      }}
                                      className="text-white/70 hover:text-white hover:bg-white/10 p-2 h-8 w-8"
                                    >
                                      <CopyIcon className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                {copied && votingState.proposalId === proposal.id && votingState.txId && (
                                  <p className="text-xs text-green-400 mt-1">Copied to clipboard!</p>
                                )}
                              </div>
                              
                              {votingState.proposalId === proposal.id && votingState.txId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`https://lora.algokit.io/testnet/transaction/${votingState.txId}`, '_blank')}
                                  className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent text-xs"
                                >
                                  <ExternalLinkIcon className="w-4 h-4 mr-2" />
                                  View on Lora Explorer
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Transaction Success Box */}
                        {votingState.proposalId === proposal.id && votingState.status === 'confirmed' && votingState.txId && (
                          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircleIcon className="w-5 h-5 text-green-400" />
                              <span className="text-green-400 font-medium">Vote Confirmed!</span>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-white/70 mb-1 block">Transaction ID:</label>
                                <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2">
                                  <code className="text-xs text-blue-400 font-mono break-all flex-1">
                                    {votingState.txId}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(votingState.txId!);
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="text-white/70 hover:text-white hover:bg-white/10 p-1 h-6 w-6"
                                  >
                                    <CopyIcon className="w-3 h-3" />
                                  </Button>
                                </div>
                                {copied && (
                                  <p className="text-xs text-green-400 mt-1">Copied to clipboard!</p>
                                )}
                              </div>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`https://lora.algokit.io/testnet/transaction/${votingState.txId}`, '_blank')}
                                className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent text-xs"
                              >
                                <ExternalLinkIcon className="w-3 h-3 mr-2" />
                                View on Lora Explorer
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="text-xs text-white/40 pt-2">
                          Created by: {proposal.creator}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <VoteIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60 mb-2">No proposals found</p>
                  <p className="text-white/40 text-sm">Proposals will appear here when submitted to the DAO</p>
                  <Link href="/submit-proposal" className="mt-4 inline-block">
                    <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                      Submit First Proposal
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 text-center py-6 text-white/60 text-sm border-t border-white/10">
          <p>&copy; {new Date().getFullYear()} EcoNexus. Decentralized climate action through blockchain governance.</p>
        </footer>

        {/* Vote Confirmation Dialog */}
        {confirmationDialog.isOpen && confirmationDialog.proposal && (
          <VoteConfirmationDialog
            isOpen={confirmationDialog.isOpen}
            onClose={() => setConfirmationDialog({
              isOpen: false,
              proposalId: null,
              proposal: null,
              voteType: null
            })}
            onConfirm={handleVoteConfirm}
            proposal={confirmationDialog.proposal}
            voteType={confirmationDialog.voteType!}
            isLoading={votingState.status === 'pending'}
          />
        )}
      </div>
    </WalletGuard>
  );
}
