import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!
const ALGOD_URL = 'https://testnet-api.algonode.cloud'

// GET /api/treasury — returns balance + releases for a proposal
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const proposalId = searchParams.get('proposalId')

  try {
    // Fetch live treasury balance from Algorand testnet
    const res = await fetch(`${ALGOD_URL}/v2/accounts/${TREASURY}`, {
      headers: { 'X-Algo-API-Token': '' },
    })
    const data = await res.json()
    const balanceAlgo = (data.amount || 0) / 1_000_000

    // Fetch released milestones for this proposal from DB
    let released: number[] = []
    if (proposalId) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS milestone_releases (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id bigint NOT NULL,
          milestone_idx integer NOT NULL,
          amount_algo numeric NOT NULL,
          tx_id text NOT NULL,
          released_at timestamptz DEFAULT now(),
          UNIQUE(proposal_id, milestone_idx)
        )
      `)
      const { rows } = await pool.query(
        'SELECT milestone_idx FROM milestone_releases WHERE proposal_id = $1',
        [proposalId]
      )
      released = rows.map((r: any) => r.milestone_idx)
    }

    return NextResponse.json({ treasury: TREASURY, balanceAlgo, released })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/treasury — record a milestone release after txn confirmed
export async function POST(req: NextRequest) {
  try {
    const { proposalId, milestoneIdx, amountAlgo, txId } = await req.json()
    await pool.query(`
      CREATE TABLE IF NOT EXISTS milestone_releases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id bigint NOT NULL,
        milestone_idx integer NOT NULL,
        amount_algo numeric NOT NULL,
        tx_id text NOT NULL,
        released_at timestamptz DEFAULT now(),
        UNIQUE(proposal_id, milestone_idx)
      )
    `)
    await pool.query(
      `INSERT INTO milestone_releases (proposal_id, milestone_idx, amount_algo, tx_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (proposal_id, milestone_idx) DO NOTHING`,
      [proposalId, milestoneIdx, amountAlgo, txId]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
