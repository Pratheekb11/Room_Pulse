-- Production change for finishing team activities: a leaf limit per board (1 to 10, null = 5) and
-- hiding just the name on a board answer. Adds two columns and lets leaf numbers (slot) go up to 9.
-- Nothing changes for existing answers. Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-15-activities-finish.sql
alter table focus_topics add column if not exists max_leaves int check (max_leaves between 1 and 10);
alter table text_answers add column if not exists author_hidden boolean not null default false;
alter table text_answers drop constraint if exists text_answers_slot_check;
alter table text_answers add constraint text_answers_slot_check check (slot between 0 and 9);
