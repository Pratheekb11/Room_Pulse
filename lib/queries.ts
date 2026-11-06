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
import type { AnswerInput, CreateSessionInput, EditSessionInput, VoteInput } from "./validation";
import { generateCode, generateDashboardKey } from "./code";

// All SQL lives here. Every statement is a parameterised tagged template.

// ---------------------------------------------------------------- public

export async function getSession(code: string): Promise<SessionPayload | null> {
  const rows = (await sql`
    select s.code, s.title, s.scale_max, s.low_label, s.high_label, s.is_open, s.revision,
      coalesce((select json_agg(json_build_object('id', f.id, 'name', f.name, 'kind', f.kind,
                  'chart', coalesce(f.chart, case f.kind when 'poll' then 'bars' when 'words' then 'cloud' else 'heatmap' end))
                  order by f.position)
                from focus_topics f where f.session_id = s.id), '[]'::json) as focus_topics,
      coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'focusId', t.focus_id) order by t.position)
                from topics t where t.session_id = s.id), '[]'::json)   as topics,
      coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name) order by c.position)
                from criteria c where c.session_id = s.id), '[]'::json) as criteria
    from live_sessions s
    where s.code = ${code}
  `) as {
    code: string;
    title: string;
    scale_max: number;
    low_label: string;
    high_label: string;
    is_open: boolean;
    revision: number;
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
      revision: r.revision,
    },
    focusTopics: r.focus_topics,
    topics: r.topics,
    criteria: r.criteria,
  };
}

/** Open/closed state and question revision; `null` when the session does not exist. */
export async function getSessionStatus(code: string): Promise<{ isOpen: boolean; revision: number } | null> {
  const rows = (await sql`select is_open, revision from live_sessions where code = ${code}`) as { is_open: boolean; revision: number }[];
  return rows[0] ? { isOpen: rows[0].is_open, revision: rows[0].revision } : null;
}

/** `null` when the session does not exist. */
export async function getSessionIsOpen(code: string): Promise<boolean | null> {
  const rows = (await sql`select is_open from live_sessions where code = ${code}`) as { is_open: boolean }[];
  return rows[0] ? rows[0].is_open : null;
}

export type VoteOutcome = "ok" | "not_found" | "closed" | "invalid";

