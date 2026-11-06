import "server-only";
import { sql } from "./db";
import type {
  AdminSessionRow,
  NamedItem,
  ResultCell,
  ResultsPayload,
  ScoreBucket,
  FocusItem,
  PollCount,
  SessionPayload,
  TopicItem,
  WordCount,
} from "./types";
import type { AnswerInput, CreateSessionInput, VoteInput } from "./validation";
import { generateCode } from "./code";

// All SQL lives here. Every statement is a parameterised tagged template.

// ---------------------------------------------------------------- public

export async function getSession(code: string): Promise<SessionPayload | null> {
  const rows = (await sql`
    select s.code, s.title, s.scale_max, s.low_label, s.high_label, s.is_open,
      coalesce((select json_agg(json_build_object('id', f.id, 'name', f.name, 'kind', f.kind) order by f.position)
                from focus_topics f where f.session_id = s.id), '[]'::json) as focus_topics,
      coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'focusId', t.focus_id) order by t.position)
                from topics t where t.session_id = s.id), '[]'::json)   as topics,
      coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name) order by c.position)
                from criteria c where c.session_id = s.id), '[]'::json) as criteria
    from sessions s
    where s.code = ${code}
  `) as {
    code: string;
    title: string;
    scale_max: number;
    low_label: string;
    high_label: string;
    is_open: boolean;
    focus_topics: FocusItem[];
    topics: TopicItem[];
    criteria: NamedItem[];
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    session: {
      code: r.code,
      title: r.title,
      scaleMax: r.scale_max,
      lowLabel: r.low_label,
      highLabel: r.high_label,
      isOpen: r.is_open,
    },
    focusTopics: r.focus_topics,
    topics: r.topics,
    criteria: r.criteria,
  };
}

/** `null` when the session does not exist. */
export async function getSessionIsOpen(code: string): Promise<boolean | null> {
  const rows = (await sql`select is_open from sessions where code = ${code}`) as { is_open: boolean }[];
  return rows[0] ? rows[0].is_open : null;
}

export type VoteOutcome = "ok" | "not_found" | "closed" | "invalid";

export async function saveVote(v: VoteInput): Promise<VoteOutcome> {
  const rows = await sql`
    insert into votes (session_id, topic_id, criterion_id, voter_id, score)
    select s.id, t.id, c.id, ${v.voterId}::uuid, ${v.score}::int
    from sessions s
    join topics   t on t.session_id = s.id and t.id = ${v.topicId}::uuid
    join criteria c on c.session_id = s.id and c.id = ${v.criterionId}::uuid
    left join focus_topics f on f.id = t.focus_id
    where s.code = ${v.code}
      and s.is_open
      and coalesce(f.kind, 'rating') = 'rating'
      and ${v.score}::int between 1 and s.scale_max
    on conflict (session_id, topic_id, criterion_id, voter_id)
    do update set score = excluded.score, updated_at = now()
    returning 1 as ok
  `;
  if (rows.length > 0) return "ok";

  // Nothing written: work out why with one diagnostic read.
  const isOpen = await getSessionIsOpen(v.code);
  if (isOpen === null) return "not_found";
  if (!isOpen) return "closed";
  return "invalid";
}

export async function getResults(code: string): Promise<ResultsPayload | null> {
  const rows = (await sql`
    select s.is_open,
      (select count(*)::int from (
          select voter_id from votes where session_id = s.id
          union select voter_id from poll_answers where session_id = s.id
          union select voter_id from word_answers where session_id = s.id) u) as voter_count,
      coalesce((select json_agg(json_build_object(
                  'topicId', r.topic_id, 'criterionId', r.criterion_id,
                  'n', r.vote_count, 'sum', r.score_sum))
                from results r
                where r.session_id = s.id and r.vote_count > 0), '[]'::json) as cells,
      coalesce((select json_agg(json_build_object(
                  'topicId', d.topic_id, 'criterionId', d.criterion_id,
                  'score', d.score, 'n', d.n))
                from (select v.topic_id, v.criterion_id, v.score, count(*)::int as n
                        from votes v
                       where v.session_id = s.id
                       group by v.topic_id, v.criterion_id, v.score) d), '[]'::json) as dist,
      coalesce((select json_agg(json_build_object('focusId', p.focus_id, 'topicId', p.topic_id, 'n', p.n))
                from (select focus_id, topic_id, count(*)::int as n
                        from poll_answers where session_id = s.id
                       group by focus_id, topic_id) p), '[]'::json) as polls,
      coalesce((select json_agg(json_build_object('focusId', w.focus_id, 'word', w.word, 'n', w.n)
                                order by w.n desc, w.word)
                from (select focus_id, word, count(*)::int as n,
                             row_number() over (partition by focus_id order by count(*) desc, word) as rk
                        from word_answers where session_id = s.id
                       group by focus_id, word) w
               where w.rk <= 80), '[]'::json) as words
    from sessions s
    where s.code = ${code}
  `) as {
    is_open: boolean;
    voter_count: number;
    cells: ResultCell[];
    dist: ScoreBucket[];
    polls: PollCount[];
    words: WordCount[];
  }[];
  const r = rows[0];
  if (!r) return null;
  return { isOpen: r.is_open, voterCount: r.voter_count, cells: r.cells, dist: r.dist, polls: r.polls, words: r.words };
}

