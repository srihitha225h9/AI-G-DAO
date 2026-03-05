'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Users } from 'lucide-react';

interface Vote {
  id: string;
  proposal_id: number;
  voter_address: string;
  vote: 'for' | 'against';
  timestamp: number;
  tx_id: string;
}

interface VotingHistoryProps {
  proposalId: number;
  autoRefresh?: boolean;
}

export function VotingHistory({ proposalId, autoRefresh = true }: VotingHistoryProps) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVotes = async () => {
    try {
      const response = await fetch(`/api/get-votes?proposalId=${proposalId}`);
      if (response.ok) {
        const data = await response.json();
        setVotes(data);
      }
    } catch (error) {
      console.error('Error fetching votes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVotes();

    if (autoRefresh) {
      const interval = setInterval(fetchVotes, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [proposalId, autoRefresh]);

  const forVotes = votes.filter(v => v.vote === 'for');
  const againstVotes = votes.filter(v => v.vote === 'against');

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-6">
          <p className="text-gray-400">Loading votes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Users className="w-5 h-5" />
          Voting History ({votes.length} votes)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <ThumbsUp className="w-4 h-4" />
              <span className="font-semibold">For</span>
            </div>
            <p className="text-2xl font-bold text-white">{forVotes.length}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <ThumbsDown className="w-4 h-4" />
              <span className="font-semibold">Against</span>
            </div>
            <p className="text-2xl font-bold text-white">{againstVotes.length}</p>
          </div>
        </div>

        {/* Vote List */}
        {votes.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No votes yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {votes.map((vote) => (
              <div
                key={vote.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm text-blue-400 font-mono">
                      {formatAddress(vote.voter_address)}
                    </code>
                    <Badge
                      variant={vote.vote === 'for' ? 'default' : 'destructive'}
                      className={
                        vote.vote === 'for'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }
                    >
                      {vote.vote === 'for' ? (
                        <ThumbsUp className="w-3 h-3 mr-1" />
                      ) : (
                        <ThumbsDown className="w-3 h-3 mr-1" />
                      )}
                      {vote.vote === 'for' ? 'For' : 'Against'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{formatTime(vote.timestamp)}</p>
                </div>
                {vote.tx_id && (
                  <a
                    href={`https://testnet.algoexplorer.io/tx/${vote.tx_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View TX
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