export async function saveVote(v: VoteInput): Promise<VoteOutcome> {
  const rows = await sql`
    insert into votes (session_id, topic_id, criterion_id, voter_id, score)
    select s.id, t.id, c.id, ${v.voterId}::uuid, ${v.score}::int
    from live_sessions s
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

/**
 * Live results, only for someone holding the presentation's dashboard key or its signed-in owner.
 * Anyone else gets `null`, exactly like a missing presentation.
 */
export async function getResults(
  code: string,
  access: { dashboardKey?: string | null; ownerId?: string | null },
): Promise<ResultsPayload | null> {
  const key = access.dashboardKey ?? null;
  const owner = access.ownerId ?? null;
  if (!key && !owner) return null;
  const rows = (await sql`
    select s.is_open, s.revision,
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
    from live_sessions s
    where s.code = ${code}
      and (s.dashboard_key = ${key}::text or s.owner_id = ${owner}::uuid)
  `) as {
    is_open: boolean;
    revision: number;
    voter_count: number;
    cells: ResultCell[];
    dist: ScoreBucket[];
    polls: PollCount[];
    words: WordCount[];
  }[];
  const r = rows[0];
  if (!r) return null;
  return { isOpen: r.is_open, voterCount: r.voter_count, cells: r.cells, dist: r.dist, polls: r.polls, words: r.words, revision: r.revision };
}

// ---------------------------------------------------------------- admin

export async function listSessions(ownerId: string): Promise<AdminSessionRow[]> {
  const rows = (await sql`
    select s.code, s.title, s.is_open, s.created_at, s.expires_at, s.dashboard_key,
      (select count(*)::int from focus_topics f where f.session_id = s.id) as focus_count,
      (select count(*)::int from topics t where t.session_id = s.id)   as topic_count,
      (select count(*)::int from criteria c where c.session_id = s.id) as criterion_count,
      coalesce(v.voter_count, 0) as voter_count,
      coalesce(v.total_votes, 0) as total_votes
    from live_sessions s
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
    expires_at: Date | string | null;
    dashboard_key: string;
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
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    focusCount: r.focus_count,
    topicCount: r.topic_count,
    criterionCount: r.criterion_count,
    voterCount: r.voter_count,
    totalVotes: r.total_votes,
    dashboardKey: r.dashboard_key,
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
export async function createSession(
  input: CreateSessionInput,
  ownerId: string,
  expiresInDays: number | null = null,
): Promise<{ code: string; dashboardKey: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const dashboardKey = generateDashboardKey();
    try {
      await sql`
        with s as (
          insert into sessions (code, dashboard_key, title, scale_max, low_label, high_label, owner_id, expires_at)
          values (${code}, ${dashboardKey}, ${input.title}, ${input.scaleMax}, ${input.lowLabel}, ${input.highLabel}, ${ownerId},
                  case when ${expiresInDays}::int is null then null else now() + make_interval(days => ${expiresInDays}::int) end)
          returning id
        ), input as (
          select e.val, e.ord - 1 as pos
          from jsonb_array_elements(${JSON.stringify(input.focusTopics)}::jsonb) with ordinality as e(val, ord)
        ), f as (
          insert into focus_topics (session_id, name, kind, chart, position)
          select s.id, input.val->>'name', input.val->>'kind', input.val->>'chart', input.pos
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
      return { code, dashboardKey };
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
    sql`delete from poll_answers where session_id = (select id from live_sessions where code = ${code})`,
    sql`delete from word_answers where session_id = (select id from live_sessions where code = ${code})`,
    sql`delete from results where session_id = (select id from live_sessions where code = ${code})`,
    sql`delete from votes   where session_id = (select id from live_sessions where code = ${code})`,
  ]);
}

export async function recalculateSession(code: string): Promise<void> {
  await sql`select rebuild_results(id) from live_sessions where code = ${code}`;
}

export async function deleteSession(code: string): Promise<void> {
  await sql.transaction([
    sql`delete from results where session_id = (select id from live_sessions where code = ${code})`,
    sql`delete from votes   where session_id = (select id from live_sessions where code = ${code})`,
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
    from live_sessions s
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
    with s as (select id from live_sessions where code = ${code}),
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
  /** null for guest accounts */
  email: string | null;
}

/** `null` if the email is already registered. */
export async function createUser(email: string, passwordHash: string): Promise<(UserRow & { email: string }) | null> {
  const rows = (await sql`
    insert into users (email, password_hash) values (${email}, ${passwordHash})
    on conflict (email) do nothing
    returning id, email
  `) as (UserRow & { email: string })[];
  return rows[0] ?? null;
}

export async function findUserByEmail(
  email: string,
): Promise<(UserRow & { email: string; passwordHash: string; emailVerified: boolean }) | null> {
  const rows = (await sql`
    select id, email, password_hash, email_verified_at is not null as email_verified from users where email = ${email}
  `) as { id: string; email: string; password_hash: string; email_verified: boolean }[];
  const r = rows[0];
  return r ? { id: r.id, email: r.email, passwordHash: r.password_hash, emailVerified: r.email_verified } : null;
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

export async function extendAuthSessions(userId: string, days: number): Promise<void> {
  await sql`update auth_sessions set expires_at = now() + make_interval(days => ${days}) where user_id = ${userId} and expires_at > now()`;
}

export async function insertAuthSession(tokenHash: string, userId: string, minutes: number): Promise<void> {
  await sql.transaction([
    sql`delete from auth_sessions where user_id = ${userId} and expires_at < now()`,
    sql`insert into auth_sessions (token_hash, user_id, expires_at)
        values (${tokenHash}, ${userId}, now() + make_interval(mins => ${minutes}))`,
  ]);
}

export async function findUserBySessionHash(
  tokenHash: string,
): Promise<(UserRow & { emailVerified: boolean; isGuest: boolean }) | null> {
  const rows = (await sql`
    select u.id, u.email, u.email_verified_at is not null as email_verified, u.is_guest
      from auth_sessions a join users u on u.id = a.user_id
     where a.token_hash = ${tokenHash} and a.expires_at > now()
  `) as { id: string; email: string | null; email_verified: boolean; is_guest: boolean }[];
  const r = rows[0];
  return r ? { id: r.id, email: r.email, emailVerified: r.email_verified, isGuest: r.is_guest } : null;
}

export async function deleteAuthSession(tokenHash: string): Promise<void> {
  await sql`delete from auth_sessions where token_hash = ${tokenHash}`;
}

/** Open/closed state of a session owned by this user; `null` if missing or not theirs. */
export async function getOwnedSessionIsOpen(code: string, ownerId: string): Promise<boolean | null> {
  const rows = (await sql`select is_open from live_sessions where code = ${code} and owner_id = ${ownerId}`) as {
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
      from live_sessions s
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
        from live_sessions s
        join focus_topics f on f.session_id = s.id and f.id = ${a.focusId}::uuid and f.kind = 'words'
        cross join unnest(${a.words}::text[]) with ordinality as u(word, ord)
        where s.code = ${a.code} and s.is_open
        returning 1 as ok`,
      sql`
        select 1 as ok from live_sessions s
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
        from live_sessions s
        join focus_topics f on f.session_id = s.id and f.kind = 'poll'
        join topics t on t.focus_id = f.id
       where s.code = ${code}
      union all
      select f.position, -count(*)::int, f.name, w.word, 'Word', count(*)::int
        from live_sessions s
        join focus_topics f on f.session_id = s.id and f.kind = 'words'
        join word_answers w on w.focus_id = f.id
       where s.code = ${code}
       group by f.position, f.name, w.word
    ) x
    order by fp, tp, label
  `) as { focus: string; label: string; kind: "Poll choice" | "Word"; n: number }[];
  return rows.map((r) => ({ focus: r.focus, label: r.label, kind: r.kind, n: r.n }));
}

// ---------------------------------------------------------------- email links

export type EmailTokenPurpose = "verify" | "reset";

export async function countRecentEmailTokens(userId: string, purpose: EmailTokenPurpose, minutes: number): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n from email_tokens
     where user_id = ${userId} and purpose = ${purpose} and created_at > now() - make_interval(mins => ${minutes})
  `) as { n: number }[];
  return rows[0].n;
}

export async function insertEmailToken(tokenHash: string, userId: string, purpose: EmailTokenPurpose, minutes: number): Promise<void> {
  await sql.transaction([
    sql`delete from email_tokens where user_id = ${userId} and expires_at < now() - interval '1 day'`,
    sql`insert into email_tokens (token_hash, user_id, purpose, expires_at)
        values (${tokenHash}, ${userId}, ${purpose}, now() + make_interval(mins => ${minutes}))`,
  ]);
}

/** Marks a valid, unused, unexpired token as used (atomically). Returns its user, or null. */
export async function consumeEmailToken(tokenHash: string, purpose: EmailTokenPurpose): Promise<UserRow | null> {
  const rows = (await sql`
    update email_tokens t set used_at = now()
      from users u
     where t.token_hash = ${tokenHash} and t.purpose = ${purpose}
       and t.used_at is null and t.expires_at > now() and u.id = t.user_id
    returning u.id, u.email
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await sql`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${userId}`;
}

