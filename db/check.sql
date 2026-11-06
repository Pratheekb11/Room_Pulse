select session_id, topic_id, criterion_id, r.vote_count, r.score_sum, v.n, v.s
from results r
full join (
  select session_id, topic_id, criterion_id, count(*)::int as n, sum(score)::int as s
  from votes
  group by session_id, topic_id, criterion_id
) v using (session_id, topic_id, criterion_id)
where coalesce(r.vote_count, 0) <> coalesce(v.n, 0)
   or coalesce(r.score_sum, 0)  <> coalesce(v.s, 0);
