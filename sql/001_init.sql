-- Apps/services you host
create table if not exists apps (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  repo_url text,
  public_url text,
  created_at timestamptz not null default now()
);

-- Deployment records
create table if not exists deployments (
  id bigserial primary key,
  app_id bigint not null references apps(id) on delete cascade,
  environment text not null default 'prod',
  version text,
  note text,
  deployed_by text,
  deployed_at timestamptz not null default now()
);

-- Usage events (hits)
create table if not exists usage_events (
  id bigserial primary key,
  app_id bigint not null references apps(id) on delete cascade,
  ts timestamptz not null default now(),
  kind text not null default 'request',
  method text,
  path text,
  status int,
  ip inet,
  user_agent text
);

create index if not exists idx_usage_app_ts on usage_events(app_id, ts desc);
create index if not exists idx_deploy_app_time on deployments(app_id, deployed_at desc);
