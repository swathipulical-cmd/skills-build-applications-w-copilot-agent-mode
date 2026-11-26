import { useEffect, useState, type FormEvent } from 'react';
import {
  createActivity,
  getJson,
  readActivitiesResponse,
  readTeamsResponse,
  readUsersResponse,
} from '../api/client.js';
import type { ActivitySummary, TeamSummary, UserOption } from '../api/types.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function Activities() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [type, setType] = useState('');
  const [minutes, setMinutes] = useState('');
  const selectableTeams = teams.filter(
    (team): team is TeamSummary & { _id: string } => Boolean(team._id),
  );

  useEffect(() => {
    async function loadActivitiesAndOptions() {
      const [activityResult, teamResult, userResult] = await Promise.allSettled([
        getJson<unknown>('/api/activities').then(readActivitiesResponse),
        getJson<unknown>('/api/teams').then(readTeamsResponse),
        getJson<unknown>('/api/users').then(readUsersResponse),
      ]);

      if (activityResult.status === 'fulfilled') setActivities(activityResult.value);
      else setLoadError(errorMessage(activityResult.reason));

      if (teamResult.status === 'fulfilled') setTeams(teamResult.value);
      if (userResult.status === 'fulfilled') setUsers(userResult.value);

      const optionErrors = [teamResult, userResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => errorMessage(result.reason));
      setOptionsError(optionErrors.join(' '));
      setIsLoading(false);
    }

    void loadActivitiesAndOptions();
  }, []);

  const minutesValue = Number(minutes);
  const canCreateActivity = !isLoading
    && !loadError
    && users.some((user) => user._id === selectedUserId)
    && selectableTeams.some((team) => team._id === selectedTeamId)
    && type.trim().length > 0
    && minutes.trim().length > 0
    && Number.isFinite(minutesValue)
    && minutesValue >= 0;
  const loadErrorMessages = [
    loadError && `Unable to load activity data: ${loadError}`,
    optionsError && `Unable to load activity selection options: ${optionsError}`,
  ].filter(Boolean);

  async function refreshActivities() {
    try {
      setActivities(readActivitiesResponse(await getJson<unknown>('/api/activities')));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateActivity) {
      setCreateError('Select a user and team and enter a valid activity type and minutes.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setSuccessMessage('');
    try {
      await createActivity({
        userId: selectedUserId,
        teamId: selectedTeamId,
        type: type.trim(),
        minutes: minutesValue,
      });
      setSuccessMessage('Activity created successfully.');
      setSelectedUserId('');
      setSelectedTeamId('');
      setType('');
      setMinutes('');
      await refreshActivities();
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section aria-labelledby="activities-heading">
      <h2 id="activities-heading">Activities</h2>
      <form className="card card-body mb-4" onSubmit={handleSubmit}>
        <h3 className="h5">Create an activity</h3>
        <div className="mb-3">
          <label className="form-label" htmlFor="activity-team">Team</label>
          <select
            className="form-select"
            disabled={isLoading || Boolean(loadError) || selectableTeams.length === 0}
            id="activity-team"
            onChange={(event) => setSelectedTeamId(event.target.value)}
            required
            value={selectedTeamId}
          >
            <option value="">{selectableTeams.length === 0 ? 'No teams available' : 'Select a team'}</option>
            {selectableTeams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="activity-user">User</label>
          <select
            className="form-select"
            disabled={isLoading || Boolean(loadError) || users.length === 0}
            id="activity-user"
            onChange={(event) => setSelectedUserId(event.target.value)}
            required
            value={selectedUserId}
          >
            <option value="">{users.length === 0 ? 'No users available' : 'Select a user'}</option>
            {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="activity-type">Activity type</label>
          <input
            className="form-control"
            id="activity-type"
            onChange={(event) => setType(event.target.value)}
            required
            value={type}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="activity-minutes">Minutes</label>
          <input
            className="form-control"
            id="activity-minutes"
            min="0"
            onChange={(event) => setMinutes(event.target.value)}
            required
            step="any"
            type="number"
            value={minutes}
          />
        </div>
        <button className="btn btn-primary align-self-start" disabled={!canCreateActivity || isCreating} type="submit">
          {isCreating ? 'Creating activity…' : 'Create activity'}
        </button>
        {createError && <p className="mt-3 mb-0" role="alert">Unable to create activity: {createError}</p>}
        {successMessage && <p className="mt-3 mb-0" role="status">{successMessage}</p>}
      </form>

      <h3 className="h5">Activity history</h3>
      {isLoading && <p role="status">Loading activities, teams, and users…</p>}
      {loadErrorMessages.length > 0 && <p role="alert">{loadErrorMessages.join(' ')}</p>}
      {!isLoading && !loadError && users.length === 0 && <p role="status">No users available for activity selection.</p>}
      {!isLoading && !loadError && selectableTeams.length === 0 && <p role="status">No teams available for activity selection.</p>}
      {!isLoading && !loadError && activities.length === 0 && <p role="status">No activities yet.</p>}
      {!isLoading && !loadError && activities.length > 0 && (
        <>
          <p role="status">Activities loaded.</p>
          <ul className="list-group">
            {activities.map((activity, index) => {
              const team = teams.find((candidate) => candidate._id === activity.team);
              const user = users.find((candidate) => candidate._id === activity.user);
              return (
                <li className="list-group-item" key={activity._id ?? `${activity.type}-${index}`}>
                  <h4 className="h6 mb-1">{activity.type}</h4>
                  <p className="mb-1">Minutes: {activity.minutes} · Points: {activity.points}</p>
                  {(user || activity.user || team || activity.team) && (
                    <p className="mb-0">
                      User: {user?.name ?? activity.user ?? ''}
                      {team || activity.team ? ` · Team: ${team?.name ?? activity.team}` : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
