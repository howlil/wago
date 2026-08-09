# AGENTS.md

## Project Overview

This repository is a lightweight WhatsApp Gateway built with Baileys.

The project goal is to provide a small standalone service that can:

1. Connect a WhatsApp account using QR authentication.
2. Persist the WhatsApp session across application restarts.
3. Expose the WhatsApp connection status through an HTTP API.
4. Send text messages through an HTTP API.
5. Later expose these capabilities through a simple web frontend.

The project must prioritize:

* fast development
* simple architecture
* readable code
* predictable behavior
* minimal dependencies
* maintainability
* clear separation of responsibilities

This is an MVP.

Do not design this project as a large SaaS platform unless the requirements explicitly change.

---

# 1. Core Engineering Philosophy

Always prefer the simplest implementation that correctly solves the current problem.

Follow this priority order:

1. Correctness
2. Simplicity
3. Readability
4. Maintainability
5. Developer experience
6. Performance
7. Extensibility

Do not optimize for hypothetical future requirements.

Avoid premature abstraction.

Avoid unnecessary infrastructure.

Avoid introducing architectural patterns simply because they are considered "enterprise best practices".

The code should remain understandable by one developer reading the repository without additional documentation.

A good implementation should make it obvious:

* where WhatsApp connects
* where the session is stored
* where messages are sent
* where API routes are defined
* how errors are handled

---

# 2. Project Scope

## Current MVP Scope

The backend must support:

* WhatsApp QR authentication
* persistent WhatsApp authentication/session
* automatic reconnection when reasonable
* connection status
* send text message
* health endpoint
* basic input validation
* consistent HTTP responses
* graceful error handling
* Docker deployment

Expected endpoints:

```text
GET  /health
GET  /whatsapp/status
GET  /whatsapp/qr
POST /messages/send
```

The exact route naming may evolve slightly if there is a clear reason.

Do not introduce unnecessary API versioning during the initial MVP unless explicitly requested.

---

# 3. Explicitly Out of Scope

Do not implement the following unless explicitly requested:

* multi-user authentication
* multi-tenant architecture
* multi-session WhatsApp accounts
* PostgreSQL
* MySQL
* MongoDB
* Redis
* BullMQ
* Kafka
* RabbitMQ
* background workers
* Kubernetes
* service mesh
* event sourcing
* CQRS
* domain-driven design infrastructure
* repository pattern
* dependency injection framework
* complex message queues
* analytics
* campaign management
* broadcast management
* CRM functionality
* contact synchronization
* group management
* billing
* subscription management
* OAuth
* elaborate RBAC
* message history database
* microservices
* distributed state
* distributed locking
* observability platforms
* custom metrics infrastructure

Do not implement abstractions for these features "for future use".

Build them only when an actual requirement exists.

---

# 4. Technology Stack

## Backend

Use:

* Node.js
* TypeScript
* Express
* Baileys
* filesystem-based Baileys authentication state
* Docker

Additional small dependencies are acceptable when they solve a real problem.

Examples:

* `qrcode` if QR images need to be generated
* `cors` when the frontend starts consuming the backend
* a small validation library if validation becomes sufficiently complex

Do not introduce a dependency when plain TypeScript or Express can solve the problem clearly.

---

## Frontend

Frontend implementation comes after the backend API works independently.

Preferred frontend stack:

* React
* Vite
* TypeScript
* native `fetch`

Do not introduce frontend state-management libraries during the initial MVP unless there is a demonstrated need.

Avoid:

* Redux
* Zustand
* TanStack Query
* large component libraries

unless the application complexity later justifies them.

---

# 5. Development Order

Agents must work backend-first.

The preferred implementation order is:

```text
1. Express server
2. Health endpoint
3. Baileys connection
4. QR authentication
5. Persistent authentication state
6. Reconnection handling
7. Connection status API
8. Send-message implementation
9. Send-message API
10. API validation and error handling
11. Docker
12. Backend verification
13. Frontend
```

Do not start building the frontend before the core backend can be verified independently.

The backend must be testable through:

```bash
curl
```

or another HTTP client without requiring the frontend.

---

# 6. Recommended Repository Structure

Keep the project structure shallow.

Recommended initial structure:

