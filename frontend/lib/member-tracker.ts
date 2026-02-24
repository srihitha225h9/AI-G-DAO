'use client';

export interface MemberData {
  address: string;
  joinedAt: number;
}

class MemberTrackerService {
  async registerMember(address: string): Promise<boolean> {
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const data = await response.json();
      return data.isNew || false;
    } catch (error) {
      console.error('Error registering member:', error);
      return false;
    }
  }

  async getMemberCount(): Promise<number> {
    try {
      const response = await fetch('/api/members');
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Error getting member count:', error);
      return 0;
    }
  }
}

export const memberTracker = new MemberTrackerService();
