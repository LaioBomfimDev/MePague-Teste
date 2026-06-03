-- Unifica "bloqueado" e "excluido logicamente" como "inativo".
-- Exclusao real de usuario deve acontecer via Supabase Auth deleteUser(..., false).

update public.profiles
set
  status = 'inactive',
  status_reason = case
    when coalesce(status_reason, '') = '' then 'Status antigo normalizado para inativo'
    else status_reason
  end,
  deleted_at = null,
  updated_at = now()
where status in ('blocked', 'deleted')
  or deleted_at is not null;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'active', 'inactive'));
