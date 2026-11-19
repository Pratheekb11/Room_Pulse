-- 2026-11-19: the Quiet slide design (lib/themes.ts), the default for new presentations.
-- Run on production BEFORE the code ships (node scripts/run-sql.mjs db/2026-11-19-quiet-design.sql):
-- until then, creating a presentation in Quiet is refused by the old check.
-- Only widens the list of allowed designs; existing presentations are untouched.
alter table sessions drop constraint if exists sessions_theme_check;
alter table sessions add constraint sessions_theme_check
  check (theme in ('quiet', 'paper', 'mono', 'harbour', 'forest', 'blush', 'pop', 'anime', 'chalk', 'midnight', 'neon', 'arcade'));
