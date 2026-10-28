create table if not exists public.market_analysis_current (
  symbol text primary key,
  generated_at timestamptz not null,
  run_id text not null,
  analysis_mode text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint market_analysis_symbol_format
    check (symbol ~ '^[A-Z0-9]{3,20}$'),
  constraint market_analysis_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists market_analysis_generated_at_idx
  on public.market_analysis_current (generated_at desc);

alter table public.market_analysis_current enable row level security;

revoke all on table public.market_analysis_current from public, anon, authenticated;
grant select, insert, update, delete on table public.market_analysis_current to service_role;

comment on table public.market_analysis_current is
  'Sanitized current market analysis DTOs published by the Geekom analysis service.';
