import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage (resets on redeploy, but works for demo)
const members = new Map<string, { address: string; joinedAt: number }>();

export async function GET() {
  return NextResponse.json({
    count: members.size,
    members: Array.from(members.values())
  });
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const isNew = !members.has(address);
    
    members.set(address, {
      address,
      joinedAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      isNew,
      count: members.size
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
