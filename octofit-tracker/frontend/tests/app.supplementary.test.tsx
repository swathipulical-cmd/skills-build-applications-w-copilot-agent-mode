import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.js';

function renderRoute(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

const userOption = { _id: 'user-1', name: 'Mona' };
const team = { _id: 'team-1', name: 'Octocats', mascot: 'Mona', members: ['user-1'] };
const activity = {
  _id: 'activity-1',
  user: 'user-1',
  team: 'team-1',
  type: 'run',
  minutes: 30,
  points: 30,
  occurredAt: '2026-01-01T12:00:00.000Z',
};
const suggestion = {
  _id: 'workout-1',
  title: 'Intervals',
  focus: 'endurance',
  minutes: 30,
  difficulty: 'moderate',
  reason: 'Matches the user’s endurance goal.',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Additional OctoFit presentation behavior', () => {
  it('populates user and team selectors without displaying user email', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/activities') return jsonResponse({ activities: [activity] });
      if (url === '/api/teams') return jsonResponse({ teams: [team] });
      if (url === '/api/users') {
        return jsonResponse({ users: [{ ...userOption, email: 'mona@example.com' }] });
      }
      return jsonResponse({ message: 'Not found' }, 404);
    }));
    renderRoute('/activities');

    expect(await screen.findByRole('option', { name: 'Octocats' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mona' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'User' })).toBeEnabled();
    expect(screen.queryByText(/mona@example\.com/i)).not.toBeInTheDocument();
  });

  it('creates a team and refreshes the team directory', async () => {
    const user = userEvent.setup();
    const createdTeam = { _id: 'team-new', name: 'Shells', mascot: 'Shelly', members: [] };
    let teams: typeof createdTeam[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/teams' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ name: 'Shells', mascot: 'Shelly' });
        teams = [createdTeam];
        return jsonResponse({ team: createdTeam }, 201);
      }
      if (String(input) === '/api/teams') return jsonResponse({ teams });
      return jsonResponse({ message: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/teams');

    await user.type(screen.getByRole('textbox', { name: 'Team name' }), 'Shells');
    await user.type(screen.getByRole('textbox', { name: 'Mascot' }), 'Shelly');
    await user.click(screen.getByRole('button', { name: 'Create team' }));

    expect(await screen.findByText('Team created successfully.')).toBeInTheDocument();
    expect(await screen.findByText('Shells')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url) === '/api/teams' && !init?.method)).toHaveLength(2);
  });

  it('creates an activity for the selected user and team, then refreshes history', async () => {
    const user = userEvent.setup();
    let activities: typeof activity[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/activities' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          userId: 'user-1',
          teamId: 'team-1',
          type: 'run',
          minutes: 30,
        });
        activities = [activity];
        return jsonResponse({ activity }, 201);
      }
      if (url === '/api/activities') return jsonResponse({ activities });
      if (url === '/api/teams') return jsonResponse({ teams: [team] });
      if (url === '/api/users') return jsonResponse({ users: [userOption] });
      return jsonResponse({ message: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/activities');

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Team' }), 'team-1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'User' }), 'user-1');
    await user.type(screen.getByRole('textbox', { name: 'Activity type' }), 'run');
    await user.type(screen.getByRole('spinbutton', { name: 'Minutes' }), '30');
    await user.click(screen.getByRole('button', { name: 'Create activity' }));

    expect(await screen.findByText('Activity created successfully.')).toBeInTheDocument();
    expect(await screen.findByText(/User: Mona · Team: Octocats/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url) === '/api/activities' && !init?.method)).toHaveLength(2);
  });

  it('loads workout suggestions through the selected user ID', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/users') return jsonResponse({ users: [userOption] });
      if (url === '/api/workouts/suggestions/by-user/user-1') {
        return jsonResponse({ suggestions: [suggestion] });
      }
      return jsonResponse({ message: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/workouts');

    await user.selectOptions(await screen.findByRole('combobox', { name: 'User' }), 'user-1');

    expect(await screen.findByRole('heading', { name: 'Intervals' })).toBeInTheDocument();
    expect(screen.getByText('Focus: endurance')).toBeInTheDocument();
    expect(screen.getByText('Duration: 30 minutes · Difficulty: moderate')).toBeInTheDocument();
    expect(screen.getByText(`Reason: ${suggestion.reason}`)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/workouts/suggestions/by-user/user-1', undefined);
  });

  it('does not show stale suggestions after a different user is selected', async () => {
    const user = userEvent.setup();
    const users = [
      userOption,
      { _id: 'user-2', name: 'Hubot' },
    ];
    let resolveMonaResponse: (response: Response) => void = () => {};
    const monaResponse = new Promise<Response>((resolve) => {
      resolveMonaResponse = resolve;
    });
    const hubotSuggestion = {
      ...suggestion,
      _id: 'workout-hubot',
      title: 'Hubot plan',
      focus: 'strength',
      reason: 'Matches the selected user.',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/users') return jsonResponse({ users });
      if (url === '/api/workouts/suggestions/by-user/user-1') return monaResponse;
      if (url === '/api/workouts/suggestions/by-user/user-2') {
        return jsonResponse({ suggestions: [hubotSuggestion] });
      }
      return jsonResponse({ message: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/workouts');
    const selector = await screen.findByRole('combobox', { name: 'User' });

    await user.selectOptions(selector, 'user-1');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/workouts/suggestions/by-user/user-1', undefined);
    });
    await user.selectOptions(selector, 'user-2');
    expect(await screen.findByRole('heading', { name: 'Hubot plan' })).toBeInTheDocument();

    resolveMonaResponse(jsonResponse({
      suggestions: [{
        ...suggestion,
        _id: 'workout-mona',
        title: 'Mona plan',
        reason: 'Stale suggestion.',
      }],
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('heading', { name: 'Mona plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hubot plan' })).toBeInTheDocument();
  });

  it('announces suggestion API errors for the selected user', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/users') return jsonResponse({ users: [userOption] });
      return jsonResponse({ message: 'Unavailable' }, 503);
    }));
    renderRoute('/workouts');

    await user.selectOptions(await screen.findByRole('combobox', { name: 'User' }), 'user-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load workout suggestions/i);
  });
});
