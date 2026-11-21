-- Production change for the UX round:
--  * "Follow me" (sessions.follow_focus_id, the question the presenter leads every phone to; null = off):
--    one column, and live_sessions recreated so it includes it.
--  * Abuse limits (lib/limits.ts, lib/voter-gate.ts): four new tables. Every vote and answer route uses
--    them, so they must exist before the code ships.
-- Only adds; nothing changes for existing presentations or answers. Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-21-follow-moderation.sql
alter table sessions add column if not exists follow_focus_id uuid references focus_topics(id) on delete set null;
-- Recreate the view so it includes the column above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();

-- Abuse limits (lib/limits.ts). Requests per client per time window. `bucket` is the limit's name
-- plus a salted hash of the client's address, never the address itself; rows older than a day are
-- deleted by the daily clean-up.
create table if not exists rate_hits (
  bucket        text not null,
  window_start  timestamptz not null,
  n             int not null default 0,
  primary key (bucket, window_start)
);

-- Everyone who has answered a presentation, so it can cap how many voters it takes.
create table if not exists session_voters (
  session_id  uuid not null references sessions(id) on delete cascade,
  voter_id    uuid not null,
  created_at  timestamptz not null default now(),
  primary key (session_id, voter_id)
);

-- Words the owner hid from a word cloud (stored lowercased, like the answers).
create table if not exists hidden_words (
  focus_id  uuid not null references focus_topics(id) on delete cascade,
  word      text not null,
  primary key (focus_id, word)
);

-- Quiz players the owner hid from the leaderboard.
create table if not exists quiz_hidden_players (
  session_id  uuid not null references sessions(id) on delete cascade,
  voter_id    uuid not null,
  primary key (session_id, voter_id)
);
