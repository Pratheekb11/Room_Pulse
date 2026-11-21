-- Production change for the UX round: "Follow me" (sessions.follow_focus_id, the question the presenter leads
-- every phone to; null = off). Adds one column and recreates live_sessions so it includes it.
-- Nothing changes for existing presentations or answers. Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-21-follow-moderation.sql
alter table sessions add column if not exists follow_focus_id uuid references focus_topics(id) on delete set null;
-- Recreate the view so it includes the column above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();
