import { useEffect, useState } from 'react';
import { getJson, readLeaderboardResponse } from '../api/client.js';
import type { LeaderboardEntry } from '../api/types.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setEntries(readLeaderboardResponse(await getJson<unknown>('/api/leaderboard')));
      } catch (error) {
        setLoadError(errorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadLeaderboard();
  }, []);

  return (
    <section aria-labelledby="leaderboard-heading">
      <h2 id="leaderboard-heading">Leaderboard</h2>
      {isLoading && <p role="status">Loading leaderboard…</p>}
      {loadError && <p role="alert">Unable to load leaderboard: {loadError}</p>}
      {!isLoading && !loadError && entries.length === 0 && <p role="status">No leaderboard rankings yet.</p>}
      {!isLoading && !loadError && entries.length > 0 && (
        <table className="table table-striped">
          <caption className="visually-hidden">Leaderboard standings</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Team</th>
              <th scope="col">Total points</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.rank}>
                <td>{entry.rank}</td>
                <td>{entry.teamName}</td>
                <td>{entry.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
