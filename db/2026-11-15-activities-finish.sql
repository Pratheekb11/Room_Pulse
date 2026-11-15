-- Production change for finishing team activities: a leaf limit per board (1 to 10, null = 5),
-- hiding just the name on a board answer, and names on every answer of a team activity
-- (sessions.named, voter_names). Adds columns and one table, and lets leaf numbers (slot) go up to 9.
-- Nothing changes for existing answers or presentations. Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-15-activities-finish.sql
alter table focus_topics add column if not exists max_leaves int check (max_leaves between 1 and 10);
alter table text_answers add column if not exists author_hidden boolean not null default false;
alter table text_answers drop constraint if exists text_answers_slot_check;
alter table text_answers add constraint text_answers_slot_check check (slot between 0 and 9);
alter table sessions add column if not exists named boolean not null default false;
-- Recreate the view so it includes the column above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();
create table if not exists voter_names (
  session_id  uuid not null references sessions(id) on delete cascade,
  voter_id    uuid not null,
  name        text not null check (length(name) between 1 and 30),
  updated_at  timestamptz not null default now(),
  primary key (session_id, voter_id)
);
