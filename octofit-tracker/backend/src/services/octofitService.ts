import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function listUsers() {
  return User.find().select('_id name').sort({ name: 1, _id: 1 }).lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) {
    throw httpError(400, 'Activity body must be a JSON object.');
  }

  const { userId, teamId, type, minutes } = input;
  if (typeof userId !== 'string' || typeof teamId !== 'string' || typeof type !== 'string' || !type || typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    throw httpError(400, 'Activity requires userId, teamId, a non-empty type, and finite minutes.');
  }
  if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(teamId)) {
    throw httpError(400, 'Activity userId and teamId must be valid IDs.');
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: userId }),
    Team.exists({ _id: teamId }),
  ]);
  if (!user || !team) {
    throw httpError(404, 'Activity user or team was not found.');
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type,
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) {
    throw httpError(400, 'Team body must be a JSON object.');
  }

  const { name, mascot, members } = input;
  if (typeof name !== 'string' || !name.trim()) {
    throw httpError(400, 'Team name is required.');
  }
  if (typeof mascot !== 'string' || !mascot.trim()) {
    throw httpError(400, 'Team mascot is required.');
  }
  if (members !== undefined && !Array.isArray(members)) {
    throw httpError(400, 'Team members must be an array.');
  }

  const memberIds = members ?? [];
  if (!memberIds.every((memberId) => typeof memberId === 'string' && mongoose.isObjectIdOrHexString(memberId))) {
    throw httpError(400, 'Team member IDs must be valid IDs.');
  }

  if (memberIds.length > 0) {
    const uniqueMemberIds = [...new Set(memberIds as string[])];
    const existingUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select('_id').lean();
    if (existingUsers.length !== uniqueMemberIds.length) {
      throw httpError(404, 'One or more team members were not found.');
    }
  }

  return Team.create({
    name,
    mascot,
    members: memberIds,
  });
}

export async function getLeaderboard() {
  const activities = await Activity.find().lean();
  const pointsByTeam = new Map<string, number>();

  for (const activity of activities) {
    const teamId = activity.team.toString();
    pointsByTeam.set(teamId, (pointsByTeam.get(teamId) ?? 0) + activity.points);
  }

  const teams = await Team.find({ _id: { $in: [...pointsByTeam.keys()] } }).select('_id name').lean();
  return teams
    .flatMap((team) => {
      const totalPoints = pointsByTeam.get(team._id.toString());
      return totalPoints === undefined ? [] : [{ teamName: team.name, totalPoints }];
    })
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function suggestWorkoutsForUser(userId: mongoose.Types.ObjectId, fitnessGoal: string) {
  const [activities, workouts] = await Promise.all([
    Activity.find({ user: userId }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const matchingWorkouts = workouts.flatMap((workout) => {
    if (workout.focus === fitnessGoal) {
      return [{ workout, reason: `Matches your ${fitnessGoal} fitness goal.`, goalMatch: true, activityIndex: -1 }];
    }

    const activityIndex = activities.findIndex((activity) => activity.type === workout.focus);
    if (activityIndex === -1) {
      return [];
    }

    return [{
      workout,
      reason: `Matches your recent ${activities[activityIndex].type} activity.`,
      goalMatch: false,
      activityIndex,
    }];
  });

  return matchingWorkouts
    .sort((left, right) => Number(right.goalMatch) - Number(left.goalMatch) || left.activityIndex - right.activityIndex)
    .map(({ workout, reason }) => ({ ...workout, reason }));
}

export async function suggestWorkoutsByUserId(userId: string) {
  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw httpError(400, 'User ID must be a valid ID.');
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    throw httpError(404, 'User was not found.');
  }

  return suggestWorkoutsForUser(user._id, user.fitnessGoal);
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw httpError(404, 'User was not found.');
  }

  return suggestWorkoutsForUser(user._id, user.fitnessGoal);
}

export { User };
