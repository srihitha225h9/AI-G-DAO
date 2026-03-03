# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Fill in:
   - Name: AI-G-DAO
   - Database Password: (save this)
   - Region: Choose closest to you
5. Wait for project to be created (~2 minutes)

## 2. Run SQL to Create Tables

Go to SQL Editor in Supabase dashboard and run:

```sql
-- Create proposals table
CREATE TABLE proposals (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator TEXT NOT NULL,
  funding_amount NUMERIC NOT NULL,
  vote_yes INTEGER DEFAULT 0,
  vote_no INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  end_time BIGINT NOT NULL,
  category TEXT,
  ai_score NUMERIC,
  creation_time BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id BIGINT REFERENCES proposals(id),
  voter_address TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against')),
  tx_id TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(proposal_id, voter_address)
);

-- Create function to increment votes
CREATE OR REPLACE FUNCTION increment_vote(proposal_id BIGINT, vote_field TEXT)
RETURNS VOID AS $$
BEGIN
  IF vote_field = 'vote_yes' THEN
    UPDATE proposals SET vote_yes = vote_yes + 1 WHERE id = proposal_id;
  ELSE
    UPDATE proposals SET vote_no = vote_no + 1 WHERE id = proposal_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read proposals" ON proposals FOR SELECT USING (true);
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);

-- Allow public insert
CREATE POLICY "Public insert proposals" ON proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert votes" ON votes FOR INSERT WITH CHECK (true);
```

## 3. Get API Keys

1. Go to Project Settings → API
2. Copy:
   - Project URL (looks like: https://xxxxx.supabase.co)
   - anon/public key (long string starting with "eyJ...")

## 4. Update .env.local

Replace these lines in `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 5. Test the Integration

1. Restart your dev server: `npm run dev`
2. Connect wallet
3. Submit a proposal
4. Check Supabase dashboard → Table Editor → proposals
5. You should see your proposal!

## 6. Voting & Fund Release

### How it works:
- Users vote on proposals
- When voting ends, call `/api/execute-proposal`
- System checks:
  - ✅ 20%+ members participated
  - ✅ 60%+ voted YES
- If passed → Status changes to "passed" and funds released
- If failed → Status changes to "rejected"

### Thresholds (configurable in `/pages/api/execute-proposal.ts`):
```typescript
const MIN_PARTICIPATION = 0.2; // 20% must vote
const PASS_THRESHOLD = 0.6;    // 60% yes votes
```

## 7. Deploy to Vercel

Your Supabase credentials are already in `.env.local`. When deploying:

1. Go to Vercel dashboard
2. Project Settings → Environment Variables
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redeploy

Done! All users will now see the same proposals and can vote together.
