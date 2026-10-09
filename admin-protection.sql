-- Ejecutar una vez en Supabase antes de activar ISB Admin.
-- La API usa una clave de servidor; los clientes publican únicamente a través de ella.
-- No modifica las políticas de lectura actuales.
begin;
alter table public.picks enable row level security;
drop policy if exists isb_admin_insert_server_only on public.picks;
drop policy if exists isb_admin_update_server_only on public.picks;
drop policy if exists isb_admin_delete_server_only on public.picks;
create policy isb_admin_insert_server_only on public.picks as restrictive
  for insert to anon, authenticated with check (false);
create policy isb_admin_update_server_only on public.picks as restrictive
  for update to anon, authenticated using (false) with check (false);
create policy isb_admin_delete_server_only on public.picks as restrictive
  for delete to anon, authenticated using (false);
commit;
