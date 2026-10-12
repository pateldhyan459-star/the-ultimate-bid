import { useEffect, useState } from 'react';

const OPENING = 1000;
const FINAL = 4750;
const DURATION_MS = 2400;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * A fictional lot that shows how the live screen will look.
 * The bid figure climbs once on page load. It is a visual sample only:
 * no data here comes from, or goes to, any server.
 */
export default function SampleLot() {
  const [amount, setAmount] = useState(OPENING);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setAmount(FINAL);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      // Climb in whole steps of 250, like real raises.
      const raw = OPENING + (FINAL - OPENING) * easeOutCubic(progress);
      setAmount(Math.min(FINAL, Math.round(raw / 250) * 250));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <article className="plate lot" aria-label="Sample lot, fictional">
      <span className="lot__tag">Sample lot, fictional</span>
      <h2 className="lot__title">The Midnight Compass</h2>
      <p className="lot__desc">A made-up item that shows what a live lot looks like.</p>

      <div className="lot__bid">
        <p className="lot__bid-label">Highest bid</p>
        <p className="lot__amount" aria-live="off">
          {amount.toLocaleString('en-IN')}
        </p>
        <p className="lot__leader">Leading team: Team Orion (sample)</p>
      </div>

      <div className="lot__foot">
        <span>Opening bid {OPENING.toLocaleString('en-IN')}</span>
        <span>Minimum raise 250</span>
      </div>
    </article>
  );
}
