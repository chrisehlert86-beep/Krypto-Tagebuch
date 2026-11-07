create table if not exists public.market_live_prices (
  symbol text primary key check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT')),
  price numeric not null check (price > 0 and price < 1000000000000),
  traded_at timestamptz not null,
  received_at timestamptz not null,
  trade_id bigint not null
);

create table if not exists public.market_price_alerts (
  id uuid primary key,
  owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT')),
  crossing text not null check (crossing in ('above', 'below')),
  price numeric not null check (price > 0 and price < 1000000000000),
  status text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price numeric,
  push_token text check (push_token is null or length(push_token) between 20 and 4096),
  notified_at timestamptz
);

create index if not exists market_price_alert_owner_idx
  on public.market_price_alerts (owner_hash, created_at desc);
create index if not exists market_price_alert_active_idx
  on public.market_price_alerts (symbol) where status = 'active';

alter table public.market_live_prices enable row level security;
alter table public.market_price_alerts enable row level security;
revoke all on public.market_live_prices, public.market_price_alerts from public, anon, authenticated;
grant select, insert, update, delete on public.market_live_prices, public.market_price_alerts to service_role;

comment on table public.market_live_prices is 'Latest native trades from the same live stream used by Hermes alarms.';
comment on table public.market_price_alerts is 'One-shot personal price alarms. Only the server sees hashed installation credentials and push destinations.';