```text
wa-gateway/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── whatsapp.ts
│   │   ├── routes/
│   │   │   ├── whatsapp.routes.ts
│   │   │   └── message.routes.ts
│   │   └── utils/
│   │       └── phone.ts
│   │
│   ├── data/
│   │   └── auth/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   └── ...
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

This is a recommendation, not a rigid architecture.

Do not create directories containing only one trivial file unless they improve clarity.

Do not create structures like:

```text
controllers/
services/
repositories/
use-cases/
domain/
entities/
interfaces/
adapters/
ports/
infrastructure/
```

for a simple four-endpoint application.

Introduce additional layers only when the code actually becomes difficult to manage without them.

---

# 7. Backend Responsibilities

## `index.ts`

`index.ts` should primarily:

* initialize Express
* configure middleware
* initialize WhatsApp
* register routes
* start the HTTP server
* handle startup failures

Avoid implementing significant business logic directly inside `index.ts`.

Example responsibility:

```ts
const app = express();

app.use(express.json());

app.use("/whatsapp", whatsappRouter);
app.use("/messages", messageRouter);

await initializeWhatsApp();

app.listen(PORT);
```

Keep the application bootstrap obvious.

---

# 8. WhatsApp Module

The WhatsApp integration is the core of the application.

Prefer one dedicated module such as:

```text
src/whatsapp.ts
```

during the MVP.

It should own:

* Baileys socket
* authentication state
* QR state
* connection state
* reconnect behavior
* message sending

Expose a small public API.

For example:

```ts
initializeWhatsApp()
getWhatsAppStatus()
getCurrentQr()
sendTextMessage()
```

Avoid exposing the raw Baileys socket throughout the application.

Routes should not directly manipulate Baileys internals.

Bad:

```ts
app.post("/messages/send", async (req, res) => {
  await sock.sendMessage(...);
});
```

Preferred:

```ts
app.post("/messages/send", async (req, res) => {
  const result = await sendTextMessage(to, text);
});
```

This is enough abstraction for the MVP.

Do not introduce interfaces, factories, repositories, or dependency injection merely to wrap Baileys.

---

# 9. WhatsApp State

Keep WhatsApp connection state simple and explicit.

A basic implementation may maintain:

```ts
let socket: WASocket | null = null;
let currentQr: string | null = null;
let connectionStatus:
  | "connecting"
  | "qr"
  | "connected"
  | "disconnected" = "disconnected";
```

Use more complex state only when necessary.

Avoid maintaining multiple duplicated status variables representing essentially the same state.

---

# 10. Authentication Persistence

Use Baileys filesystem authentication for the MVP.

Example:

```ts
useMultiFileAuthState("./data/auth");
```

Authentication data must survive process and Docker container restarts.

When using Docker, mount the authentication directory as persistent storage.

Example concept:

```yaml
volumes:
  - ./backend/data/auth:/app/data/auth
```

Never commit WhatsApp authentication data to Git.

Ensure:

```text
data/auth/
```

is ignored by `.gitignore`.

Treat authentication files as credentials.

---

# 11. QR Handling

QR authentication must be exposed independently from terminal output.

The backend should maintain the latest valid QR state.

Possible API:

```text
GET /whatsapp/qr
```

Example response when a QR is available:

```json
{
  "success": true,
  "qr": "..."
}
```

When the account is already connected:

```json
{
  "success": true,
  "qr": null,
  "status": "connected"
}
```

Do not continually regenerate QR codes yourself.

Follow the QR lifecycle emitted by Baileys.

Clear stale QR state after a successful connection.

---

# 12. Connection Status

Expose a clear status endpoint.

Example:

```text
GET /whatsapp/status
```

Example:

```json
{
  "success": true,
  "status": "connected"
}
```

Possible statuses should remain small and understandable.

Recommended:

```text
connecting
qr
connected
disconnected
```

Do not expose raw Baileys connection objects through the public API.

Translate internal library state into application-level state.

---

# 13. Reconnection

Handle unexpected WhatsApp disconnections pragmatically.

When a recoverable connection closes:

* clean up the old socket if necessary
* reconnect
* preserve authentication state

Do not create uncontrolled reconnect loops.

Avoid multiple sockets reconnecting simultaneously.

Maintain one active connection attempt.

If WhatsApp explicitly logs the device out, do not endlessly reconnect using invalid credentials.

Log the logout state clearly.

Do not automatically delete credentials unless the intended behavior is clearly defined.

---

# 14. Sending Messages

The primary MVP operation is sending text messages.

API:

```text
POST /messages/send
```

Request:

```json
{
  "to": "6285373945490",
  "text": "Hello"
}
```

Example successful response:

```json
{
  "success": true,
  "messageId": "3EB0..."
}
```

The route should:

1. validate input
2. normalize the phone number
3. confirm WhatsApp is connected
4. call the WhatsApp send function
5. return a useful response

Do not put WhatsApp protocol details inside the route.

---

# 15. Phone Number Normalization

Create one small normalization helper.

Example:

```text
src/utils/phone.ts
```

The API should primarily expect international phone numbers.

For Indonesian numbers, it is reasonable to support:

```text
081365630011
```

and normalize it to:

```text
6281365630011
```

Rules should remain explicit.

Example logic:

```text
remove spaces
remove "-"
remove "+"
if starts with 0:
    replace leading 0 with 62
