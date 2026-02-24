'use client';

/**
 * Member Tracker Service
 * Tracks unique wallet addresses that connect to the platform
 */

export interface MemberData {
  address: string;
  joinedAt: number;
  lastSeen: number;
}

class MemberTrackerService {
  private readonly STORAGE_KEY = 'climate_dao_members';

  /**
   * Get all registered members
   */
  getMembers(): MemberData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading members:', error);
      return [];
    }
  }

  /**
   * Register a new member or update existing member's last seen
   */
  registerMember(address: string): boolean {
    try {
      const members = this.getMembers();
      const existingMember = members.find(m => m.address === address);
      
      if (existingMember) {
        // Update last seen
        existingMember.lastSeen = Date.now();
      } else {
        // Add new member
        members.push({
          address,
          joinedAt: Date.now(),
          lastSeen: Date.now()
        });
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(members));
      return !existingMember; // Return true if new member
    } catch (error) {
      console.error('Error registering member:', error);
      return false;
    }
  }

  /**
   * Get total member count
   */
  getMemberCount(): number {
    return this.getMembers().length;
  }

  /**
   * Get active members (seen in last 30 days)
   */
  getActiveMemberCount(): number {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return this.getMembers().filter(m => m.lastSeen > thirtyDaysAgo).length;
  }
}

export const memberTracker = new MemberTrackerService();