// ---------------------------------------------------------------- admin

export async function listSessions(ownerId: string): Promise<AdminSessionRow[]> {
  const rows = (await sql`
    select s.code, s.title, s.is_open, s.created_at,
      (select count(*)::int from focus_topics f where f.session_id = s.id) as focus_count,
      (select count(*)::int from topics t where t.session_id = s.id)   as topic_count,
      (select count(*)::int from criteria c where c.session_id = s.id) as criterion_count,
      coalesce(v.voter_count, 0) as voter_count,
      coalesce(v.total_votes, 0) as total_votes
    from sessions s
    left join (
      select session_id, count(distinct voter_id)::int as voter_count, count(*)::int as total_votes
        from (select session_id, voter_id from votes
              union all select session_id, voter_id from poll_answers
              union all select session_id, voter_id from word_answers) a
       group by session_id
    ) v on v.session_id = s.id
    where s.owner_id = ${ownerId}
    order by s.created_at desc
  `) as {
    code: string;
    title: string;
    is_open: boolean;
    created_at: Date | string;
    focus_count: number;
    topic_count: number;
    criterion_count: number;
    voter_count: number;
    total_votes: number;
  }[];
  return rows.map((r) => ({
    code: r.code,
    title: r.title,
    isOpen: r.is_open,
    createdAt: new Date(r.created_at).toISOString(),
    focusCount: r.focus_count,
    topicCount: r.topic_count,
    criterionCount: r.criterion_count,
    voterCount: r.voter_count,
    totalVotes: r.total_votes,
  }));
}

function isCodeCollision(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; message?: string };
  return e?.code === "23505" && (e.constraint ? e.constraint.includes("code") : true);
}

/**
 * Creates session + focus topics + topics + criteria in one atomic statement;
 * retries on code collision. Topic positions are global (focus position × 100 + index)
 * so ordering by topics.position keeps focus topics together.
 */
