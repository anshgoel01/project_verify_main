# VerifyHub: Enterprise System Design, Architecture, and Security Audit

## 1. Project Overview & Business Value
VerifyHub is an automated, web-based platform engineered to resolve the administrative bottleneck of verifying student guided projects. Traditionally, verifying certifications and their associated social media proof-of-work (e.g., LinkedIn posts) demands $O(N)$ manual effort. Administrators must individually validate URLs, cross-reference student names against certificate names, and parse social media text for course mentions. 

VerifyHub reduces this workflow to $O(1)$ time per submission for administrators by offloading the verification logic to serverless Edge Functions. This system eliminates human bias, accelerates feedback loops from days to seconds, and fosters engagement via a real-time gamified leaderboard.

---

## 2. System Architecture & Production Design

### High-Level Architecture (Data Flow)
The system operates on an event-driven architecture, bridging a React single-page application (SPA) with Supabase's backend-as-a-service (BaaS) infrastructure.

1. **Client Hydration:** The React component mounts, hydrating state via `useAuth` (retrieving JWT).
2. **Pre-flight Validation:** Client-side form submission triggers `zod` schema validation.
3. **Optimistic Database Initialization:** An `INSERT` to the `submissions` table (status: `processing`) acts as a distributed lock, preventing double-submission via DB unique constraints.
4. **Serverless Invocation:** The client invokes the `verify-submission` Deno Edge Function.
5. **Parallel Network I/O:** The Edge Function executes asynchronous `Promise.all` requests to scrape Coursera and LinkedIn.
6. **Fuzzy Identity Resolution:** A custom set-intersection algorithm (`namesMatch`) compares the user's registered identity against scraped payloads.
7. **State Persistence:** The Edge Function executes an `UPDATE` on the `submissions` row (`correct`, `skipped`, `wrong`).
8. **WebSocket Push:** Supabase Realtime broadcasts the WAL (Write-Ahead Log) change to subscribed clients, triggering UI re-renders.

### Load Handling & Scalability (10K → 1M users)
* **10K Users (Current):** Synchronous Edge Functions with direct DB connections work fine. Connection pooling (PgBouncer in Supabase) easily handles the load.
* **100K Users:** Synchronous scraping becomes a severe bottleneck. 100K concurrent submissions will exhaust the Edge Function connection pool and hit Deno execution timeouts. 
    * *Fix:* Introduce an asynchronous Event Queue (e.g., AWS SQS or Inngest). The Edge Function simply drops the payload in the queue and returns `202 Accepted`. Background workers process the scraping.
* **1M Users:** Leaderboard recalculations via `SELECT * ORDER BY score` will cause CPU thrashing on PostgreSQL.
    * *Fix:* Implement a Redis Sorted Set (`ZSET`) for $O(\log N)$ leaderboard writes/reads. Database reads move entirely to Redis or a CDN cache.

### Latency Breakdown & Throughput Estimates
* **Frontend -> Edge Network Hop:** ~50-100ms
* **Edge Deno Cold Start:** <50ms
* **Parallel Scraping (Coursera + LinkedIn):** ~800ms - 2500ms (Heavily dependent on target site latency)
* **Matching Algorithm (CPU bound):** <5ms
* **PostgreSQL Write (via PgBouncer):** ~20ms
* **WebSocket Push:** ~50-100ms
* **Total P95 Latency:** ~3 seconds. 
* **Throughput:** Assuming 50 concurrent Edge Function invocations (Supabase standard tier), max throughput is roughly ~15-20 verifications per second.

### Cost Considerations
* **Supabase:** Fixed tier ($25/mo) handles DB, Auth, and Edge Functions. Scaling requires paying for compute hours and egress.
* **Upstash Redis:** Pay-per-request. Highly cost-effective for rate limiting (~$0.20 per 100k requests).
* **Vercel:** Free tier handles static asset delivery via global Edge Network.

---

## 3. Missing Low-Level Engineering Details

### Database Schema (Core Tables)
```sql
-- Profiles: Source of truth for identity and score
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  linkedin_url TEXT UNIQUE,
  score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_score ON profiles(score DESC); -- Critical for Leaderboard

-- Submissions: The transaction log
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  coursera_link TEXT NOT NULL,
  linkedin_link TEXT NOT NULL,
  status TEXT CHECK (status IN ('processing', 'correct', 'wrong', 'skipped')),
  level TEXT DEFAULT 'Beginner',
  UNIQUE(user_id, coursera_link) -- Prevents duplicate identical submissions
);
CREATE INDEX idx_submissions_user_status ON submissions(user_id, status);
```

