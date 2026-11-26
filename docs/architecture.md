# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| User selection | `GET /api/users` | Return `{ users: [{ _id, name }] }`, ordered by name. Do not include email, fitness goal, team, or other user fields. |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/by-user/:userId`, `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the selected user. The ID-based route accepts a valid user ID and resolves the user server-side without exposing email; malformed IDs return `400` and unknown users return `404`. The existing email-based route remains supported. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. |

## Implementation decisions

These decisions keep presentation, application logic, and persistence responsibilities separate while documenting the current implementation.

- Presentation tier decision: Use React components for rendering and interaction, with the shared API client responsible for `/api` requests and response validation. The Vite proxy forwards relative API paths to the Express service. For user selection, load only user IDs and names, keep the selected ID in the interface, and submit IDs rather than exposing email addresses.
- Logic tier decision: Keep Express route handlers focused on HTTP request and response handling; put input validation, lookup, and application behavior in TypeScript service functions. Return deliberate client errors for invalid or unknown references instead of exposing database cast failures as server errors.
- Data tier decision: Use Mongoose models for the User, Team, Activity, and Workout records and their required-field validation. Seed stable demo records with upserts so repeated runs are idempotent and existing unrelated records are preserved.
- Activity tracking approach: Accept a user ID, team ID, activity type, and finite minutes; validate the input and confirm both referenced records exist before creating the activity. Store the references and activity details, calculate points from minutes, and set the occurrence time on the server.
- Team management approach: List teams from the data tier and create teams through the service layer after validating the name, mascot, and any member IDs. Keep member relationships in the Team model.
- Leaderboard approach: Sum recorded activity points by team, order teams by total points from highest to lowest, and add 1-based ranks to the response.
- Workout suggestions approach: Preserve the email-based suggestions route from the original contract and support the selected-user-ID route used by the interface. Resolve the user server-side, rank workouts matching the user's fitness goal before matches to their activities (newest activity first), and include a reason for each suggestion without changing the Workout schema.

## Test plan

Run the backend and frontend suites and builds from the repository root. The results below are the current baseline for this working tree.

- Backend suite: `npm test --prefix octofit-tracker/backend` — **10/10 tests passed** across the data and API contract suites. The data suite checks model validation and idempotent seeding without losing unrelated records; the API suite checks endpoint responses, valid and invalid input, leaderboard ordering, and workout suggestions. A failure points to a persistence/model/seed invariant or an API/service contract, respectively.
- Data-only suite: `npm run test:data --prefix octofit-tracker/backend` — checks required model fields and seed behavior, including repeatability and preservation of unrelated records. Failures indicate a schema or seed-data regression.
- API-only suite: `npm run test:api --prefix octofit-tracker/backend` — checks the user, activity, team, leaderboard, and workout-suggestion endpoints, including invalid references. Failures indicate a route, service, response-shape, or validation regression.
- Frontend suite: `npm test --prefix octofit-tracker/frontend` — **24/24 tests passed**. It checks API-client requests and response/error handling, component rendering and accessible loading/empty/error states, and user interactions for activities, teams, leaderboard, and workout suggestions. Failures indicate a client or presentation behavior regression.
- Backend build: `npm run build --prefix octofit-tracker/backend` — **passed** (`tsc --noEmit`). A failure indicates a backend TypeScript type-check error.
- Frontend build: `npm run build --prefix octofit-tracker/frontend` — **passed** (TypeScript check and Vite production build). A failure indicates a frontend type-check or production-bundling error.
