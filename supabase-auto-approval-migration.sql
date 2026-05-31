-- Migra o fluxo de cadastro para autoativacao.
-- Rode uma vez no SQL Editor do Supabase em projetos que ainda usam aprovacao manual.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Meu Perfil'),
    coalesce(new.email, ''),
    'user',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles
  alter column status set default 'active';

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.id then
    new.plan := 'free';
    new.role := 'user';
    new.status := 'active';
    new.admin_notes := '';
    new.status_reason := '';
    new.status_changed_at := null;
    new.status_changed_by := null;
    new.deleted_at := null;
  end if;

  if tg_op = 'UPDATE' and auth.uid() = new.id then
    new.email := old.email;
    new.plan := old.plan;
    new.role := old.role;
    new.status := old.status;
    new.admin_notes := old.admin_notes;
    new.status_reason := old.status_reason;
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
    new.deleted_at := old.deleted_at;
  end if;

  return new;
end;
$$;

drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and plan = 'free' and role = 'user' and status = 'active');

update public.profiles
set
  status = 'active',
  status_reason = case
    when coalesce(status_reason, '') = '' then 'Ativacao automatica de cadastro pendente'
    else status_reason
  end,
  status_changed_at = coalesce(status_changed_at, now()),
  status_changed_by = null,
  updated_at = now()
where status = 'pending'
  and role = 'user'
  and deleted_at is null;
