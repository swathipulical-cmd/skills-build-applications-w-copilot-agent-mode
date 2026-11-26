export interface User {
  _id: string;
  name: string;
  email: string;
  team?: string | null;
  fitnessGoal: string;
}

export interface UserOption {
  _id: string;
  name: string;
}

export interface Team {
  _id: string;
  name: string;
  mascot: string;
  members: string[];
}

export interface TeamSummary {
  _id?: string;
  name: string;
  mascot?: string;
  members?: string[];
}

export interface Activity {
  _id: string;
  user: string;
  team: string;
  type: string;
  minutes: number;
  points: number;
  occurredAt: string;
}

export interface ActivitySummary {
  _id?: string;
  user?: string;
  team?: string;
  type: string;
  minutes: number;
  points: number;
  occurredAt?: string;
}

export interface Workout {
  _id: string;
  title: string;
  focus: string;
  minutes: number;
  difficulty: string;
}

export interface WorkoutSuggestion extends Workout {
  reason: string;
}

export interface WorkoutSuggestionSummary {
  _id?: string;
  title: string;
  focus?: string;
  minutes?: number;
  difficulty?: string;
  reason: string;
}

export interface LeaderboardEntry {
  teamName: string;
  totalPoints: number;
  rank: number;
}

export interface CreateTeamInput {
  name: string;
  mascot: string;
  members?: string[];
}

export interface CreateActivityInput {
  userId: string;
  teamId: string;
  type: string;
  minutes: number;
}
