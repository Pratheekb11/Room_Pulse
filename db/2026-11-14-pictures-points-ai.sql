-- LiveRate production change, 2026-11-14: pictures, open points, saved AI summary.
-- Same as the end of db/schema.sql. Safe to run more than once. Only adds tables and columns;
-- nothing is deleted or changed. Run it in the Neon SQL Editor BEFORE deploying the code.
-- Pictures on questions and options (lib/images.ts). The browser shrinks each one to a small JPEG
-- before upload; the bytes live here and are served from /api/img/[id].
create table if not exists images (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id) on delete cascade,
  bytes       bytea not null check (octet_length(bytes) between 1 and 200000),
  width       int  not null check (width between 1 and 1280),
  height      int  not null check (height between 1 and 1280),
  created_at  timestamptz not null default now()
);
create index if not exists images_owner_idx on images(owner_id);
alter table focus_topics add column if not exists image_id uuid references images(id) on delete set null;
alter table topics add column if not exists image_id uuid references images(id) on delete set null;
create index if not exists focus_topics_image_idx on focus_topics(image_id) where image_id is not null;
create index if not exists topics_image_idx on topics(image_id) where image_id is not null;

-- Open points (an open point list): things to follow up after the poll (lib/points.ts).
--   sessions.raise_points = people may raise open points from their phones
--   sessions.point_seq    = the last number given out, so a deleted point's number is never reused
alter table sessions add column if not exists raise_points boolean not null default false;
alter table sessions add column if not exists point_seq int not null default 0;
-- Recreate the view so it includes the columns above.
create or replace view live_sessions as
  select * from sessions where expires_at is null or expires_at > now();

create table if not exists open_points (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  number      int  not null,
  -- who raised it from a phone (null = added by the presenter); never shown to anyone
  voter_id    uuid,
  source      text not null default 'audience' check (source in ('audience', 'presenter', 'result', 'ai')),
  -- the result or AI suggestion it was made from, so the same one isn't added twice
  origin_key  text check (length(origin_key) between 1 and 120),
  focus_id    uuid references focus_topics(id) on delete set null,
  title       text not null check (length(title) between 1 and 200),
  raised_by   text check (length(raised_by) between 1 and 40),
  status      text not null default 'open' check (status in ('open', 'doing', 'closed')),
  assignee    text check (length(assignee) between 1 and 60),
  due         date,
  note        text check (length(note) between 1 and 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz,
  unique (session_id, number)
);
create unique index if not exists open_points_origin_idx on open_points(session_id, origin_key) where origin_key is not null;
create index if not exists open_points_voter_idx on open_points(session_id, voter_id) where voter_id is not null;

-- AI summary of a whole presentation (lib/ai-insights.ts `overview`): the latest one is kept, so it
-- survives a refresh and goes into the report. Cleared with the answers.
create table if not exists ai_reports (
  session_id  uuid primary key references sessions(id) on delete cascade,
  body        jsonb not null,
  people      int  not null,
  created_at  timestamptz not null default now()
);

-- Check: should list 3 tables and 5 columns.
select 'table' as kind, table_name as name from information_schema.tables
 where table_schema = 'public' and table_name in ('images', 'open_points', 'ai_reports')
union all
select 'column', table_name || '.' || column_name from information_schema.columns
 where table_schema = 'public'
   and (table_name, column_name) in (('focus_topics', 'image_id'), ('topics', 'image_id'),
                                     ('sessions', 'raise_points'), ('sessions', 'point_seq'),
                                     ('live_sessions', 'point_seq'))
order by 1, 2;
