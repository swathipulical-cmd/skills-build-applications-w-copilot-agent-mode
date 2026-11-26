import { useEffect, useState } from 'react';
import {
  fetchWorkoutSuggestions,
  fetchWorkoutSuggestionsByUserId,
  getJson,
  readUsersResponse,
} from '../api/client.js';
import type { UserOption, WorkoutSuggestionSummary } from '../api/types.js';

const legacyDefaultUserEmail = 'mona@example.com';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function Workouts() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [suggestions, setSuggestions] = useState<WorkoutSuggestionSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [suggestionsError, setSuggestionsError] = useState('');
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        setUsers(readUsersResponse(await getJson<unknown>('/api/users')));
      } catch (error) {
        setUsersError(errorMessage(error));
        setIsLegacyMode(true);
        setIsLoadingSuggestions(true);
        try {
          setSuggestions(await fetchWorkoutSuggestions(legacyDefaultUserEmail));
        } catch (suggestionsError) {
          setSuggestionsError(errorMessage(suggestionsError));
        } finally {
          setIsLoadingSuggestions(false);
        }
      } finally {
        setIsLoadingUsers(false);
      }
    }

    void loadUsers();
  }, []);

  useEffect(() => {
    let isCurrentSelection = true;
    setSuggestions([]);
    setSuggestionsError('');

    if (!selectedUserId) {
      setIsLoadingSuggestions(false);
      return () => {
        isCurrentSelection = false;
      };
    }

    setIsLoadingSuggestions(true);
    async function loadSuggestions() {
      try {
        const loadedSuggestions = await fetchWorkoutSuggestionsByUserId(selectedUserId);
        if (isCurrentSelection) setSuggestions(loadedSuggestions);
      } catch (error) {
        if (isCurrentSelection) setSuggestionsError(errorMessage(error));
      } finally {
        if (isCurrentSelection) setIsLoadingSuggestions(false);
      }
    }

    void loadSuggestions();
    return () => {
      isCurrentSelection = false;
    };
  }, [selectedUserId]);

  function handleUserChange(userId: string) {
    setSelectedUserId(userId);
    setIsLegacyMode(false);
    setSuggestions([]);
    setSuggestionsError('');
    setIsLoadingSuggestions(Boolean(userId));
  }

  const hasSuggestionContext = Boolean(selectedUserId) || isLegacyMode;
  const loadErrorMessages = [
    usersError && `Unable to load users: ${usersError}`,
    suggestionsError && `Unable to load workout suggestions: ${suggestionsError}`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="workouts-heading">
      <h2 id="workouts-heading">Workout suggestions</h2>
      <div className="mb-4">
        <label className="form-label" htmlFor="workout-user">User</label>
        <select
          className="form-select"
          disabled={isLoadingUsers || Boolean(usersError) || users.length === 0}
          id="workout-user"
          onChange={(event) => handleUserChange(event.target.value)}
          value={selectedUserId}
        >
          <option value="">{users.length === 0 ? 'No users available' : 'Select a user'}</option>
          {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
        </select>
      </div>

      {isLoadingUsers && <p role="status">Loading users…</p>}
      {loadErrorMessages.length > 0 && <p role="alert">{loadErrorMessages.join(' ')}</p>}
      {!isLoadingUsers && !usersError && users.length === 0 && (
        <p role="status">No users available for workout suggestions.</p>
      )}
      {!isLoadingUsers && !usersError && users.length > 0 && !selectedUserId && (
        <p role="status">Select a user to view workout suggestions.</p>
      )}
      {hasSuggestionContext && isLoadingSuggestions && <p role="status">Loading workout suggestions…</p>}
      {hasSuggestionContext && !isLoadingSuggestions && !suggestionsError && suggestions.length === 0 && (
        <p role="status">No workout suggestions for this user.</p>
      )}
      {hasSuggestionContext && !isLoadingSuggestions && !suggestionsError && suggestions.length > 0 && (
        <ul className="list-group">
          {suggestions.map((suggestion, index) => (
            <li className="list-group-item" key={suggestion._id ?? `${suggestion.title}-${index}`}>
              <h3 className="h5">{suggestion.title}</h3>
              {suggestion.focus && <p className="mb-1">Focus: {suggestion.focus}</p>}
              {(suggestion.minutes !== undefined || suggestion.difficulty) && (
                <p className="mb-1">
                  {suggestion.minutes !== undefined && `Duration: ${suggestion.minutes} minutes`}
                  {suggestion.minutes !== undefined && suggestion.difficulty && ' · '}
                  {suggestion.difficulty && `Difficulty: ${suggestion.difficulty}`}
                </p>
              )}
              <p className="mb-0">Reason: {suggestion.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
