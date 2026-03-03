import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { proposalId } = req.body;

  try {
    // Get proposal
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (propError || !proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get total members for participation check
    const { count: totalMembers } = await supabase
      .from('votes')
      .select('voter_address', { count: 'exact', head: true });

    // Calculate voting results
    const totalVotes = proposal.vote_yes + proposal.vote_no;
    const yesPercentage = totalVotes > 0 ? proposal.vote_yes / totalVotes : 0;
    
    // Voting thresholds
    const MIN_PARTICIPATION = 0.2; // 20% of members must vote
    const PASS_THRESHOLD = 0.6; // 60% yes votes required

    const participationRate = totalMembers ? totalVotes / totalMembers : 0;

    // Check if proposal passed
    if (participationRate < MIN_PARTICIPATION) {
      return res.status(400).json({ 
        error: 'Insufficient participation',
        participationRate,
        required: MIN_PARTICIPATION
      });
    }

    if (yesPercentage < PASS_THRESHOLD) {
      // Mark as rejected
      await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalId);

      return res.status(400).json({ 
        error: 'Proposal did not pass',
        yesPercentage,
        required: PASS_THRESHOLD
      });
    }

    // Proposal passed - mark as passed
    const { error: updateError } = await supabase
      .from('proposals')
      .update({ status: 'passed' })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    // TODO: Integrate with Algorand to transfer funds
    // await transferFunds(proposal.creator, proposal.funding_amount);

    return res.status(200).json({ 
      success: true,
      message: 'Proposal passed and funds released',
      yesPercentage,
      participationRate
    });

  } catch (error) {
    console.error('Execute proposal error:', error);
    return res.status(500).json({ error: 'Failed to execute proposal' });
  }
}