```

Do not create a comprehensive international telephone validation engine for the MVP.

Do not silently perform ambiguous conversions.

The resulting WhatsApp JID may be constructed as:

```ts
`${normalizedPhone}@s.whatsapp.net`
```

where appropriate for the current Baileys version.

---

# 16. Input Validation

Validate required API input.

For send-message:

```text
to:
- required
- string
- non-empty

text:
- required
- string
- non-empty
```

Reject invalid requests with HTTP `400`.

Do not overbuild validation.

If validation remains simple, manual validation is acceptable.

Example:

```ts
if (
  typeof to !== "string" ||
  typeof text !== "string" ||
  !to.trim() ||
  !text.trim()
) {
  return res.status(400).json({
    success: false,
    error: "INVALID_REQUEST",
    message: "to and text are required"
  });
}
```

A validation library may be introduced later if the number of request schemas grows.

---

# 17. API Response Convention

Keep HTTP responses consistent.

Success example:

```json
{
  "success": true,
  "data": {}
}
```

or for a very simple endpoint:

```json
{
  "success": true,
  "messageId": "..."
}
```

Failure example:

```json
{
  "success": false,
  "error": "WHATSAPP_NOT_CONNECTED",
  "message": "WhatsApp is not connected"
}
```

Do not expose stack traces to API clients.

---

# 18. HTTP Status Codes

Use standard status codes pragmatically.

Recommended:

```text
200 OK
201 Created
400 Bad Request
404 Not Found
409 Conflict
500 Internal Server Error
503 Service Unavailable
```

For example, sending a message when WhatsApp is unavailable may return:

```text
503 Service Unavailable
```

with:

```json
{
  "success": false,
  "error": "WHATSAPP_NOT_CONNECTED",
  "message": "WhatsApp is not connected"
}
```

Do not invent unnecessary status code semantics.

---

# 19. Error Handling

Errors must be useful to developers.

Log internal errors with sufficient context.

Return sanitized errors to API clients.

Bad:

```ts
catch {
  res.status(500).send("error");
}
```

Better:

```ts
catch (error) {
  console.error("Failed to send WhatsApp message", error);

  res.status(500).json({
    success: false,
    error: "MESSAGE_SEND_FAILED",
    message: "Failed to send WhatsApp message"
  });
}
```

Do not catch errors only to immediately rethrow them without adding value.

Do not hide failures.

---

# 20. Logging

Use simple structured or readable logs.

For the MVP, `console.log`, `console.warn`, and `console.error` are acceptable.

Do not introduce an observability platform.

Important events to log:

```text
server started
WhatsApp initialization started
QR received
WhatsApp connected
WhatsApp disconnected
WhatsApp logged out
reconnect attempt
message send success
message send failure
```

Never log:

* authentication keys
* session credentials
* tokens
* full sensitive payloads unnecessarily

Avoid excessive logging for every internal Baileys event.

---

# 21. Clean Code Rules

Code should be optimized for reading.

Prefer:

```ts
const normalizedPhone = normalizePhone(to);
const result = await sendTextMessage(normalizedPhone, text);
```

over dense one-line logic.

Use descriptive variable names.

Bad:

```ts
const x = req.body.t;
```

Better:

```ts
const phoneNumber = req.body.to;
```

Functions should generally have one obvious responsibility.

Do not split functions purely to satisfy arbitrary line-count rules.

A 30-line readable function is better than six meaningless wrappers.

---

# 22. Function Design

Prefer small public APIs.

Example WhatsApp module:

```ts
export async function initializeWhatsApp() {}