/**
 * New password: also verifies the email (the link proved ownership), signs out
 * every session, cancels other reset links and clears login lockouts.
 */
export async function resetPassword(userId: string, email: string, passwordHash: string): Promise<void> {
  await sql.transaction([
    sql`update users set password_hash = ${passwordHash}, email_verified_at = coalesce(email_verified_at, now()) where id = ${userId}`,
    sql`delete from auth_sessions where user_id = ${userId}`,
    sql`update email_tokens set used_at = now() where user_id = ${userId} and purpose = 'reset' and used_at is null`,
    sql`delete from login_failures where email = ${email}`,
  ]);
}


// ---------------------------------------------------------------- guests

/** New guest account, or null when the site-wide hourly cap is reached. */
export async function createGuestUser(maxPerHour: number, codeHash: string): Promise<string | null> {
  const rows = (await sql`
    insert into users (is_guest, guest_code_hash)
    select true, ${codeHash}
     where (select count(*) from users where is_guest and created_at > now() - interval '1 hour') < ${maxPerHour}
    returning id
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

export type UpgradeOutcome = "ok" | "email_taken" | "not_guest";

/** Gives a guest account an email and password (keeping its presentations). */
export async function upgradeGuest(userId: string, email: string, passwordHash: string): Promise<UpgradeOutcome> {
  try {
    // Saving the account also keeps its presentations for good.
    const [rows] = await sql.transaction([
      sql`update users set email = ${email}, password_hash = ${passwordHash}, is_guest = false, guest_pin_hash = null, guest_code_hash = null
           where id = ${userId} and is_guest
          returning 1 as ok`,
      sql`update sessions set expires_at = null
           where owner_id = ${userId} and expires_at > now()
             and exists (select 1 from users where id = ${userId} and not is_guest)`,
    ]);
    return rows.length ? "ok" : "not_guest";
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return "email_taken";
    throw err;
  }
}

export async function countOwnedSessions(ownerId: string): Promise<number> {
  const rows = (await sql`select count(*)::int as n from live_sessions where owner_id = ${ownerId}`) as { n: number }[];
  return rows[0].n;
}

/** Deletes expired guest data: expired presentations (with their votes) and old, signed-out guests. */
export async function purgeExpiredGuestData(guestDays: number): Promise<void> {
  await sql.transaction([
    sql`delete from sessions where expires_at < now()`,
    sql`delete from auth_sessions where expires_at < now()`,
    sql`delete from users u
         where u.is_guest and u.created_at < now() - make_interval(days => ${guestDays})
           and not exists (select 1 from auth_sessions a where a.user_id = u.id)`,
  ]);
}

/**
 * The guest account for a guest code's hash, while it's still in use: made in the last
 * `guestDays` days, or still owning a live presentation. Null otherwise.
 */
export async function findGuestByCodeHash(codeHash: string, guestDays: number): Promise<string | null> {
  const rows = (await sql`
    select u.id from users u
     where u.guest_code_hash = ${codeHash} and u.is_guest
       and (u.created_at > now() - make_interval(days => ${guestDays}::int)
            or exists (select 1 from live_sessions s where s.owner_id = u.id))
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------- editing

/** Answers stored per question, option/thing-to-rate and rating scale, for the edit form's warnings. */
export async function getAnswerCounts(code: string, ownerId: string): Promise<{ counts: Record<string, number>; scaleLocked: boolean } | null> {
  const rows = (await sql`
    with s as (select id from live_sessions where code = ${code} and owner_id = ${ownerId}::uuid),
    c as (
      select topic_id as id, count(*)::int as n from votes where session_id = (select id from s) group by topic_id
      union all
      select criterion_id, count(*)::int from votes where session_id = (select id from s) group by criterion_id
      union all
      select topic_id, count(*)::int from poll_answers where session_id = (select id from s) group by topic_id
      union all
      select t.focus_id, count(*)::int from votes v join topics t on t.id = v.topic_id
       where v.session_id = (select id from s) and t.focus_id is not null group by t.focus_id
      union all
      select focus_id, count(*)::int from poll_answers where session_id = (select id from s) group by focus_id
      union all
      select focus_id, count(distinct voter_id)::int from word_answers where session_id = (select id from s) group by focus_id
    )
    select (select count(*) from s)::int as found,
           exists (select 1 from votes where session_id = (select id from s)) as scale_locked,
           coalesce((select json_object_agg(id, n) from (select id, sum(n)::int as n from c group by id) x), '{}'::json) as counts
  `) as { found: number; scale_locked: boolean; counts: Record<string, number> }[];
  const r = rows[0];
  if (!r || !r.found) return null;
  return { counts: r.counts, scaleLocked: r.scale_locked };
}

export type EditOutcome = "ok" | "not_found" | "invalid" | "scale_locked";

/**
 * Replaces a presentation's questions with the edited version. Items that keep their id keep their
 * answers; items left out are deleted with their answers; items without an id are created.
 * A question's type never changes, and the rating scale can't change once ratings exist.
 */
export async function updateSession(code: string, ownerId: string, input: EditSessionInput): Promise<EditOutcome> {
  const current = (await sql`
    select s.id, s.scale_max,
      exists (select 1 from votes v where v.session_id = s.id) as has_ratings,
      coalesce((select json_agg(json_build_object('id', f.id, 'kind', f.kind)) from focus_topics f where f.session_id = s.id), '[]'::json) as focus,
      coalesce((select json_agg(json_build_object('id', t.id, 'focusId', t.focus_id)) from topics t where t.session_id = s.id), '[]'::json) as topics,
      coalesce((select json_agg(c.id) from criteria c where c.session_id = s.id), '[]'::json) as criteria
    from live_sessions s
    where s.code = ${code} and s.owner_id = ${ownerId}::uuid
  `) as {
    id: string;
    scale_max: number;
    has_ratings: boolean;
    focus: { id: string; kind: string }[];
    topics: { id: string; focusId: string | null }[];
    criteria: string[];
  }[];
  const cur = current[0];
  if (!cur) return "not_found";

  // Every id must already belong to this presentation, in the same place, with the same question type.
  const focusKind = new Map(cur.focus.map((f) => [f.id, f.kind]));
  const topicFocus = new Map(cur.topics.map((t) => [t.id, t.focusId]));
  const criteria = new Set(cur.criteria);
  for (const f of input.focusTopics) {
    if (f.id && focusKind.get(f.id) !== f.kind) return "invalid";
    for (const t of f.topics) if (t.id && (!f.id || topicFocus.get(t.id) !== f.id)) return "invalid";
  }
  for (const c of input.criteria) if (c.id && !criteria.has(c.id)) return "invalid";
  if (input.scaleMax !== cur.scale_max && cur.has_ratings) return "scale_locked";

  // New items get their ids here, so topics can point at new questions in the same transaction.
  const focus = input.focusTopics.map((f, pos) => ({ ...f, id: f.id ?? crypto.randomUUID(), isNew: !f.id, pos }));
  const topics = focus.flatMap((f) => f.topics.map((t, i) => ({ id: t.id ?? crypto.randomUUID(), isNew: !t.id, focusId: f.id, name: t.name, pos: f.pos * 100 + i })));
  const crit = input.criteria.map((c, pos) => ({ id: c.id ?? crypto.randomUUID(), isNew: !c.id, name: c.name, pos }));
  const keepFocus = focus.filter((f) => !f.isNew).map((f) => f.id);
  const keepTopics = topics.filter((t) => !t.isNew).map((t) => t.id);
  const keepCriteria = crit.filter((c) => !c.isNew).map((c) => c.id);
  const sid = cur.id;
  const rows = (list: object[]) => JSON.stringify(list);

  await sql.transaction([
    // The scale guard repeats the check, in case a rating arrived since the read above.
    sql`update sessions set title = ${input.title}, low_label = ${input.lowLabel}, high_label = ${input.highLabel},
          scale_max = case when exists (select 1 from votes where session_id = ${sid}::uuid) then scale_max else ${input.scaleMax}::int end,
          revision = revision + 1
        where id = ${sid}::uuid`,
    sql`delete from focus_topics where session_id = ${sid}::uuid and not (id = any(${keepFocus}::uuid[]))`,
    sql`delete from topics where session_id = ${sid}::uuid and not (id = any(${keepTopics}::uuid[]))`,
    sql`delete from criteria where session_id = ${sid}::uuid and not (id = any(${keepCriteria}::uuid[]))`,
    sql`update focus_topics f set name = x.name, chart = x.chart, position = x.pos
        from jsonb_to_recordset(${rows(focus.filter((f) => !f.isNew))}::jsonb) as x(id uuid, name text, chart text, pos int)
        where f.id = x.id and f.session_id = ${sid}::uuid`,
    sql`insert into focus_topics (id, session_id, name, kind, chart, position)
        select x.id, ${sid}::uuid, x.name, x.kind, x.chart, x.pos
        from jsonb_to_recordset(${rows(focus.filter((f) => f.isNew))}::jsonb) as x(id uuid, name text, kind text, chart text, pos int)`,
    sql`update topics t set name = x.name, position = x.pos
        from jsonb_to_recordset(${rows(topics.filter((t) => !t.isNew))}::jsonb) as x(id uuid, name text, pos int)
        where t.id = x.id and t.session_id = ${sid}::uuid`,
    sql`insert into topics (id, session_id, focus_id, name, position)
        select x.id, ${sid}::uuid, x."focusId", x.name, x.pos
        from jsonb_to_recordset(${rows(topics.filter((t) => t.isNew))}::jsonb) as x(id uuid, "focusId" uuid, name text, pos int)`,
    sql`update criteria c set name = x.name, position = x.pos
        from jsonb_to_recordset(${rows(crit.filter((c) => !c.isNew))}::jsonb) as x(id uuid, name text, pos int)
        where c.id = x.id and c.session_id = ${sid}::uuid`,
    sql`insert into criteria (id, session_id, name, position)
        select x.id, ${sid}::uuid, x.name, x.pos
        from jsonb_to_recordset(${rows(crit.filter((c) => c.isNew))}::jsonb) as x(id uuid, name text, pos int)`,
  ]);
  return "ok";
}
