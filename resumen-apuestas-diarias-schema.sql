begin;
create table if not exists public.resumen_apuestas_diarias (
  fecha date not null,
  paquete text not null check (paquete in ('Premium','Exclusiva','Económica','Champions League Completa')),
  cuota text not null default '',
  monto_apostado numeric(12,2) not null default 0 check (monto_apostado >= 0),
  estado text not null check (estado in ('ganado','perdido','pendiente','no_enviado')),
  ganancia_neta numeric(12,2) not null default 0,
  retorno_total numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key(fecha,paquete)
);
alter table public.resumen_apuestas_diarias enable row level security;
revoke all on public.resumen_apuestas_diarias from anon, authenticated;
grant all on public.resumen_apuestas_diarias to service_role;
commit;
