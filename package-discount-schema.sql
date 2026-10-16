-- Global 30% package promotion. The table is private; only server-side code uses the service key.
create table if not exists public.isb_site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.isb_site_settings enable row level security;
revoke all on public.isb_site_settings from anon, authenticated;
grant select, insert, update, delete on public.isb_site_settings to service_role;

insert into public.isb_site_settings (key, value)
values ('package_discount', '{"active":false,"percent":30}'::jsonb)
on conflict (key) do nothing;

