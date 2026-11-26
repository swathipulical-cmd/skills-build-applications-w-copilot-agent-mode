import type {
  Activity,
  ActivitySummary,
  CreateActivityInput,
  CreateTeamInput,
  LeaderboardEntry,
  Team,
  TeamSummary,
  UserOption,
  Workout,
  WorkoutSuggestion,
  WorkoutSuggestionSummary,
} from './types.js';

// Relative /api paths go through the Vite dev proxy, so port 8000 never needs to be public.
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function readJsonResponse<T>(path: string, response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);

  try {
    return await response.json() as T;
  } catch (error) {
    throw new Error(`Invalid JSON response from ${path}`, { cause: error });
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  return readJsonResponse(path, await fetch(url, init));
}

async function requestLegacyEmailJson<T>(path: string): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  return readJsonResponse(path, await fetch(url));
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isTeam(value: unknown): value is Team {
  return isRecord(value)
    && isString(value._id)
    && isString(value.name)
    && isString(value.mascot)
    && isStringArray(value.members);
}

function isTeamSummary(value: unknown): value is TeamSummary {
  return isRecord(value)
    && isString(value.name)
    && (!('_id' in value) || isString(value._id))
    && (!('mascot' in value) || isString(value.mascot))
    && (!('members' in value) || isStringArray(value.members))
    && (!('_id' in value) || (isString(value.mascot) && isStringArray(value.members)));
}

function isUserOption(value: unknown): value is UserOption {
  return isRecord(value) && isString(value._id) && isString(value.name);
}

function isOptionalDateString(value: Record<string, unknown>, key: string): boolean {
  const date = value[key];
  return !(key in value) || (isString(date) && Number.isFinite(Date.parse(date)));
}

function isActivity(value: unknown): value is Activity {
  return isRecord(value)
    && isString(value._id)
    && isString(value.user)
    && isString(value.team)
    && isString(value.type)
    && isFiniteNumber(value.minutes)
    && isFiniteNumber(value.points)
    && isString(value.occurredAt)
    && Number.isFinite(Date.parse(value.occurredAt));
}

function isActivitySummary(value: unknown): value is ActivitySummary {
  return isRecord(value)
    && isString(value.type)
    && isFiniteNumber(value.minutes)
    && isFiniteNumber(value.points)
    && (!('_id' in value) || isString(value._id))
    && (!('user' in value) || isString(value.user))
    && (!('team' in value) || isString(value.team))
    && isOptionalDateString(value, 'occurredAt')
    && (!('_id' in value) || (
      isString(value._id)
      && isString(value.user)
      && isString(value.team)
      && isOptionalDateString(value, 'occurredAt')
    ));
}

function isWorkout(value: unknown): value is Workout {
  return isRecord(value)
    && isString(value._id)
    && isString(value.title)
    && isString(value.focus)
    && isFiniteNumber(value.minutes)
    && isString(value.difficulty);
}

function isWorkoutSuggestion(value: unknown): value is WorkoutSuggestion {
  return isRecord(value) && isString(value.reason) && isWorkout(value);
}

function isWorkoutSuggestionSummary(value: unknown): value is WorkoutSuggestionSummary {
  return isRecord(value)
    && isString(value.title)
    && isString(value.reason)
    && (!('_id' in value) || isString(value._id))
    && (!('focus' in value) || isString(value.focus))
    && (!('minutes' in value) || isFiniteNumber(value.minutes))
    && (!('difficulty' in value) || isString(value.difficulty))
    && (!('_id' in value) || isWorkout(value));
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  return isRecord(value)
    && isString(value.teamName)
    && isFiniteNumber(value.totalPoints)
    && typeof value.rank === 'number'
    && Number.isInteger(value.rank)
    && value.rank > 0;
}

function readArrayEnvelope<T>(
  payload: unknown,
  key: string,
  isItem: (value: unknown) => value is T,
): T[] {
  if (!isRecord(payload) || !Array.isArray(payload[key])) {
    throw new Error(`Invalid API response: expected "${key}" array.`);
  }

  return payload[key].map((item, index) => {
    if (!isItem(item)) {
      throw new Error(`Invalid API response: "${key}[${index}]" has an invalid shape.`);
    }
    return item;
  });
}

export function readActivitiesResponse(payload: unknown): ActivitySummary[] {
  return readArrayEnvelope(payload, 'activities', isActivitySummary);
}

export function readTeamsResponse(payload: unknown): TeamSummary[] {
  return readArrayEnvelope(payload, 'teams', isTeamSummary);
}

export function readUsersResponse(payload: unknown): UserOption[] {
  return readArrayEnvelope(payload, 'users', isUserOption);
}

export function readLeaderboardResponse(payload: unknown): LeaderboardEntry[] {
  return readArrayEnvelope(payload, 'leaderboard', isLeaderboardEntry);
}

export function readWorkoutSuggestionsResponse(payload: unknown): WorkoutSuggestionSummary[] {
  return readArrayEnvelope(payload, 'suggestions', isWorkoutSuggestionSummary);
}

function readObjectEnvelope<T>(
  payload: unknown,
  key: string,
  isItem: (value: unknown) => value is T,
): T {
  if (!isRecord(payload) || !isItem(payload[key])) {
    throw new Error(`Invalid API response: expected "${key}" object.`);
  }
  return payload[key];
}

export async function listTeams(): Promise<TeamSummary[]> {
  return readTeamsResponse(await getJson<unknown>('/api/teams'));
}

export async function listUsers(): Promise<UserOption[]> {
  return readUsersResponse(await getJson<unknown>('/api/users'));
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  return readObjectEnvelope(await postJson<unknown>('/api/teams', input), 'team', isTeam);
}

export async function listActivities(): Promise<ActivitySummary[]> {
  return readActivitiesResponse(await getJson<unknown>('/api/activities'));
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  return readObjectEnvelope(await postJson<unknown>('/api/activities', input), 'activity', isActivity);
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return readArrayEnvelope(await getJson<unknown>('/api/leaderboard'), 'leaderboard', isLeaderboardEntry);
}

export async function fetchWorkoutSuggestions(userEmail: string): Promise<WorkoutSuggestionSummary[]> {
  return readWorkoutSuggestionsResponse(
    await requestLegacyEmailJson<unknown>(
      `/api/workouts/suggestions/${encodeURIComponent(userEmail)}`,
    ),
  );
}

export async function fetchWorkoutSuggestionsByUserId(userId: string): Promise<WorkoutSuggestionSummary[]> {
  return readWorkoutSuggestionsResponse(
    await getJson<unknown>(`/api/workouts/suggestions/by-user/${encodeURIComponent(userId)}`),
  );
}
