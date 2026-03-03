import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database schema needed:
// 
// Table: proposals
// - id: bigint (primary key)
// - title: text
// - description: text
// - creator: text
// - funding_amount: numeric
// - vote_yes: integer (default 0)
// - vote_no: integer (default 0)
// - status: text (default 'active')
// - end_time: bigint
// - category: text
// - ai_score: numeric
// - creation_time: bigint
// - created_at: timestamp (default now())
//
// Table: votes
// - id: uuid (primary key)
// - proposal_id: bigint (foreign key)
// - voter_address: text
// - vote: text ('for' or 'against')
// - tx_id: text
// - timestamp: bigint
// - created_at: timestamp (default now())
// - UNIQUE(proposal_id, voter_address)
