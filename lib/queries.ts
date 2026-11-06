import "server-only";
import { sql } from "./db";
import type {
  AdminSessionRow,
  NamedItem,
  ResultCell,
  ResultsPayload,
  ScoreBucket,
  SessionPayload,
} from "./types";
import type { CreateSessionInput, VoteInput } from "./validation";
import { generateCode } from "./code";

// All SQL lives here. Every statement is a parameterised tagged template.

// ---------------------------------------------------------------- public

export async function getSession(code: string): Promise<SessionPayload | null> {
  const rows = (await sql`
    select s.code, s.title, s.scale_max, s.low_label, s.high_label, s.is_open,
      coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name) order by t.position)
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
    topics: NamedItem[];
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
    where s.code = ${v.code}
      and s.is_open
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
      (select count(distinct v.voter_id)::int from votes v where v.session_id = s.id) as voter_count,
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
                       group by v.topic_id, v.criterion_id, v.score) d), '[]'::json) as dist
    from sessions s
    where s.code = ${code}
  `) as { is_open: boolean; voter_count: number; cells: ResultCell[]; dist: ScoreBucket[] }[];
  const r = rows[0];
  if (!r) return null;
  return { isOpen: r.is_open, voterCount: r.voter_count, cells: r.cells, dist: r.dist };
}

// ---------------------------------------------------------------- admin

export async function listSessions(): Promise<AdminSessionRow[]> {
  const rows = (await sql`
    select s.code, s.title, s.is_open, s.created_at,
      (select count(*)::int from topics t where t.session_id = s.id)   as topic_count,
      (select count(*)::int from criteria c where c.session_id = s.id) as criterion_count,
      coalesce(v.voter_count, 0) as voter_count,
      coalesce(v.total_votes, 0) as total_votes
    from sessions s
    left join (
      select session_id, count(distinct voter_id)::int as voter_count, count(*)::int as total_votes
        from votes
       group by session_id
    ) v on v.session_id = s.id
    order by s.created_at desc
  `) as {
    code: string;
    title: string;
    is_open: boolean;
    created_at: Date | string;
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

/** Creates session + topics + criteria in one atomic statement; retries on code collision. */
export async function createSession(input: CreateSessionInput): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await sql`
        with s as (
          insert into sessions (code, title, scale_max, low_label, high_label)
          values (${code}, ${input.title}, ${input.scaleMax}, ${input.lowLabel}, ${input.highLabel})
          returning id
        ), t as (
          insert into topics (session_id, name, position)
          select s.id, u.name, u.ord - 1
          from s, unnest(${input.topics}::text[]) with ordinality as u(name, ord)
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
  topic: string;
  criterion: string;
  n: number;
  sum: number;
  topicPosition: number;
}

/** Every topic × criterion (including ones with no votes), in display order. */
export async function getSummaryRows(code: string): Promise<SummaryRow[]> {
  const rows = (await sql`
    select t.name as topic, c.name as criterion, t.position as topic_position,
           coalesce(r.vote_count, 0) as n, coalesce(r.score_sum, 0) as sum
    from sessions s
    join topics t   on t.session_id = s.id
    join criteria c on c.session_id = s.id
    left join results r
      on r.session_id = s.id and r.topic_id = t.id and r.criterion_id = c.id
    where s.code = ${code}
    order by t.position, c.position
  `) as { topic: string; criterion: string; topic_position: number; n: number; sum: number }[];
  return rows.map((r) => ({
    topic: r.topic,
    criterion: r.criterion,
    n: r.n,
    sum: r.sum,
    topicPosition: r.topic_position,
  }));
}

export interface RawRow {
  respondent: string;
  topic: string;
  criterion: string;
  score: number;
  updatedAt: string;
}

/** Raw votes with voter ids replaced by R1, R2, … (ordered by each voter's first vote). */
export async function getRawRows(code: string): Promise<RawRow[]> {
  const rows = (await sql`
    with s as (select id from sessions where code = ${code}),
    firsts as (
      select v.voter_id, min(v.created_at) as first_at
        from votes v join s on v.session_id = s.id
       group by v.voter_id
    ),
    numbered as (
      select voter_id, row_number() over (order by first_at, voter_id) as rn from firsts
    )
    select 'R' || nb.rn as respondent, t.name as topic, c.name as criterion,
           v.score, v.updated_at
      from votes v
      join s on v.session_id = s.id
      join numbered nb on nb.voter_id = v.voter_id
      join topics t    on t.id = v.topic_id
      join criteria c  on c.id = v.criterion_id
     order by nb.rn, t.position, c.position
  `) as { respondent: string; topic: string; criterion: string; score: number; updated_at: Date | string }[];
  return rows.map((r) => ({
    respondent: r.respondent,
    topic: r.topic,
    criterion: r.criterion,
    score: r.score,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}