export function getWhatsAppStatus() {}

export function getCurrentQr() {}

export async function sendTextMessage(
  phoneNumber: string,
  text: string
) {}
```

Keep implementation details private where possible.

Do not export internal values unnecessarily.

---

# 23. TypeScript Rules

Use TypeScript properly.

Avoid:

```ts
any
```

unless integrating with an external API where the type genuinely cannot reasonably be known.

Prefer inference where TypeScript already knows the type.

Do not add explicit types everywhere merely for visual complexity.

Good:

```ts
const port = Number(process.env.PORT ?? 3000);
```

Avoid unnecessary constructs such as:

```ts
const port: number = Number(process.env.PORT ?? 3000);
```

when inference is clear.

Use interfaces or type aliases when they improve comprehension.

Do not build an elaborate internal type system for four API endpoints.

---

# 24. Dependency Policy

Before installing a dependency, ask:

```text
Can this be solved clearly in less than ~20 lines of code?
```

If yes, prefer implementing it directly unless the dependency substantially improves correctness.

Good dependency:

```text
Baileys
Express
```

Potentially useful later:

```text
cors
qrcode
```

Avoid adding packages merely for:

* generating random IDs
* checking whether a string is empty
* basic object manipulation
* simple HTTP response helpers
* trivial date formatting

Keep the dependency surface small.

---

# 25. Configuration

Use environment variables only for deployment configuration.

Possible `.env`:

```env
PORT=3000
HOST=0.0.0.0
```

Potential future variables:

```env
API_KEY=
CORS_ORIGIN=
```

Do not put normal application constants into environment variables.

Do not create dozens of configuration options during the MVP.

Provide:

```text
.env.example
```

without secrets.

---

# 26. Security

This service controls a real WhatsApp session.

Treat it as sensitive infrastructure.

At minimum:

* never commit WhatsApp session files
* never expose the gateway publicly without access controls
* validate input
* do not expose raw Baileys state
* do not expose authentication credentials
* do not log credentials

For local development, unauthenticated API access is acceptable.

Before exposing the service publicly, add a simple API key.

A pragmatic API key mechanism is sufficient.

Example:

```http
Authorization: Bearer <API_KEY>
```

Do not implement OAuth, JWT authentication, RBAC, or user accounts unless the service actually needs them.

---

# 27. Health Endpoint

Provide:

```text
GET /health
```

This endpoint checks the backend process, not WhatsApp connectivity.

Example:

```json
{
  "status": "ok"
}
```

Do not make `/health` fail merely because WhatsApp is disconnected.

WhatsApp availability belongs to:

```text
GET /whatsapp/status
```

This distinction is useful for Docker and infrastructure health checks.

---

# 28. Docker

The backend must be easy to run using Docker.

The container should:

* install dependencies
* build TypeScript
* start the application
* expose the configured port
* persist WhatsApp authentication through a mounted volume

Keep the Dockerfile simple.

Do not optimize image size prematurely with complicated build tricks.

A multi-stage Docker build is acceptable if it remains readable.

Persist:

```text
/app/data/auth
```

outside the container filesystem.

---

# 29. Graceful Shutdown

When reasonable, handle:

```text
SIGTERM
SIGINT
```

so the HTTP server and WhatsApp connection can shut down cleanly.

Keep the implementation simple.

Do not build a lifecycle framework around shutdown handling.

---

# 30. Frontend Integration

The frontend should consume the backend API instead of accessing Baileys directly.

Expected flow:

```text
React
  |
  | HTTP
  v
Express
  |
  v
Baileys
  |
  v
WhatsApp
```

Frontend initial scope:

* show connection status
* show QR code
* send text message
* show send result

Do not duplicate backend business rules inside the frontend.

Phone normalization should remain backend-owned.

---

# 31. Frontend MVP

The first frontend can be a single page.

Example:

```text
WhatsApp Gateway

