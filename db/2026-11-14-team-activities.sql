-- Production change for team activities: boards on open answer questions and signed answers.
-- Adds two nullable columns and a leaf number (slot) to open answers, then puts the slot in the
-- primary key (existing answers become slot 0, so nothing changes for them). Run before deploying the code:
--   node scripts/run-sql.mjs db/2026-11-14-team-activities.sql
alter table focus_topics add column if not exists board text check (board in ('tree', 'wall', 'sky'));
alter table text_answers add column if not exists author text check (length(author) between 1 and 30);
-- Several leaves per person on a board question: each person's answers are numbered 0..4 (slot).
-- Plain open answers always use slot 0, so they stay one per person.
alter table text_answers add column if not exists slot int not null default 0 check (slot between 0 and 4);
do $$
begin
  if (select array_length(conkey, 1) from pg_constraint where conname = 'text_answers_pkey') is distinct from 3 then
    alter table text_answers drop constraint if exists text_answers_pkey;
    alter table text_answers add constraint text_answers_pkey primary key (focus_id, voter_id, slot);
  end if;
end $$;
