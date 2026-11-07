-- LiveRate schema (run once)
create extension if not exists pgcrypto;

-- Presenter accounts. Passwords are stored only as salted scrypt hashes.
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique check (email = lower(email) and length(email) between 3 and 254),
  password_hash  text not null check (password_hash like 'scrypt$%'),
  created_at     timestamptz not null default now()
);

-- Signed-in browser sessions. Only a SHA-256 hash of the cookie token is stored.
create table if not exists auth_sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists auth_sessions_user_idx on auth_sessions(user_id);

-- Guest presenters: no email or password until they save the account.
alter table users add column if not exists is_guest boolean not null default false;
alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;
do $$ begin
  alter table users add constraint users_guest_check check (
    (is_guest and email is null and password_hash is null)
    or (not is_guest and email is not null and password_hash is not null));
exception when duplicate_object then null; end $$;
create index if not exists users_guest_created_idx on users(created_at) where is_guest;

-- Email verification (null = not verified yet)
alter table users add column if not exists email_verified_at timestamptz;

-- Single-use links for email verification and password reset. Only a SHA-256 hash is stored.
create table if not exists email_tokens (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  purpose     text not null check (purpose in ('verify', 'reset')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists email_tokens_user_idx on email_tokens(user_id, purpose, created_at);

-- Failed logins per email, for temporary lockout. No IP addresses are stored.
create table if not exists login_failures (
  email  text not null,
  at     timestamptz not null default now()
);
create index if not exists login_failures_email_idx on login_failures(email, at);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- short public code used in URLs
  title       text not null,
  scale_max   int  not null default 5 check (scale_max between 3 and 10),
  low_label   text not null default 'Low',
  high_label  text not null default 'High',
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists topics (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  position    int  not null
);

create table if not exists criteria (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  position    int  not null
);

-- Focus topics group the topics of a presentation (up to 10 per presentation).
create table if not exists focus_topics (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  position    int  not null
);
create index if not exists focus_topics_session_idx on focus_topics(session_id, position);

-- null = topic created before focus topics existed
alter table topics add column if not exists focus_id uuid references focus_topics(id) on delete cascade;

-- Question type of each focus topic:
--   rating = topics rated on every criterion, poll = pick one topic (option), words = word cloud
alter table focus_topics add column if not exists kind text not null default 'rating';
do $$ begin
  alter table focus_topics add constraint focus_topics_kind_check check (kind in ('rating', 'poll', 'words'));
exception when duplicate_object then null; end $$;

-- Chart the presenter picked for this question (the dashboard opens on it)
alter table focus_topics add column if not exists chart text;

-- One poll choice per voter per poll
create table if not exists poll_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  topic_id    uuid not null references topics(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (focus_id, voter_id)
);
create index if not exists poll_answers_session_idx on poll_answers(session_id, voter_id);

-- Up to 3 words per voter per word cloud (stored lower-case)
create table if not exists word_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  slot        int  not null check (slot between 1 and 3),
  word        text not null check (length(word) between 1 and 40),
  created_at  timestamptz not null default now(),
  primary key (focus_id, voter_id, slot)
);
create index if not exists word_answers_session_idx on word_answers(session_id, voter_id);

-- One row per voter per topic x criterion
create table if not exists votes (
  session_id    uuid not null references sessions(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  criterion_id  uuid not null references criteria(id) on delete cascade,
  voter_id      uuid not null,                     -- random per-browser id, not a person
  score         int  not null check (score between 1 and 10),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (session_id, topic_id, criterion_id, voter_id)
);

-- Aggregates the dashboard reads. Contains no voter ids.
create table if not exists results (
  session_id    uuid not null references sessions(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  criterion_id  uuid not null references criteria(id) on delete cascade,
  vote_count    int  not null default 0,
  score_sum     int  not null default 0,
  primary key (session_id, topic_id, criterion_id)
);

-- Each session belongs to the account that created it (null = created before accounts existed).
alter table sessions add column if not exists owner_id uuid references users(id) on delete cascade;
create index if not exists sessions_owner_idx on sessions(owner_id, created_at desc);

create index if not exists topics_session_idx      on topics(session_id, position);
create index if not exists criteria_session_idx    on criteria(session_id, position);
create index if not exists votes_session_voter_idx on votes(session_id, voter_id);

-- Keep results in sync with votes (atomic, inside the same statement as the vote)
create or replace function apply_vote() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into results (session_id, topic_id, criterion_id, vote_count, score_sum)
    values (new.session_id, new.topic_id, new.criterion_id, 1, new.score)
    on conflict (session_id, topic_id, criterion_id) do update
      set vote_count = results.vote_count + 1,
          score_sum  = results.score_sum + excluded.score_sum;
  elsif tg_op = 'UPDATE' then
    if new.score <> old.score then
      update results
         set score_sum = score_sum + new.score - old.score
       where session_id = new.session_id
         and topic_id = new.topic_id
         and criterion_id = new.criterion_id;
    end if;
  elsif tg_op = 'DELETE' then
    update results
       set vote_count = vote_count - 1,
           score_sum  = score_sum - old.score
     where session_id = old.session_id
       and topic_id = old.topic_id
       and criterion_id = old.criterion_id;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_apply on votes;
create trigger votes_apply
after insert or update or delete on votes
for each row execute function apply_vote();

-- Safety net: recompute a session's totals from the raw votes (use when voting is closed)
create or replace function rebuild_results(p_session_id uuid) returns void
language sql as $$
  delete from results where session_id = p_session_id;
  insert into results (session_id, topic_id, criterion_id, vote_count, score_sum)
  select session_id, topic_id, criterion_id, count(*), sum(score)
    from votes
   where session_id = p_session_id
   group by session_id, topic_id, criterion_id;
$$;

-- Guest presentations expire 3 days after creation (null = never).
alter table sessions add column if not exists expires_at timestamptz;
create index if not exists sessions_expires_idx on sessions(expires_at) where expires_at is not null;

-- Secret key for the presenter's live results link (unrelated to the public voting code).
alter table sessions add column if not exists dashboard_key text not null
  default replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_');
create unique index if not exists sessions_dashboard_key_idx on sessions(dashboard_key);

-- Bumped on every edit so open ballots and dashboards reload the questions.
alter table sessions add column if not exists revision int not null default 0;

-- Every public lookup goes through this view, so expired presentations behave as if deleted.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();

-- Guests get back in with a 6-digit PIN plus one of their presentation codes (salted scrypt hash).
alter table users add column if not exists guest_pin_hash text;

-- Guests get back in on any device with one long guest code (only its SHA-256 hash is stored).
-- Replaces the older PIN + presentation code sign-in.
alter table users add column if not exists guest_code_hash text;
create unique index if not exists users_guest_code_idx on users(guest_code_hash) where guest_code_hash is not null;

-- More question types:
--   multi  = pick several options (up to max_picks; null = any number)
--   text   = open answer, one short text per person
--   rank   = put every option in order
--   number = answer with a number between num_min and num_max
alter table focus_topics drop constraint if exists focus_topics_kind_check;
-- (the check is added once, with every kind, in the quiz section below: re-adding a shorter
--  list here would fail on databases that already hold newer kinds)
alter table focus_topics add column if not exists max_picks int check (max_picks between 1 and 10);
alter table focus_topics add column if not exists num_min double precision;
alter table focus_topics add column if not exists num_max double precision;
alter table focus_topics add column if not exists num_unit text check (length(num_unit) <= 20);

-- Pick several: one row per option a voter picked
create table if not exists choice_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  topic_id    uuid not null references topics(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (focus_id, voter_id, topic_id)
);
create index if not exists choice_answers_session_idx on choice_answers(session_id, voter_id);

-- Open answer: one text per voter per question
create table if not exists text_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  body        text not null check (length(body) between 1 and 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (focus_id, voter_id)
);
create index if not exists text_answers_session_idx on text_answers(session_id, voter_id);
create index if not exists text_answers_recent_idx on text_answers(focus_id, updated_at desc);

-- Ranking: the place (1 = first) a voter gave each option
create table if not exists rank_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  topic_id    uuid not null references topics(id) on delete cascade,
  place       int  not null check (place between 1 and 10),
  created_at  timestamptz not null default now(),
  primary key (focus_id, voter_id, topic_id)
);
create index if not exists rank_answers_session_idx on rank_answers(session_id, voter_id);

-- Number: one number per voter per question
create table if not exists number_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  value       double precision not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (focus_id, voter_id)
);
create index if not exists number_answers_session_idx on number_answers(session_id, voter_id);

-- Audience Q&A: voters send in questions (up to 3 each) and upvote other people's.
-- The owner can hide a question or mark it answered.
alter table focus_topics drop constraint if exists focus_topics_kind_check;
-- (the check is added once, with every kind, in the quiz section below: re-adding a shorter
--  list here would fail on databases that already hold newer kinds)

create table if not exists qa_questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  body        text not null check (length(body) between 1 and 280),
  hidden      boolean not null default false,
  answered    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists qa_questions_session_idx on qa_questions(session_id, voter_id);
create index if not exists qa_questions_focus_idx on qa_questions(focus_id, created_at desc);

create table if not exists qa_votes (
  question_id uuid not null references qa_questions(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  created_at  timestamptz not null default now(),
  primary key (question_id, voter_id)
);
create index if not exists qa_votes_session_idx on qa_votes(session_id, voter_id);

-- Quiz: presenter-paced questions with a right answer, a timer and a leaderboard.
--   quiz_correct = index of the right option (0 = first, by position)
--   sessions.quiz_focus_id / quiz_started_at = the question running now (phones follow it)
alter table focus_topics drop constraint if exists focus_topics_kind_check;
alter table focus_topics add constraint focus_topics_kind_check
  check (kind in ('rating', 'poll', 'words', 'multi', 'text', 'rank', 'number', 'qa', 'quiz'));
alter table focus_topics add column if not exists quiz_correct int check (quiz_correct between 0 and 9);
alter table focus_topics add column if not exists quiz_seconds int check (quiz_seconds between 5 and 120);
alter table sessions add column if not exists quiz_focus_id uuid references focus_topics(id) on delete set null;
alter table sessions add column if not exists quiz_started_at timestamptz;

-- Nickname for the leaderboard, one per voter per presentation
create table if not exists quiz_players (
  session_id  uuid not null references sessions(id) on delete cascade,
  voter_id    uuid not null,
  nickname    text not null check (length(nickname) between 1 and 20),
  created_at  timestamptz not null default now(),
  primary key (session_id, voter_id)
);

-- One locked-in answer per voter per quiz question, scored when it arrives
create table if not exists quiz_answers (
  session_id  uuid not null references sessions(id) on delete cascade,
  focus_id    uuid not null references focus_topics(id) on delete cascade,
  voter_id    uuid not null,
  topic_id    uuid not null references topics(id) on delete cascade,
  correct     boolean not null,
  points      int not null check (points between 0 and 1000),
  created_at  timestamptz not null default now(),
  primary key (focus_id, voter_id)
);
create index if not exists quiz_answers_session_idx on quiz_answers(session_id, voter_id);

-- Recreate the view so it includes the quiz columns added above (a view keeps the columns it had when made).
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();

-- Open answers: the owner can hide one from the big screen (like Audience Q&A). The id names an
-- answer without revealing who wrote it.
alter table text_answers add column if not exists id uuid not null default gen_random_uuid();
alter table text_answers add column if not exists hidden boolean not null default false;
create unique index if not exists text_answers_id_idx on text_answers(id);

-- Owner settings per presentation: show live results on voters' phones, and AI insights
-- (accounts only; nothing is sent to the AI provider unless this is on).
alter table sessions add column if not exists show_results boolean not null default false;
alter table sessions add column if not exists ai_enabled boolean not null default false;
-- Recreate the view so it includes the columns above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();

-- AI insights: how many AI requests each account made per day (UTC), for the daily cap.
create table if not exists ai_usage (
  user_id  uuid not null references users(id) on delete cascade,
  day      date not null,
  n        int  not null default 0,
  primary key (user_id, day)
);

-- Slide design of a presentation (lib/themes.ts): colours and headline type on the big screen
-- and on voters' phones.
alter table sessions add column if not exists theme text not null default 'paper';
alter table sessions drop constraint if exists sessions_theme_check;
alter table sessions add constraint sessions_theme_check
  check (theme in ('paper', 'mono', 'harbour', 'forest', 'blush', 'pop', 'anime', 'chalk', 'midnight', 'neon', 'arcade'));
-- Fun illustrations (lib/decor.ts): doodle characters on the big screen and phones.
alter table sessions add column if not exists decor boolean not null default true;
-- Recreate the view so it includes the columns above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();