Status: Connected

QR
[QR IMAGE]

Send Message

Phone
[ 628xxxxxxxxxx ]

Message
[ Hello ]

[ Send ]

Message sent successfully.
```

There is no need for:

* routing
* authentication screens
* dashboards
* charts
* global state
* design systems

during the first version.

---

# 32. API Verification

Backend implementation is considered functional only after it can be tested independently.

Examples:

Health:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok"
}
```

Status:

```bash
curl http://localhost:3000/whatsapp/status
```

Example:

```json
{
  "success": true,
  "status": "connected"
}
```

Send message:

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "628xxxxxxxxxx",
    "text": "Hello from WhatsApp Gateway"
  }'
```

Expected:

```json
{
  "success": true,
  "messageId": "..."
}
```

Do not call the backend MVP complete until a real WhatsApp message can be sent successfully.

---

# 33. Testing Strategy

Do not create a large testing infrastructure before core functionality works.

Initial priority:

```text
real manual integration test
```

Specifically:

```text
start backend
scan QR
verify connected
call API
receive real WhatsApp message
restart backend
verify session persists
send another message
```

After core behavior is stable, add small automated tests for pure functions such as:

```text
normalizePhone()
request validation
```

When using TDD in this repository, drive the change with unit tests.

For TDD work:

1. write or update the relevant unit test first
2. verify the test fails for the expected reason when practical
3. implement the smallest code change that makes it pass
4. run the targeted unit test before considering the change complete

Use unit tests for isolated application logic such as normalization, validation, response shaping, and error mapping.

Do not attempt to unit-test Baileys itself.

Do not mock the entire WhatsApp protocol simply to increase test coverage.

Meaningful tests are more important than coverage percentage.

---

# 34. Changes Made by Coding Agents

When modifying this repository, agents should:

1. inspect existing code first
2. understand the current implementation
3. make the smallest coherent change
4. avoid unrelated refactors
5. preserve existing behavior unless intentionally changing it
6. remove code that becomes genuinely obsolete
7. run relevant checks after modifications

Do not rewrite working modules solely because another architectural style seems cleaner.

Do not introduce new patterns without a concrete need.

---

# 35. Refactoring Rules

Refactor when:

* code duplication is meaningful
* one module has clearly become difficult to understand
* responsibilities are genuinely mixed
* testing becomes difficult because logic is tightly coupled
* a feature requires a new boundary

Do not refactor because:

* a function exceeds an arbitrary number of lines
* a class does not exist
* there is no repository layer
* there is no dependency injection
* a design pattern could theoretically be used

Prefer evidence-driven refactoring.

---

# 36. Avoid Generic Abstractions

Do not create abstractions like:

```ts
class BaseService {}
class BaseController {}
class BaseRepository {}
interface IMessageProvider {}
class WhatsAppProviderFactory {}
```

when Baileys is the only implementation.

If a second provider is actually introduced later, then evaluate whether an abstraction is worthwhile.

Do not design for imaginary implementations.

---

# 37. Prefer Functions Over Classes

For this MVP, functions and modules are generally preferred.

Good:

```ts
export async function sendTextMessage() {}
```

instead of:

```ts
export class WhatsAppMessageService {
  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly repository: MessageRepository,
    private readonly eventBus: EventBus
  ) {}
}
```

Classes are allowed when stateful behavior genuinely becomes clearer through a class.

Do not use classes solely to imitate frameworks such as NestJS.

---

# 38. Single WhatsApp Session

The MVP supports one WhatsApp account.

Do not add:

```text
session IDs
account IDs
session registry
session manager
tenant IDs
```

until multi-session support becomes an actual requirement.

One process owns one WhatsApp connection.

This greatly reduces complexity.

---

# 39. Message Queue Policy

Send messages directly during the HTTP request for the MVP.

Flow:

```text
HTTP request
    ↓
validate
    ↓
Baileys sendMessage()
    ↓
