# Distributed Task Execution Engine

A Dockerized task queue system with priority scheduling, worker threads, real-time SSE updates, rate limiting, and analytics.

## Quick start

```bash
docker compose up
```

If you change Dockerfiles or dependency layers and want a fresh rebuild:

```bash
docker compose up --build
```

Optional: override defaults (ports, DB password, worker count) by copying `.env.example` to `.env` and editing values.

API base URL: `http://localhost:5000`  
Frontend URL: `http://localhost:3000`

Health check:

```bash
curl http://localhost:5000/health
```

Seed 55 demo tasks (requires `SEED_ENABLED=true`, enabled in docker-compose):

```bash
curl -X POST http://localhost:5000/api/tasks/seed \
  -H "Content-Type: application/json" \
  -d '{"count": 55}'
```

Or from the backend container:

```bash
docker compose exec backend npm run seed
```

## Frontend (React)

Open `http://localhost:3000` after `docker compose up`.

| View | Route | Features |
|---|---|---|
| Dashboard | `/` | Tasks grouped by status, live progress (SSE), worker utilization |
| Tasks | `/tasks` | Submit, filter/search, cancel, retry DLQ |
| Analytics | `/analytics` | Execution time, throughput, failure rate, queue wait charts |

Select an API client from the header when submitting tasks.

Local dev:

```bash
cd frontend
npm install
npm run dev
```

## Architecture

```text
Client (X-API-Key)
    │
    ▼
Express API ──► MySQL (durable tasks, clients, DLQ)
    │              │
    ├── Redis ◄────┘ progress, rate limits, pub/sub
    │
    ├── Worker Engine (worker_threads)
    │       ├── in-memory per-client RR scheduler
    │       ├── priority ordering within each client queue
    │       └── N concurrent workers (default 4)
    │
    └── SSE stream ◄── Redis pub/sub fan-out
```

### Key decisions

| Concern | Choice |
|---|---|
| Task persistence | MySQL |
| Live progress | Redis + SSE |
| Execution | Node.js `worker_threads` |
| Queue | In-memory per-client round-robin + per-client priority queues |
| Real-time updates | Redis pub/sub → single SSE broadcaster |
| Logging | Pino JSON logs |

## API reference

### Tasks

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/tasks` | Submit task (`X-API-Key` required) |
| `GET` | `/api/tasks` | List/filter/paginate |
| `GET` | `/api/tasks/stats` | Count by status (dashboard) |
| `GET` | `/api/tasks/:id` | Get one task |
| `POST` | `/api/tasks/:id/cancel` | Cancel queued/running |
| `POST` | `/api/tasks/:id/retry` | Retry dead-lettered task |
| `GET` | `/api/tasks/stream` | SSE live updates |
| `POST` | `/api/tasks/seed` | Seed demo tasks (50-200, default 55) |

**Submit example**

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_client_alpha_001" \
  -d '{"type":"IMAGE_PROCESSING","priority":4,"payload":{"file":"photo.jpg"}}'
```

**List filters:** `status`, `type`, `priority`, `minPriority`, `maxPriority`, `clientId`, `from`, `to`, `page`, `limit`, `sort`, `order`

**SSE filters:** `status`, `clientId`, `taskId`

### Workers

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/workers/stats` | Pool size, busy/idle workers, queue depth |

### Analytics

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/analytics?hours=24` | All analytics metrics |

Returns:

- `avgExecutionTimeByType`
- `throughputOverTime` (completed tasks per minute)
- `failureRateByType`
- `queueWaitDistribution`

## Fairness mechanism

Scheduling prevents starvation by doing **client-fair scheduling**:

1. **Client round-robin (RR):** the scheduler rotates through clients that currently have queued tasks.
2. **Priority within each client:** for the selected client, tasks are picked by highest `priority` first, then FIFO by `created_at`.
3. **Per-client in-flight cap:** when multiple clients are competing, each client is allowed to have at most `MAX_RUNNING_PER_CLIENT` tasks running/reserved at the same time.
4. **No preemption:** running tasks are not interrupted; fairness is applied when assigning the next free worker slot.

This ensures that a single client flooding the queue with high-priority tasks cannot indefinitely block other clients.

Example (pool size `3`, cap `1`): if client `A` has many `P5` tasks and clients `B`, `C`, `D` have fewer lower-priority tasks, dispatch still rotates by client (`A -> B -> C -> D -> ...`) while each client's own queue remains priority-ordered.

**Trade-offs**

- Fairness is per-process and in-memory; restarting the node resets the RR pointer/in-flight tracking
- Fairness is client-level (anti-starvation), not globally strict priority across all clients

## Worker engine

- Configurable pool: `WORKER_POOL_SIZE` (default `4`)
- Simulated work: random 5–30 seconds, 10 progress steps
- Crash recovery: orphaned `RUNNING` tasks recovered on startup
- Retries: max 3, then `DEAD_LETTER` + `dead_letter_tasks` row
- Cancel: queued tasks removed from queue; running tasks get cooperative cancel via worker message

## Rate limiting

- 10 tasks/minute per API key on `POST /api/tasks`
- Backed by Redis counters
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `mysql` | MySQL host |
| `DB_PASSWORD` | `Admin123root` | MySQL password |
| `DB_DATABASE` | `task_manager` | Database name |
| `REDIS_HOST` | `redis` | Redis host |
| `WORKER_POOL_SIZE` | `4` | Concurrent workers |
| `MAX_RUNNING_PER_CLIENT` | `1` | In-flight (reserved) tasks per client when multiple clients have work |
| `SEED_ENABLED` | `false` | Enable `/api/tasks/seed` |
| `PORT` | `5000` | API port |

## Scaling beyond a single node

1. **API layer:** stateless Express instances behind a load balancer
2. **Queue:** move from in-memory to Redis Streams or RabbitMQ for shared queue state
3. **Workers:** dedicated worker service consuming from shared queue (horizontal scale)
4. **MySQL:** read replicas for analytics; primary for writes
5. **Redis:** cluster/sentinel for progress, rate limits, pub/sub
6. **SSE:** sticky sessions or Redis pub/sub bridge (already compatible)
7. **DLQ:** retained in MySQL; optional S3/archive for audit

## Trade-offs and shortcuts

- In-memory queue instead of distributed queue
- Seed endpoint gated by `SEED_ENABLED` instead of admin auth
- No automated test suite (focus on working docker-compose demo)
- Single Redis subscriber for SSE (sufficient for one node)

## Production improvements

- Auth/JWT for admin endpoints; rotate API keys
- Idempotency keys on task submission
- OpenTelemetry tracing across API → queue → worker
- Graceful shutdown (drain workers, flush queue state)
- Migration tool (Flyway/Liquibase) instead of init-only SQL
- Integration tests for queue ordering, crash recovery, fairness
- Secrets via vault/K8s secrets, not compose env
- Dead letter replay policies and alerting

## Seed API clients

| API Key | Client |
|---|---|
| `ak_client_alpha_001` | Alpha Corp |
| `ak_client_beta_002` | Beta Analytics |
| `ak_client_gamma_003` | Gamma Labs |
| `ak_client_delta_004` | Delta Systems |
| `ak_client_epsilon_005` | Epsilon Media |
