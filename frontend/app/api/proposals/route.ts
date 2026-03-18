import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id bigint PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      creator text NOT NULL,
      funding_amount numeric NOT NULL DEFAULT 0,
      vote_yes integer NOT NULL DEFAULT 0,
      vote_no integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'active',
      end_time bigint NOT NULL,
      category text NOT NULL,
      ai_score numeric DEFAULT 0,
      ai_review jsonb DEFAULT NULL,
      creation_time bigint NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS votes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id bigint NOT NULL REFERENCES proposals(id),
      voter_address text NOT NULL,
      vote text NOT NULL CHECK (vote IN ('for', 'against')),
      tx_id text,
      voted_at timestamptz DEFAULT now(),
      UNIQUE(proposal_id, voter_address)
    );
    ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_review jsonb DEFAULT NULL;
  `);
}

function mapRow(row: any) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    creator: row.creator,
    fundingAmount: Number(row.funding_amount),
    voteYes: row.vote_yes,
    voteNo: row.vote_no,
    status: row.status,
    endTime: Number(row.end_time),
    category: row.category,
    aiScore: Number(row.ai_score),
    aiReview: row.ai_review || null,
    creationTime: Number(row.creation_time),
  };
}

// GET /api/proposals
export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const creator = searchParams.get('creator');

    let query = 'SELECT * FROM proposals';
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (creator) { conditions.push(`creator = $${params.length + 1}`); params.push(creator); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY creation_time DESC';

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows.map(mapRow));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/proposals
export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    await pool.query(
      `INSERT INTO proposals (id, title, description, creator, funding_amount, vote_yes, vote_no, status, end_time, category, ai_score, creation_time)
       VALUES ($1,$2,$3,$4,$5,0,0,'active',$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [body.id, body.title, body.description, body.creator, body.fundingAmount,
       body.endTime, body.category, body.aiScore || 0, body.creationTime || Date.now()]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/proposals
export async function PATCH(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { id, status, vote, ai_review } = body;

    if (status) {
      await pool.query('UPDATE proposals SET status = $1 WHERE id = $2', [status, id]);
    }
    if (vote === 'for') {
      await pool.query('UPDATE proposals SET vote_yes = vote_yes + 1 WHERE id = $1', [id]);
    } else if (vote === 'against') {
      await pool.query('UPDATE proposals SET vote_no = vote_no + 1 WHERE id = $1', [id]);
    }
    if (ai_review !== undefined) {
      await pool.query('UPDATE proposals SET ai_review = $1 WHERE id = $2', [JSON.stringify(ai_review), id]);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/proposals
export async function DELETE(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const creator = searchParams.get('creator');

    if (!id || !creator) return NextResponse.json({ error: 'Missing id or creator' }, { status: 400 });

    const { rows } = await pool.query('SELECT creator, vote_yes, vote_no FROM proposals WHERE id = $1', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    if (rows[0].creator !== creator) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    if (rows[0].vote_yes > 0 || rows[0].vote_no > 0) return NextResponse.json({ error: 'Cannot delete a proposal that has received votes' }, { status: 400 });

    await pool.query('DELETE FROM proposals WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
