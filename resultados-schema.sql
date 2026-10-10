begin;
create table if not exists public.resultados (
 fecha date not null,
 categoria text not null check (categoria in ('Premium','Exclusiva','Pack Mensual','Económica')),
 texto text not null default '' check (length(texto)<=1000),
 estado text not null check (estado in ('ganado','perdido','pendiente','sin_pick')),
 updated_at timestamptz not null default now(),
 primary key(fecha,categoria)
);
alter table public.resultados enable row level security;
revoke all on public.resultados from anon,authenticated;
grant all on public.resultados to service_role;
commit;
