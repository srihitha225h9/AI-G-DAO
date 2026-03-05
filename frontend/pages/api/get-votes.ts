import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { proposalId } = req.query;

  try {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Get votes error:', error);
    return res.status(500).json({ error: 'Failed to get votes' });
  }
}
