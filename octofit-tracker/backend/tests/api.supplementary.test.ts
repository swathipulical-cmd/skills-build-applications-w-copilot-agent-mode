import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Activity, Team, User, Workout } from '../src/models/index.js';

let mongo: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    Activity.deleteMany({}),
    Team.deleteMany({}),
    User.deleteMany({}),
    Workout.deleteMany({}),
  ]);
});

async function createUserAndTeam(
  name: string,
  email: string,
  mascot: string,
  teamName: string,
  fitnessGoal: string,
) {
  const team = await Team.create({ name: teamName, mascot, members: [] });
  const user = await User.create({ name, email, team: team._id, fitnessGoal });
  await Team.updateOne({ _id: team._id }, { $addToSet: { members: user._id } });
  return { user, team };
}

describe('Additional OctoFit API behavior', () => {
  it('lists only user IDs and names in name order', async () => {
    const zoe = await User.create({ name: 'Zoe', email: 'zoe@example.com', fitnessGoal: 'strength' });
    const alice = await User.create({ name: 'Alice', email: 'alice@example.com', fitnessGoal: 'endurance' });

    const response = await request(app).get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: [
        { _id: alice._id.toString(), name: 'Alice' },
        { _id: zoe._id.toString(), name: 'Zoe' },
      ],
    });
    for (const user of response.body.users) {
      expect(user).not.toHaveProperty('email');
      expect(user).not.toHaveProperty('fitnessGoal');
      expect(user).not.toHaveProperty('team');
    }
  });

  it('resolves workout suggestions by user ID and orders activity matches by recency', async () => {
    const mona = await createUserAndTeam(
      'Mona',
      'mona@example.com',
      'Mona',
      'Octocats',
      'endurance',
    );
    const hubot = await createUserAndTeam(
      'Hubot',
      'hubot@example.com',
      'Hubot',
      'Robocats',
      'strength',
    );
    await Activity.create([
      {
        user: mona.user._id,
        team: mona.team._id,
        type: 'run',
        minutes: 40,
        points: 40,
        occurredAt: new Date('2026-01-03T12:00:00.000Z'),
      },
      {
        user: hubot.user._id,
        team: hubot.team._id,
        type: 'run',
        minutes: 20,
        points: 20,
        occurredAt: new Date('2026-01-01T12:00:00.000Z'),
      },
      {
        user: hubot.user._id,
        team: hubot.team._id,
        type: 'cycle',
        minutes: 25,
        points: 25,
        occurredAt: new Date('2026-01-02T12:00:00.000Z'),
      },
    ]);
    await Workout.create([
      { title: 'Intervals', focus: 'endurance', minutes: 30, difficulty: 'moderate' },
      { title: 'Strength Circuit', focus: 'strength', minutes: 30, difficulty: 'moderate' },
      { title: 'Cycling Tempo', focus: 'cycle', minutes: 25, difficulty: 'moderate' },
      { title: 'Run Builder', focus: 'run', minutes: 20, difficulty: 'easy' },
    ]);

    const monaByEmail = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(monaByEmail.status).toBe(200);
    expect(monaByEmail.body.suggestions[0]).toMatchObject({
      title: 'Intervals',
      focus: 'endurance',
      reason: expect.stringMatching(/endurance|goal/i),
    });
    expect(monaByEmail.body.suggestions[1]).toMatchObject({
      title: 'Run Builder',
      focus: 'run',
      minutes: 20,
      difficulty: 'easy',
      reason: expect.stringMatching(/run|activity/i),
    });

    const monaById = await request(app).get(`/api/workouts/suggestions/by-user/${mona.user._id}`);
    expect(monaById.status).toBe(200);
    expect(monaById.body).toEqual(monaByEmail.body);

    const hubotByEmail = await request(app).get('/api/workouts/suggestions/hubot%40example.com');
    expect(hubotByEmail.status).toBe(200);
    expect(hubotByEmail.body.suggestions[0]).toMatchObject({
      title: 'Strength Circuit',
      focus: 'strength',
      reason: expect.stringMatching(/strength|goal/i),
    });
    expect(hubotByEmail.body.suggestions.slice(1).map(({ title }: { title: string }) => title)).toEqual([
      'Cycling Tempo',
      'Run Builder',
    ]);
    expect(hubotByEmail.body.suggestions[1].reason).toMatch(/cycle|activity/i);
    expect(hubotByEmail.body.suggestions[2].reason).toMatch(/run|activity/i);
  });

  it('returns deliberate errors for unknown users and malformed IDs', async () => {
    const unknownEmail = await request(app).get('/api/workouts/suggestions/nobody%40example.com');
    expect(unknownEmail.status).toBe(404);

    const malformedId = await request(app).get('/api/workouts/suggestions/by-user/not-an-id');
    expect(malformedId.status).toBe(400);

    const unknownId = await request(app).get(
      `/api/workouts/suggestions/by-user/${new mongoose.Types.ObjectId()}`,
    );
    expect(unknownId.status).toBe(404);
  });
});
