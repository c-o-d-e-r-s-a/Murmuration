-- Tiger Data mirror (DATA_SCHEMA §8). Run once from the Tiger SQL editor or psql.

-- one row per Creator choice; time = round.startsAt + t_ms
CREATE TABLE round_events (
  time         timestamptz NOT NULL,
  session_code text        NOT NULL,
  round_id     text        NOT NULL,
  role         text        NOT NULL,      -- palette | form | motion | texture | mood
  option_id    text        NOT NULL,
  uid_hash     text        NOT NULL,      -- first 8 hex of sha256(uid); never a nickname
  t_ms         integer     NOT NULL,      -- ms since startsAt
  UNIQUE (session_code, round_id, t_ms, role, time)  -- hypertable unique keys must include time
) WITH (tsdb.hypertable);                 -- if this errors: drop WITH, then SELECT create_hypertable('round_events', 'time');

-- one row per archived round
CREATE TABLE rounds (
  session_code text        NOT NULL,
  round_id     text        NOT NULL,
  scene_id     text        NOT NULL,
  prompt_id    text,
  duration_ms  integer     NOT NULL,
  creators     smallint    NOT NULL,      -- filled slots (3-5)
  author       numeric(4,1),
  ai           numeric(4,1),
  audience     numeric(4,1),
  combined     numeric(4,1),
  locked_at    timestamptz NOT NULL,
  PRIMARY KEY (session_code, round_id)
);

-- choices per 10 s bucket per role, auto-refreshed; feeds the /host pulse panel
CREATE MATERIALIZED VIEW choices_10s
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('10 seconds', time) AS bucket, session_code, role, count(*) AS n
FROM round_events
GROUP BY bucket, session_code, role
WITH NO DATA;

SELECT add_continuous_aggregate_policy('choices_10s',
  start_offset => INTERVAL '1 hour', end_offset => INTERVAL '10 seconds', schedule_interval => INTERVAL '10 seconds');
