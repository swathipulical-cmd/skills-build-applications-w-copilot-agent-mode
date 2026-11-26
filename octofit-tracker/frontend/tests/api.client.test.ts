import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createActivity,
  createTeam,
  fetchLeaderboard,
  fetchWorkoutSuggestions,
  fetchWorkoutSuggestionsByUserId,
  listActivities,
  listTeams,
} from '../src/api/client.js';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shared API client', () => {
  it('uses the backend paths, request fields, and response wrappers', async () => {
    const team = { _id: 'team-id', name: 'Octocats', mascot: 'Mona', members: ['user-id'] };
    const activity = {
      _id: 'activity-id',
      user: 'user-id',
      team: 'team-id',
      type: 'run',
      minutes: 30,
      points: 30,
      occurredAt: '2026-01-01T12:00:00.000Z',
    };
    const leaderboard = [{ teamName: 'Octocats', totalPoints: 30, rank: 1 }];
    const suggestion = { _id: 'workout-id', title: 'Intervals', focus: 'run', minutes: 30, difficulty: 'moderate', reason: 'Matches your activity.' };
    const responses = [
      { teams: [team] },
      { team },
      { activities: [activity] },
      { activity },
      { leaderboard },
      { suggestions: [suggestion] },
      { suggestions: [suggestion] },
    ];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(responses.shift()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeams()).resolves.toEqual([team]);
    await expect(createTeam({ name: team.name, mascot: team.mascot, members: team.members })).resolves.toEqual(team);
    await expect(listActivities()).resolves.toEqual([activity]);
    await expect(createActivity({ userId: 'user-id', teamId: 'team-id', type: 'run', minutes: 30 })).resolves.toEqual(activity);
    await expect(fetchLeaderboard()).resolves.toEqual(leaderboard);
    await expect(fetchWorkoutSuggestions('student@example.com')).resolves.toEqual([suggestion]);
    await expect(fetchWorkoutSuggestionsByUserId('user-id')).resolves.toEqual([suggestion]);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/teams',
      '/api/teams',
      '/api/activities',
      '/api/activities',
      '/api/leaderboard',
      '/api/workouts/suggestions/student%40example.com',
      '/api/workouts/suggestions/by-user/user-id',
    ]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: team.name, mascot: team.mascot, members: team.members }),
    });
    expect(fetchMock.mock.calls[3][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-id', teamId: 'team-id', type: 'run', minutes: 30 }),
    });
  });

  it('surfaces HTTP failures, invalid JSON, and invalid response shapes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Unavailable' }, 503)));
    await expect(listTeams()).rejects.toThrow('Request failed with 503');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json')));
    await expect(listTeams()).rejects.toThrow('Invalid JSON response from /api/teams');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ teams: [{}] })));
    await expect(listTeams()).rejects.toThrow('Invalid API response: "teams[0]" has an invalid shape.');
  });
});
