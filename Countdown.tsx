import { useEffect, useRef, useState } from 'react';

interface Props {
  endsAt: string | null;
  /** Server clock minus browser clock, in ms. */
  offsetMs: number;
  /** Called once when the display reaches zero. The SERVER still decides the result. */
  onExpire?: () => void;
  pausedMs?: number | null;
}

export default function Countdown({ endsAt, offsetMs, onExpire, pausedMs }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const remaining = endsAt
    ? Math.max(0, new Date(endsAt).getTime() - (now + offsetMs))
    : pausedMs ?? null;

  useEffect(() => {
    if (endsAt && remaining === 0 && fired.current !== endsAt) {
      fired.current = endsAt;
      onExpire?.();
      // Retry shortly in case the first call raced the server clock.
      window.setTimeout(() => onExpire?.(), 1200);
    }
  }, [endsAt, remaining, onExpire]);

  if (remaining === null) return <span className="timer">--</span>;
  const secs = remaining / 1000;
  const text = secs < 10 ? secs.toFixed(1) : String(Math.ceil(secs));
  return (
    <span className={`timer${secs <= 5 && endsAt ? ' timer--hot' : ''}${!endsAt ? ' timer--paused' : ''}`}>
      {text}s{!endsAt ? ' (paused)' : ''}
    </span>
  );
}
