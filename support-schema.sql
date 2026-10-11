begin;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  customer_name text not null default 'Cliente',
  customer_phone text not null default '',
  subject text not null check (length(subject) between 3 and 120),
  preferred_channel text not null check (preferred_channel in ('portal','email','whatsapp')),
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_role text not null check (author_role in ('customer','admin')),
  body text not null check (length(body) between 1 and 4000),
  channel text not null check (channel in ('portal','email','whatsapp')),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_updated_idx on public.support_tickets(updated_at desc);
create index if not exists support_tickets_customer_idx on public.support_tickets(customer_user_id, updated_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
grant all on public.support_tickets, public.support_messages to service_role;

commit;