### API Contracts
**POST `/functions/v1/verify-submission`**
*   **Request:**
    ```json
    {
      "submission_id": "uuid-v4-string"
    }
    ```
    *Note: The actual URLs are fetched securely from the DB by the Edge Function to prevent payload tampering.*
*   **Response (200 OK):**
    ```json
    {
      "status": "correct",
      "error_message": null
    }
    ```

### Edge Function Internal Execution Flow
1. **Context Init:** Extract JWT from headers, instantiate Supabase Admin client (bypassing RLS for secure updates).
2. **Rate Limit Check:** Query Upstash Redis via sliding window protocol.
3. **DB Read:** Fetch row matching `submission_id`. Fetch user `profile`.
4. **Scraping Subroutine:** Trigger network requests. Timeout wrap at 12 seconds.
5. **Logic Gate:** Compute `namesMatch` && `courseMatch`.
6. **DB Write:** Execute `UPDATE submissions SET status = $1 WHERE id = $2`.

---

## 4. Failure Modes & Reliability Engineering

What happens when external dependencies fail?

### 1. Supabase/Database Goes Down
* **Impact:** Complete system outage. Auth fails, DB inserts fail.
* **Recovery Strategy:** Client-side generic error boundary ("Service temporarily unavailable"). Implement a circuit breaker in the frontend to stop spamming the API. 

### 2. LinkedIn Blocks Requests (403/429)
* **Impact:** All verifications fail the `captionMentionsCourse` check.
* **Recovery Strategy:** 
    *   **Fallback:** The code currently falls back to `status: skipped` instead of `wrong`, moving the submission to a manual admin review queue. 
    *   **Retry Strategy:** Implement Exponential Backoff with Jitter in the Edge Function for scraping `fetch` calls.

### 3. Edge Function Times Out (>15s)
* **Impact:** The client is left hanging, and the database row remains stuck in `status: processing`.
* **Recovery Strategy:** 
    *   **Backend:** A `timeoutPromise` wrapper deletes the row if scraping exceeds 12s.
    *   **Frontend:** The client must enforce a strict 15s timeout on the fetch call, automatically changing the UI state to "Failed - Try Again" if the server does not respond.

### 4. Database Connection Pool Exhausted
* **Impact:** "Too many connections" errors during traffic spikes.
* **Recovery Strategy:** Ensure Edge Functions use connection pooling ports (Supabase PgBouncer usually handles this via port 6543).

---

## 5. Performance Engineering Deep Dive

### Hidden N+1 Queries
* **Risk:** If the Admin Dashboard renders a list of 100 submissions, and for each submission it queries the `profiles` table to get the student's name, that is an $N+1$ query nightmare.
* **Fix:** Use PostgreSQL `JOIN`s in the Supabase query: 
  `supabase.from('submissions').select('*, profiles(full_name)')`

### WebSocket Inefficiencies
* **Risk:** In `Leaderboard.tsx`, `supabase.channel().on(...)` triggers a complete `fetchData()` call. If 50 students submit simultaneously, the clients execute 50 heavy `SELECT` queries against the database.
* **Fix:** Implement Event Batching. Debounce the `fetchData()` call by 2000ms. Alternatively, push the *actual updated data* in the WebSocket payload, allowing the client to mutate the local React state directly without hitting the database again.

### Caching Strategies
* **Leaderboard CDN Caching:** The leaderboard does not need to be millisecond-accurate. Cache the `/api/leaderboard` response in Redis or a Vercel Edge Cache with a TTL of 60 seconds (`Cache-Control: s-maxage=60`). This intercepts 99% of database read traffic during a viral spike.

---

## 6. Advanced Security Audit

### Exploit 1: SSRF (Server-Side Request Forgery)
* **Attack Path:** Attacker intercepts the `/submit` POST request and modifies the `coursera_link` to `http://169.254.169.254/latest/meta-data/`.
* **Impact:** The Edge Function scrapes the AWS metadata server, potentially returning temporary IAM credentials in the response body (if error messages reflect scraped content).
* **Exact Fix:** Strict URL parsing. 
  ```typescript
  const url = new URL(input);
  if (!['coursera.org', 'www.coursera.org'].includes(url.hostname)) throw new Error("Invalid URL");
  ```

### Exploit 2: JWT Replay & State Manipulation
* **Attack Path:** Attacker captures a valid JWT. They manually invoke the Edge Function multiple times with the same `submission_id`.
* **Impact:** If the Edge Function simply increments the user's score upon a `correct` status without checking the *previous* status, the attacker can artificially inflate their score infinitely.
* **Exact Fix:** Idempotency keys. Ensure the DB `UPDATE` logic is strictly idempotent. 
  `UPDATE profiles SET score = score + 1 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM submissions WHERE id = $2 AND status = 'correct')`

