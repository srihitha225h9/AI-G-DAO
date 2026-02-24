'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface MemberData {
  address: string;
  joined_at: number;
  last_seen: number;
}

class SupabaseMemberTracker {
  async registerMember(address: string): Promise<boolean> {
    if (!supabase) {
      console.warn('Supabase not configured, using localStorage fallback');
      return this.fallbackRegister(address);
    }

    try {
      const now = Date.now();
      
      // Try to insert or update
      const { data, error } = await supabase
        .from('members')
        .upsert({
          address,
          joined_at: now,
          last_seen: now
        }, {
          onConflict: 'address',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      // Check if it was a new member
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('address', address);

      return count === 1;
    } catch (error) {
      console.error('Error registering member:', error);
      return this.fallbackRegister(address);
    }
  }

  async getMemberCount(): Promise<number> {
    if (!supabase) {
      return this.fallbackGetCount();
    }

    try {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting member count:', error);
      return this.fallbackGetCount();
    }
  }

  async getActiveMemberCount(): Promise<number> {
    if (!supabase) {
      return this.fallbackGetCount();
    }

    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', thirtyDaysAgo);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting active member count:', error);
      return this.fallbackGetCount();
    }
  }

  // Fallback to localStorage if Supabase not configured
  private fallbackRegister(address: string): boolean {
    const members = this.getLocalMembers();
    const existing = members.find(m => m.address === address);
    
    if (!existing) {
      members.push({
        address,
        joined_at: Date.now(),
        last_seen: Date.now()
      });
      localStorage.setItem('climate_dao_members', JSON.stringify(members));
      return true;
    }
    return false;
  }

  private fallbackGetCount(): number {
    return this.getLocalMembers().length;
  }

  private getLocalMembers(): MemberData[] {
    try {
      const stored = localStorage.getItem('climate_dao_members');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export const memberTracker = new SupabaseMemberTracker();
