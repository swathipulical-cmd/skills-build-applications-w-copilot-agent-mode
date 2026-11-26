import { useEffect, useState, type FormEvent } from 'react';
import { createTeam, getJson, readTeamsResponse } from '../api/client.js';
import type { TeamSummary } from '../api/types.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function Teams() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [mascot, setMascot] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function refreshTeams() {
    setIsLoading(true);
    setLoadError('');
    try {
      setTeams(readTeamsResponse(await getJson<unknown>('/api/teams')));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshTeams();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError('');
    setSuccessMessage('');
    try {
      await createTeam({ name: name.trim(), mascot: mascot.trim() });
      setName('');
      setMascot('');
      setSuccessMessage('Team created successfully.');
      await refreshTeams();
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section aria-labelledby="teams-heading">
      <h2 id="teams-heading">Teams</h2>
      <form className="card card-body mb-4" onSubmit={handleSubmit}>
        <h3 className="h5">Create a team</h3>
        <div className="mb-3">
          <label className="form-label" htmlFor="team-name">Team name</label>
          <input
            className="form-control"
            id="team-name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="team-mascot">Mascot</label>
          <input
            className="form-control"
            id="team-mascot"
            onChange={(event) => setMascot(event.target.value)}
            required
            value={mascot}
          />
        </div>
        <button className="btn btn-primary align-self-start" disabled={isCreating} type="submit">
          {isCreating ? 'Creating team…' : 'Create team'}
        </button>
        {createError && <p className="mt-3 mb-0" role="alert">Unable to create team: {createError}</p>}
        {successMessage && <p className="mt-3 mb-0" role="status">{successMessage}</p>}
      </form>

      <h3 className="h5">Team directory</h3>
      {isLoading && <p role="status">Loading teams…</p>}
      {loadError && <p role="alert">Unable to load teams: {loadError}</p>}
      {!isLoading && !loadError && teams.length === 0 && <p role="status">No teams yet.</p>}
      {!isLoading && !loadError && teams.length > 0 && (
        <ul className="list-group">
          {teams.map((team, index) => (
            <li className="list-group-item" key={team._id ?? `${team.name}-${index}`}>
              <h4 className="h6 mb-1">{team.name}</h4>
              {team.mascot && <p className="mb-1">Mascot: {team.mascot}</p>}
              <p className="mb-0">
                Members: {team.members && team.members.length > 0 ? team.members.join(', ') : 'No members assigned.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
