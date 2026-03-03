import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { proposalId, voterAddress, vote, txId } = req.body;

  // Check if user already voted
  const { data: existing } = await supabase
    .from('votes')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('voter_address', voterAddress)
    .single();

  if (existing) {
    return res.status(400).json({ error: 'Already voted' });
  }

  // Store vote
  const { error: voteError } = await supabase
    .from('votes')
    .insert([{
      proposal_id: proposalId,
      voter_address: voterAddress,
      vote,
      tx_id: txId,
      timestamp: Date.now()
    }]);

  if (voteError) return res.status(500).json({ error: voteError.message });

  // Update proposal vote count
  const field = vote === 'for' ? 'vote_yes' : 'vote_no';
  const { error: updateError } = await supabase.rpc('increment_vote', {
    proposal_id: proposalId,
    vote_field: field
  });

  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ success: true });
}
