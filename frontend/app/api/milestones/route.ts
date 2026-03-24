import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export interface Milestone {
  id: number;
  title: string;
  description: string;
  fundingPercent: number;   // % of total funding released at this milestone
  status: 'locked' | 'active' | 'pending_release' | 'completed' | 'failed';
  completedAt?: number;
  txId?: string;
  evidence?: string;        // proof submitted by creator
}

// GET /api/milestones?proposalId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = searchParams.get('proposalId');
    if (!proposalId) return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });

    const { rows } = await pool.query(
      'SELECT milestones, funding_amount, creator, status FROM proposals WHERE id = $1',
      [proposalId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    return NextResponse.json({
      milestones: rows[0].milestones || [],
      fundingAmount: Number(rows[0].funding_amount),
      creator: rows[0].creator,
      proposalStatus: rows[0].status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/milestones — creator submits evidence for the active milestone
export async function POST(req: NextRequest) {
  try {
    const { proposalId, milestoneId, evidence, callerAddress } = await req.json();

    const { rows } = await pool.query(
      'SELECT milestones, creator FROM proposals WHERE id = $1',
      [proposalId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    if (rows[0].creator !== callerAddress)
      return NextResponse.json({ error: 'Only the proposal creator can submit evidence' }, { status: 403 });

    const milestones: Milestone[] = rows[0].milestones || [];
    const idx = milestones.findIndex(m => m.id === milestoneId);
    if (idx === -1) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (milestones[idx].status !== 'active')
      return NextResponse.json({ error: 'This milestone is not active yet' }, { status: 400 });

    // Move to pending_release — DAO community will approve and release funds
    milestones[idx].status = 'pending_release';
    milestones[idx].evidence = evidence;

    await pool.query('UPDATE proposals SET milestones = $1 WHERE id = $2', [
      JSON.stringify(milestones), proposalId,
    ]);

    return NextResponse.json({ success: true, milestones });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/milestones — DAO member approves or rejects a pending milestone
export async function PATCH(req: NextRequest) {
  try {
    const { proposalId, milestoneId, action } = await req.json();
    // action: 'approve' | 'reject'

    const { rows } = await pool.query(
      'SELECT milestones, funding_amount, creator FROM proposals WHERE id = $1',
      [proposalId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    const milestones: Milestone[] = rows[0].milestones || [];
    const idx = milestones.findIndex(m => m.id === milestoneId);
    if (idx === -1) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (milestones[idx].status !== 'pending_release')
      return NextResponse.json({ error: 'Milestone is not pending release' }, { status: 400 });

    const mockTxId = `milestone_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (action === 'approve') {
      // Complete current milestone and release its funds
      milestones[idx].status = 'completed';
      milestones[idx].completedAt = Date.now();
      milestones[idx].txId = mockTxId;

      // Automatically unlock the NEXT milestone
      const nextIdx = idx + 1;
      if (nextIdx < milestones.length) {
        milestones[nextIdx].status = 'active';
      }
    } else if (action === 'reject') {
      // Revert to active so creator can resubmit evidence
      milestones[idx].status = 'active';
      milestones[idx].evidence = undefined;
    }

    await pool.query('UPDATE proposals SET milestones = $1 WHERE id = $2', [
      JSON.stringify(milestones), proposalId,
    ]);

    // Update creator reputation
    const completed = milestones.filter(m => m.status === 'completed').length;
    const failed = milestones.filter(m => m.status === 'failed').length;
    const repScore = Math.min(100, Math.max(0, 50 + completed * 15 - failed * 20));
    const maxFunding = completed >= 4 ? 1000 : completed >= 2 ? 500 : completed >= 1 ? 300 : 100;

    await pool.query(
      `INSERT INTO reputation (wallet_address, milestones_completed, milestones_failed, reputation_score, max_funding_algo)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (wallet_address) DO UPDATE
       SET milestones_completed=$2, milestones_failed=$3, reputation_score=$4, max_funding_algo=$5, updated_at=now()`,
      [rows[0].creator, completed, failed, repScore, maxFunding]
    );

    return NextResponse.json({
      success: true,
      milestones,
      txId: action === 'approve' ? mockTxId : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