export async function createSession(input: CreateSessionInput, ownerId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await sql`
        with s as (
          insert into sessions (code, title, scale_max, low_label, high_label, owner_id)
          values (${code}, ${input.title}, ${input.scaleMax}, ${input.lowLabel}, ${input.highLabel}, ${ownerId})
          returning id
        ), input as (
          select e.val, e.ord - 1 as pos
          from jsonb_array_elements(${JSON.stringify(input.focusTopics)}::jsonb) with ordinality as e(val, ord)
        ), f as (
          insert into focus_topics (session_id, name, kind, position)
          select s.id, input.val->>'name', input.val->>'kind', input.pos
          from s, input
          returning id, position
        ), t as (
          insert into topics (session_id, focus_id, name, position)
          select s.id, f.id, tt.name, f.position * 100 + tt.ord - 1
          from s
          join f on true
          join input on input.pos = f.position
          cross join lateral jsonb_array_elements_text(input.val->'topics') with ordinality as tt(name, ord)
          returning 1
        )
        insert into criteria (session_id, name, position)
        select s.id, u.name, u.ord - 1
        from s, unnest(${input.criteria}::text[]) with ordinality as u(name, ord)
      `;
      return code;
    } catch (err) {
      if (isCodeCollision(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique session code");
}

/** `false` when the session does not exist. */
export async function setSessionOpen(code: string, isOpen: boolean): Promise<boolean> {
  const rows = await sql`update sessions set is_open = ${isOpen} where code = ${code} returning 1 as ok`;
  return rows.length > 0;
}

export async function resetSession(code: string): Promise<void> {
  await sql.transaction([
    sql`delete from poll_answers where session_id = (select id from sessions where code = ${code})`,
    sql`delete from word_answers where session_id = (select id from sessions where code = ${code})`,
    sql`delete from results where session_id = (select id from sessions where code = ${code})`,
    sql`delete from votes   where session_id = (select id from sessions where code = ${code})`,
  ]);
}

export async function recalculateSession(code: string): Promise<void> {
  await sql`select rebuild_results(id) from sessions where code = ${code}`;
}

export async function deleteSession(code: string): Promise<void> {
  await sql.transaction([
    sql`delete from results where session_id = (select id from sessions where code = ${code})`,
    sql`delete from votes   where session_id = (select id from sessions where code = ${code})`,
    sql`delete from sessions where code = ${code}`,
  ]);
}

export interface SummaryRow {
  focus: string;
  topic: string;
  criterion: string;
  n: number;
  sum: number;
  topicPosition: number;
}

/** Every topic × criterion (including ones with no votes), in display order. */
export async function getSummaryRows(code: string): Promise<SummaryRow[]> {
  const rows = (await sql`
    select coalesce(f.name, '') as focus, t.name as topic, c.name as criterion, t.position as topic_position,
           coalesce(r.vote_count, 0) as n, coalesce(r.score_sum, 0) as sum
    from sessions s
    join topics t   on t.session_id = s.id
    left join focus_topics f on f.id = t.focus_id
    join criteria c on c.session_id = s.id
    left join results r
      on r.session_id = s.id and r.topic_id = t.id and r.criterion_id = c.id
    where s.code = ${code}
      and coalesce(f.kind, 'rating') = 'rating'
    order by t.position, c.position
  `) as { focus: string; topic: string; criterion: string; topic_position: number; n: number; sum: number }[];
  return rows.map((r) => ({
    focus: r.focus,
    topic: r.topic,
    criterion: r.criterion,
    n: r.n,
    sum: r.sum,
    topicPosition: r.topic_position,
  }));
}

export interface RawRow {
  respondent: string;
  focus: string;
  topic: string;
  criterion: string;
  /** Rating score as text; empty for poll choices and words. */
  score: string;
  updatedAt: string;
}

/**
 * Every answer (ratings, poll choices, words) with voter ids replaced by R1, R2, …
 * numbered by each person's first answer of any type.
 */
export async function getRawRows(code: string): Promise<RawRow[]> {
  const rows = (await sql`
    with s as (select id from sessions where code = ${code}),
    answers as (
      select v.voter_id, v.created_at, v.updated_at,
             coalesce(f.position, -1) as fp, t.position as tp, c.position as cp,
             coalesce(f.name, '') as focus, t.name as topic, c.name as criterion, v.score::text as score
        from votes v
        join s on v.session_id = s.id
        join topics t on t.id = v.topic_id
        left join focus_topics f on f.id = t.focus_id
        join criteria c on c.id = v.criterion_id
      union all
      select p.voter_id, p.created_at, p.updated_at, f.position, t.position, 0,
             f.name, t.name, 'Poll choice', ''
        from poll_answers p
        join s on p.session_id = s.id
        join focus_topics f on f.id = p.focus_id
        join topics t on t.id = p.topic_id
      union all
      select w.voter_id, w.created_at, w.created_at, f.position, 0, w.slot,
             f.name, w.word, 'Word', ''
        from word_answers w
        join s on w.session_id = s.id
        join focus_topics f on f.id = w.focus_id
    ),
    firsts as (select voter_id, min(created_at) as first_at from answers group by voter_id),
    numbered as (select voter_id, row_number() over (order by first_at, voter_id) as rn from firsts)
    select 'R' || nb.rn as respondent, a.focus, a.topic, a.criterion, a.score, a.updated_at
      from answers a
      join numbered nb on nb.voter_id = a.voter_id
     order by nb.rn, a.fp, a.tp, a.cp
  `) as { respondent: string; focus: string; topic: string; criterion: string; score: string; updated_at: Date | string }[];
  return rows.map((r) => ({
    respondent: r.respondent,
    focus: r.focus,
    topic: r.topic,
    criterion: r.criterion,
    score: r.score,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

// ---------------------------------------------------------------- accounts

export interface UserRow {
  id: string;
  email: string;
}

/** `null` if the email is already registered. */
export async function createUser(email: string, passwordHash: string): Promise<UserRow | null> {
  const rows = (await sql`
    insert into users (email, password_hash) values (${email}, ${passwordHash})
    on conflict (email) do nothing
    returning id, email
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<(UserRow & { passwordHash: string }) | null> {
  const rows = (await sql`select id, email, password_hash from users where email = ${email}`) as {
    id: string;
    email: string;
    password_hash: string;
  }[];
  const r = rows[0];
  return r ? { id: r.id, email: r.email, passwordHash: r.password_hash } : null;
}

export async function countRecentLoginFailures(email: string, windowMinutes: number): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n from login_failures
     where email = ${email} and at > now() - make_interval(mins => ${windowMinutes})
  `) as { n: number }[];
  return rows[0].n;
}

export async function recordLoginFailure(email: string): Promise<void> {
  await sql.transaction([
    sql`insert into login_failures (email) values (${email})`,
    sql`delete from login_failures where at < now() - interval '1 day'`,
  ]);
}

export async function clearLoginFailures(email: string): Promise<void> {
  await sql`delete from login_failures where email = ${email}`;
}

export async function insertAuthSession(tokenHash: string, userId: string, days: number): Promise<void> {
  await sql.transaction([
    sql`delete from auth_sessions where user_id = ${userId} and expires_at < now()`,
    sql`insert into auth_sessions (token_hash, user_id, expires_at)
        values (${tokenHash}, ${userId}, now() + make_interval(days => ${days}))`,
  ]);
}

export async function findUserBySessionHash(tokenHash: string): Promise<UserRow | null> {
  const rows = (await sql`
    select u.id, u.email
      from auth_sessions a join users u on u.id = a.user_id
     where a.token_hash = ${tokenHash} and a.expires_at > now()
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function deleteAuthSession(tokenHash: string): Promise<void> {
  await sql`delete from auth_sessions where token_hash = ${tokenHash}`;
}

/** Open/closed state of a session owned by this user; `null` if missing or not theirs. */
export async function getOwnedSessionIsOpen(code: string, ownerId: string): Promise<boolean | null> {
  const rows = (await sql`select is_open from sessions where code = ${code} and owner_id = ${ownerId}`) as {
    is_open: boolean;
  }[];
  return rows[0] ? rows[0].is_open : null;
}

// ---------------------------------------------------------------- polls & word clouds

export type AnswerOutcome = VoteOutcome;

/** Saves a poll choice or a voter's word-cloud answers (replacing earlier ones). */
export async function saveAnswer(a: AnswerInput): Promise<AnswerOutcome> {
  let saved: boolean;
  if (a.kind === "poll") {
    const rows = await sql`
      insert into poll_answers (session_id, focus_id, voter_id, topic_id)
      select s.id, f.id, ${a.voterId}::uuid, t.id
      from sessions s
      join focus_topics f on f.session_id = s.id and f.id = ${a.focusId}::uuid and f.kind = 'poll'
      join topics t on t.focus_id = f.id and t.id = ${a.topicId}::uuid
      where s.code = ${a.code} and s.is_open
      on conflict (focus_id, voter_id) do update set topic_id = excluded.topic_id, updated_at = now()
      returning 1 as ok
    `;
    saved = rows.length > 0;
  } else {
    // Both statements check the same conditions, so either both apply or neither does.
    const [, inserted, allowed] = await sql.transaction([
      sql`
        delete from word_answers w
        using sessions s, focus_topics f
        where w.focus_id = f.id and f.session_id = s.id and f.kind = 'words' and s.is_open
          and s.code = ${a.code} and f.id = ${a.focusId}::uuid and w.voter_id = ${a.voterId}::uuid`,
      sql`
        insert into word_answers (session_id, focus_id, voter_id, slot, word)
        select s.id, f.id, ${a.voterId}::uuid, u.ord, u.word
        from sessions s
        join focus_topics f on f.session_id = s.id and f.id = ${a.focusId}::uuid and f.kind = 'words'
        cross join unnest(${a.words}::text[]) with ordinality as u(word, ord)
        where s.code = ${a.code} and s.is_open
        returning 1 as ok`,
      sql`
        select 1 as ok from sessions s
        join focus_topics f on f.session_id = s.id and f.id = ${a.focusId}::uuid and f.kind = 'words'
        where s.code = ${a.code} and s.is_open`,
    ]);
    saved = allowed.length > 0 && inserted.length === a.words.length;
  }
  if (saved) return "ok";
  const isOpen = await getSessionIsOpen(a.code);
  if (isOpen === null) return "not_found";
  if (!isOpen) return "closed";
  return "invalid";
}

export interface ChoiceSummaryRow {
  focus: string;
  label: string;
  kind: "Poll choice" | "Word";
  n: number;
}

/** Poll option counts (including options nobody picked) and word counts, in display order. */
export async function getChoiceSummaryRows(code: string): Promise<ChoiceSummaryRow[]> {
  const rows = (await sql`
    select * from (
      select f.position as fp, t.position as tp, f.name as focus, t.name as label, 'Poll choice' as kind,
             (select count(*)::int from poll_answers p where p.topic_id = t.id) as n
        from sessions s
        join focus_topics f on f.session_id = s.id and f.kind = 'poll'
        join topics t on t.focus_id = f.id
       where s.code = ${code}
      union all
      select f.position, -count(*)::int, f.name, w.word, 'Word', count(*)::int
        from sessions s
        join focus_topics f on f.session_id = s.id and f.kind = 'words'
        join word_answers w on w.focus_id = f.id
       where s.code = ${code}
       group by f.position, f.name, w.word
    ) x
    order by fp, tp, label
  `) as { focus: string; label: string; kind: "Poll choice" | "Word"; n: number }[];
  return rows.map((r) => ({ focus: r.focus, label: r.label, kind: r.kind, n: r.n }));
}