return response
```

Do not introduce a queue until there is a demonstrated need for:

* large message volume
* retries
* scheduling
* rate control
* asynchronous processing

---

# 40. Database Policy

Do not add a database to the MVP.

The WhatsApp authentication state is persisted through Baileys authentication files.

The gateway does not initially need to store:

* users
* messages
* contacts
* sessions
* analytics

If persistent application data later becomes necessary, select a database based on that requirement.

Do not add PostgreSQL simply because production applications usually have databases.

---

# 41. Message History

Do not implement message history during the MVP.

The gateway's responsibility is initially:

```text
receive send request
send WhatsApp message
return result
```

Applications consuming the gateway may store their own business-level message records.

If gateway-level message history becomes necessary later, design it then.

---

# 42. Idempotency

Do not build a complex idempotency system during the initial MVP.

If duplicate sending becomes a real issue later, introduce an idempotency key or message request ID.

Do not solve hypothetical duplicate-delivery problems prematurely.

---

# 43. API Documentation

Keep README examples updated.

The README should document:

* setup
* development command
* Docker command
* QR authentication
* endpoints
* example `curl`
* environment variables
* session persistence behavior

OpenAPI/Swagger is not required for the initial MVP.

Add it later only when the API surface becomes large enough to justify it.

---

# 44. Package Manager and Scripts

Use pnpm for JavaScript and TypeScript package management in this repository.

Do not add `package-lock.json` or `yarn.lock`.

Keep pnpm scripts obvious.

Recommended:

```json
{
  "packageManager": "pnpm@11.18.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

Add linting or formatting only if the repository actually uses those tools.

Avoid excessive tooling configuration.

---

# 45. Formatting

Use consistent formatting.

Prefer whichever formatter/linter is already configured.

If no formatter exists, write conventional TypeScript formatting rather than adding several tools immediately.

Do not make large formatting-only changes while implementing features.

---

# 46. Comments

Comments should explain decisions, not repeat code.

Bad:

```ts
// Set status to connected
status = "connected";
```

Useful:

```ts
// Clear the QR after authentication so clients do not render an expired code.
currentQr = null;
```

Avoid excessive comments.

Readable code should explain most behavior itself.

---

# 47. Naming

Use explicit names.

Preferred:

```ts
initializeWhatsApp
sendTextMessage
normalizePhoneNumber
currentQr
connectionStatus
```

Avoid:

```ts
init
doSend
handler2
waStuff
utils2
dataManager
```

Use WhatsApp terminology consistently throughout the repository.

---

# 48. Failure Scenarios

The backend should handle common failures without crashing unnecessarily.

Examples:

### WhatsApp disconnected

Return:

```json
{
  "success": false,
  "error": "WHATSAPP_NOT_CONNECTED"
}
```

### Missing request field

Return HTTP 400.

### Baileys send failure

Log the underlying error.

Return a sanitized HTTP 500 or suitable error response.

### Invalid authentication session

Expose a useful disconnected/logged-out state.

### QR expired

Wait for the next QR emitted by Baileys.

Do not fabricate QR refresh behavior.

---

# 49. Concurrency

Do not build special concurrency infrastructure during the MVP.

Node.js and Baileys are sufficient for the expected initial usage.

However, avoid obviously unsafe patterns such as starting multiple WhatsApp initialization processes simultaneously.

Maintain only one active socket.

---

# 50. Dependency Upgrades

Baileys interacts with an unofficial WhatsApp protocol and may change over time.

When modifying Baileys-related code:

1. inspect the currently installed Baileys version
2. consult the API for that version
3. avoid copying outdated examples blindly
4. verify connection behavior after changes
5. verify real message sending

Do not assume old Baileys tutorials remain correct.

---

# 51. Definition of Done — Backend MVP

The backend MVP is complete when all of the following work:

* [ ] backend starts without error
* [ ] `GET /health` returns success
* [ ] WhatsApp emits a QR when unauthenticated
* [ ] QR can be scanned successfully
* [ ] WhatsApp becomes connected
* [ ] `GET /whatsapp/status` reports connected
* [ ] authentication state persists
* [ ] backend can restart without requiring QR scan again
* [ ] `POST /messages/send` accepts phone and text
* [ ] phone number is normalized correctly
* [ ] a real WhatsApp message is delivered
* [ ] disconnected WhatsApp state is handled
* [ ] basic errors return consistent HTTP responses
* [ ] application runs inside Docker
* [ ] authentication state persists through Docker restart

Anything beyond this belongs to a later iteration unless explicitly requested.

---

# 52. Definition of Done — Frontend MVP

Frontend MVP is complete when:

* [ ] application can show backend health
* [ ] connection state is visible
* [ ] QR appears when authentication is required
* [ ] QR disappears after successful connection
* [ ] user can enter a phone number
* [ ] user can enter a message
* [ ] user can send the message
* [ ] success is clearly displayed
* [ ] backend errors are displayed reasonably

The frontend should remain functional rather than visually elaborate.

---

# 53. Future Features

Possible future features include:

```text
API authentication
multiple WhatsApp sessions
message queues
delivery receipts
webhooks
message history
media messages
scheduled messages
rate limiting
frontend dashboard
database persistence
multi-user system
```

These are future possibilities, not current architectural requirements.

Do not structure the current implementation around all of them.

---

# 54. Decision Rule for New Infrastructure

Before adding any major technology, answer:

```text
What current problem does this solve?
```

If the answer is primarily:

```text
we may need it later
```

do not add it.

Examples:

```text
Redis:
Do we currently need distributed cache, queue, or coordination?
No → do not add Redis.

PostgreSQL:
Do we currently have persistent relational application data?
No → do not add PostgreSQL.

BullMQ:
Do we currently need asynchronous queued jobs?
No → do not add BullMQ.

NestJS:
Does Express code currently suffer from architectural complexity?
No → do not migrate to NestJS.
```

---

# 55. Working Principle for Codex

When asked to implement a feature:

1. Understand the requested user-visible behavior.
2. Inspect the smallest relevant part of the repository.
3. Identify the simplest implementation.
4. Reuse existing patterns when reasonable.
5. Do not create abstractions for one-off behavior.
6. Implement the feature completely.
7. Handle obvious failure cases.
8. Verify TypeScript compiles.
9. Run relevant tests if available.
10. Verify runtime behavior where practical.
11. Summarize what changed.

Do not stop after creating scaffolding if the requested behavior can be completed.

Do not leave unnecessary TODOs.

---

# 56. Codex Change Discipline

Prefer changes such as:

```text
1 new helper
1 route update
1 small WhatsApp-module change
```

over:

```text
new architecture
new dependency-injection layer
new service interface
new provider abstraction
new repository layer
new event system
```

unless the latter is truly required.

Keep diffs focused.

Avoid modifying unrelated files.

---

# 57. No Fake Completeness

Never claim functionality works merely because the code compiles.

For WhatsApp functionality, distinguish between:

```text
implemented
```

and:

```text
verified against a real WhatsApp connection
```

If real verification was not possible, state that clearly.

Do not fabricate successful QR authentication, connection, or message delivery results.

---

# 58. No Silent Assumptions

When an implementation requires choosing between multiple behaviors, prefer the behavior that is:

* simplest
* least destructive
* easiest to understand
* compatible with existing behavior

Document important assumptions when necessary.

Do not add functionality that was not requested merely because it seems useful.

---

# 59. Current Architecture Summary

The intended MVP architecture is:

```text
                    ┌─────────────────┐
                    │     React       │
                    │    Frontend     │
                    │   added later   │
                    └────────┬────────┘
                             │
                             │ HTTP
                             ▼
                    ┌─────────────────┐
                    │     Express     │
                    │     Backend     │
                    ├─────────────────┤
                    │ health          │
                    │ WhatsApp status │
                    │ QR              │
                    │ send message    │
                    └────────┬────────┘
                             │
                             │ internal function calls
                             ▼
                    ┌─────────────────┐
                    │     Baileys     │
                    │   WhatsApp      │
                    │   connection    │
                    └────────┬────────┘
                             │
                             ▼
                         WhatsApp

Persistent state:

backend/data/auth/
        │
        └── Baileys authentication files
```

The architecture should stay approximately this simple until actual requirements justify changing it.

---

# 60. Final Rule

This repository should feel like a small tool, not an enterprise platform.

Prefer:

```text
boring
simple
explicit
working
maintainable
```

over:

```text
clever
generic
highly abstract
future-proof
framework-heavy
```

Clean code does not mean maximum abstraction.

Clean code means the next developer can understand the system quickly, modify it safely, and know exactly where behavior lives.

Build what is needed now.

Leave room for change, but do not build the change before it is needed.
