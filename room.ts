import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Bid, LeaderRow, Lot, Participant, Purchase, Room, Team } from '../types/db';

export interface RoomBundle {
  room: Room;
  lots: Lot[];
  teams: Team[];
  participants: Participant[];
  bids: Bid[];
  purchases: Purchase[];
  leaderboard: LeaderRow[];
}

/** Players skip the participants list (they cannot read other people's rows anyway). */
export async function loadRoomBundle(roomId: string, admin: boolean): Promise<RoomBundle> {
  if (!supabase) throw new Error('Backend not configured');
  const [room, lots, teams, participants, bids, purchases, board] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('lots').select('*').eq('room_id', roomId).order('position'),
    supabase.from('teams').select('*').eq('room_id', roomId).order('name'),
    admin
      ? supabase.from('participants').select('*').eq('room_id', roomId).order('joined_at')
      : Promise.resolve({ data: [] as Participant[], error: null }),
    supabase.from('bids').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(40),
    supabase.from('purchases').select('*').eq('room_id', roomId).order('created_at'),
    supabase.rpc('room_leaderboard', { p_room_id: roomId }),
  ]);
  const failed = [room, lots, teams, participants, bids, purchases, board].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return {
    room: room.data as Room,
    lots: (lots.data ?? []) as Lot[],
    teams: (teams.data ?? []) as Team[],
    participants: (participants.data ?? []) as Participant[],
    bids: (bids.data ?? []) as Bid[],
    purchases: (purchases.data ?? []) as Purchase[],
    leaderboard: (board.data ?? []) as LeaderRow[],
  };
}

/**
 * Loads everything about one room and keeps it fresh.
 * Fast path: Supabase Realtime pushes a signal when rows change.
 * Safety net: a periodic reload, and a reload when the tab becomes visible.
 *
 * Load-friendly on purpose (Supabase free tier allows 200 realtime connections and
 * 100 realtime messages per second): players subscribe to only the tables they need,
 * poll slowly, and add a small random delay before reloading so that 100 phones do not
 * hit the database in the same millisecond.
 */
export function useRoomBundle(roomId: string | null, admin = false) {
  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!roomId) return;
    try {
      setBundle(await loadRoomBundle(roomId, admin));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the room.');
    }
  }, [roomId, admin]);

  useEffect(() => {
    if (!roomId || !supabase) return;
    const client = supabase;
    void reload();

    const nudge = () => {
      window.clearTimeout(timer.current);
      const delay = admin ? 120 : 100 + Math.random() * 600;
      timer.current = window.setTimeout(() => void reload(), delay);
    };
    const tables = admin
      ? ['lots', 'bids', 'purchases', 'participants', 'teams']
      : ['lots', 'purchases'];
    let channel = client.channel(`room-${roomId}-${admin ? 'a' : 'p'}`);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        nudge,
      );
    }
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      nudge,
    );
    channel.subscribe();

    const poll = window.setInterval(() => void reload(), admin ? 5000 : 12000 + Math.random() * 4000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer.current);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      void client.removeChannel(channel);
    };
  }, [roomId, admin, reload]);

  return { bundle, error, reload };
}

/** Difference between the server clock and this browser's clock, for display only. */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    async function measure() {
      const t0 = Date.now();
      const { data, error } = await client.rpc('server_now');
      const t1 = Date.now();
      if (!cancelled && !error && typeof data === 'string') {
        setOffset(new Date(data).getTime() - (t0 + t1) / 2);
      }
    }
    void measure();
    const id = window.setInterval(() => void measure(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return offset;
}
