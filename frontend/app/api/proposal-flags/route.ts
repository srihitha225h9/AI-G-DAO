import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposal_flags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id bigint NOT NULL,
      flagger_address text NOT NULL,
      duplicate_of bigint,
      reason text,
      flagged_at timestamptz DEFAULT now(),
      UNIQUE(proposal_id, flagger_address)
    )
  `)
}

// GET /api/proposal-flags?proposalId=X&flagger=Y
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const proposalId = searchParams.get('proposalId')
    const flagger = searchParams.get('flagger')
    if (!proposalId) return NextResponse.json({ flags: [], count: 0 })
    const { rows } = await pool.query(
      'SELECT flagger_address, duplicate_of, reason, flagged_at FROM proposal_flags WHERE proposal_id = $1',
      [proposalId]
    )
    const myFlag = flagger ? rows.find((r: any) => r.flagger_address === flagger) : null
    return NextResponse.json({ flags: rows, count: rows.length, myFlag: myFlag || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/proposal-flags
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const { proposalId, flaggerAddress, duplicateOf, reason } = await req.json()
    if (!proposalId || !flaggerAddress) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await pool.query(
      `INSERT INTO proposal_flags (proposal_id, flagger_address, duplicate_of, reason)
       VALUES ($1,$2,$3,$4) ON CONFLICT (proposal_id, flagger_address) DO NOTHING`,
      [proposalId, flaggerAddress, duplicateOf || null, reason || null]
    )

    // Count flags — if >= 3 pause the proposal
    const { rows } = await pool.query(
      'SELECT COUNT(*) as cnt FROM proposal_flags WHERE proposal_id = $1',
      [proposalId]
    )
    const flagCount = parseInt(rows[0].cnt)
    if (flagCount >= 3) {
      await pool.query(
        "UPDATE proposals SET status = 'paused' WHERE id = $1 AND status = 'active'",
        [proposalId]
      )
    }
    return NextResponse.json({ success: true, flagCount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/proposal-flags?proposalId=X&flagger=Y
export async function DELETE(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const proposalId = searchParams.get('proposalId')
    const flagger = searchParams.get('flagger')
    if (!proposalId || !flagger) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    await pool.query(
      'DELETE FROM proposal_flags WHERE proposal_id = $1 AND flagger_address = $2',
      [proposalId, flagger]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
