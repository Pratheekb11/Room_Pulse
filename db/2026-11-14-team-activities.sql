-- Production change for team activities: boards on open answer questions and signed answers.
-- Only adds two nullable columns. Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-14-team-activities.sql
alter table focus_topics add column if not exists board text check (board in ('tree', 'wall', 'sky'));
alter table text_answers add column if not exists author text check (length(author) between 1 and 30);
