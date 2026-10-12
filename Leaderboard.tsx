import { credits } from '../lib/money';
import type { LeaderRow } from '../types/db';

export default function Leaderboard({ rows, highlightTeamId }: { rows: LeaderRow[]; highlightTeamId?: string | null }) {
  if (rows.length === 0) return <p className="muted">No teams yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>#</th><th>Team</th><th>Lots won</th><th>Spent</th><th>Remaining</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team_id} className={r.team_id === highlightTeamId ? 'row--me' : undefined}>
              <td>{i + 1}</td>
              <td>{r.team_name}</td>
              <td>{r.lots_won}</td>
              <td>{credits(r.spent)}</td>
              <td>{credits(r.remaining)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
