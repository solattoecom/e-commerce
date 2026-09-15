CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  action text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON auth_rate_limits (ip, action, attempted_at);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