### Exploit 3: Rate Limit Bypass via IP Spoofing
* **Attack Path:** Attacker sets `X-Forwarded-For: <random-ip>` in the request headers. The Upstash rate limiter reads this spoofed IP and grants a fresh bucket.
* **Impact:** DDoS of the Edge Functions and upstream scraping targets.
* **Exact Fix:** Rate limit based on the authenticated `user.id` extracted directly from the verified JWT, *not* the client IP.

---

## 7. Code-Level Critique

* **Anti-Pattern:** Mixing `async/await` with `.then()` chains (seen in standard Supabase client patterns). It makes error boundaries difficult to trace. Stick purely to `async/await` with `try/catch`.
* **Bad Assumption:** Assuming Coursera DOM structure will remain static. 
* **Race Condition:** If a user double-clicks the "Submit" button rapidly, two network requests hit the server. If the frontend doesn't disable the button instantly, the unique constraint handles it, but the DB still throws an ugly `23505` exception. Use a `useMutation` hook from React Query with `isPending` to explicitly block the UI.

---

## 8. Production Reality Check

### What will break first?
1. **LinkedIn Scraping:** LinkedIn heavily utilizes bot protection (Cloudflare/Imperva). The Vercel/Supabase datacenter IPs will be blacklisted within weeks of high-volume usage. This is a **"Must Fix"** before scaling. You must integrate a rotating proxy or officially use the LinkedIn OAuth API.
2. **WebSocket Thrashing:** The "refresh all data on every event" pattern will cause severe frontend lag and DB CPU spikes. This is a **"Must Fix"**.

### What is "Good Enough"?
* **The `namesMatch` algorithm:** While mathematically flawed (Set Intersection), it is "good enough" for a closed college ecosystem where extreme malice is low. Replacing it with Levenshtein distance is nice, but not a launch blocker.
* **PostgreSQL Leaderboard:** A simple `SELECT ... ORDER BY score` is good enough for <10,000 users. Do not over-engineer a Redis ZSET until database metrics prove it is necessary.

---

## 9. How to Explain This Project in an Interview

### The 2-Minute Pitch (The Elevator Pitch)
"VerifyHub is a serverless application I built to automate the verification of student projects. Instead of faculty manually checking hundreds of Coursera certificates and LinkedIn posts, my system uses Supabase Edge Functions to scrape the data, run a custom fuzzy-matching algorithm on the student's identity, and validate the content. It features a real-time WebSocket leaderboard and reduces verification time from hours down to O(1) latency per submission. I utilized React, TypeScript, and PostgreSQL with strict Row Level Security."

### The 5-Minute Deep Dive (Architecture & Trade-offs)
*   **The Problem:** Scraping JS-heavy sites like LinkedIn is hard in a serverless environment.
*   **The Solution:** I reverse-engineered the LinkedIn URL structure to target their `/embed/` endpoints, which serve raw HTML server-side, allowing me to use fast regex parsing in Deno without the overhead of headless Chrome.
*   **The Trade-off:** Scraping is inherently fragile. I had to design robust failure modes. If scraping times out or hits a captcha, the system gracefully degrades the submission to a `skipped` status, pushing it to a manual admin queue rather than outright rejecting a legitimate student.
*   **The Optimization:** I implemented token-bucket rate limiting via Upstash Redis to prevent abuse, and used database-level unique constraints to prevent race conditions during form submission.

### Likely Interview Questions & Strong Answers
*   **Q:** *Why did you use Deno Edge Functions instead of a Node.js backend?*
    *   **A:** Cold start times and security. Scraping requires fast I/O. Deno's V8 isolates spin up in <50ms compared to Node's 500ms. Furthermore, Deno's secure-by-default runtime allowed me to restrict network access, mitigating SSRF risks inherent in applications that fetch user-provided URLs.
*   **Q:** *How does your fuzzy matching handle names like "John Smith" vs "Smith, John T."?*
    *   **A:** I implemented a set-intersection algorithm. I normalize the text, split it into word arrays, and calculate the overlap ratio between the two sets. As long as the core identifiers intersect above an 80% threshold, it passes, completely bypassing ordering issues.
*   **Q:** *What happens if 10,000 students submit at once?*
    *   **A:** Currently, the system executes synchronous `fetch` calls, which would exhaust connection pools. My scaling roadmap involves decoupling the ingestion from the processing by introducing an SQS or Inngest message queue, allowing background workers to process the scraping asynchronously while instantly returning a 202 status to the client.
