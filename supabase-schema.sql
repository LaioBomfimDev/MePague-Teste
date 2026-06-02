create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Meu Perfil',
  email text not null default '',
  pix_key text not null default '',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  role text not null default 'user' check (role in ('user', 'support', 'operations', 'admin', 'superadmin')),
  status text not null default 'active' check (status in ('pending', 'active', 'inactive', 'blocked', 'deleted')),
  admin_notes text not null default '',
  status_reason text not null default '',
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  add column if not exists status text not null default 'active';

alter table public.profiles
  add column if not exists admin_notes text not null default '';

alter table public.profiles
  add column if not exists status_reason text not null default '';

alter table public.profiles
  add column if not exists status_changed_at timestamptz;

alter table public.profiles
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'support', 'operations', 'admin', 'superadmin'));
alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'active', 'inactive', 'blocked', 'deleted'));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  initials text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  daily_interest numeric(5, 2) not null default 0,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.charge_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_name text not null,
  action text not null check (action in ('copied', 'sent')),
  tone text not null check (tone in ('friendly', 'firm', 'overdue')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminders_enabled boolean not null default false,
  reminder_days_before integer not null default 1 check (reminder_days_before = 1),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text not null default '',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  failed_at timestamptz,
  failure_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule text not null,
  target_date date not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, rule, target_date)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customers_user_id_created_at_idx on public.customers(user_id, created_at desc);
create index if not exists debts_user_id_created_at_idx on public.debts(user_id, created_at desc);
create index if not exists debts_user_id_customer_id_status_idx on public.debts(user_id, customer_id, status);
create index if not exists payments_user_id_paid_at_idx on public.payments(user_id, paid_at desc);
create index if not exists payments_user_id_debt_id_idx on public.payments(user_id, debt_id);
create index if not exists charge_logs_user_id_created_at_idx on public.charge_logs(user_id, created_at desc);
create index if not exists charge_logs_user_id_customer_id_idx on public.charge_logs(user_id, customer_id);
create index if not exists notification_preferences_enabled_idx on public.notification_preferences(daily_reminders_enabled, reminder_days_before);
create index if not exists push_subscriptions_user_id_active_idx on public.push_subscriptions(user_id, is_active);
create index if not exists notification_deliveries_user_id_sent_at_idx on public.notification_deliveries(user_id, sent_at desc);
create index if not exists profiles_status_created_at_idx on public.profiles(status, created_at desc);
create index if not exists profiles_role_status_idx on public.profiles(role, status);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_target_user_id_idx on public.audit_logs(target_user_id);

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

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'superadmin'
      and status = 'active'
  );
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_record_id text;
  changed_user_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_record_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'user_id');

    if tg_table_name = 'profiles' then
      changed_user_id := old.id;
    else
      changed_user_id := old.user_id;
    end if;
  else
    changed_record_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'user_id');

    if tg_table_name = 'profiles' then
      changed_user_id := new.id;
    else
      changed_user_id := new.user_id;
    end if;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    target_user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    coalesce(auth.jwt()->>'email', ''),
    changed_user_id,
    lower(tg_op),
    tg_table_name,
    changed_record_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

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

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.debts enable row level security;
alter table public.payments enable row level security;
alter table public.charge_logs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Superadmins can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own customers" on public.customers;
drop policy if exists "Users can insert own customers" on public.customers;
drop policy if exists "Users can update own customers" on public.customers;
drop policy if exists "Users can delete own customers" on public.customers;
drop policy if exists "Users can read own debts" on public.debts;
drop policy if exists "Users can insert own debts" on public.debts;
drop policy if exists "Users can update own debts" on public.debts;
drop policy if exists "Users can delete own debts" on public.debts;
drop policy if exists "Users can read own payments" on public.payments;
drop policy if exists "Users can insert own payments" on public.payments;
drop policy if exists "Users can update own payments" on public.payments;
drop policy if exists "Users can delete own payments" on public.payments;
drop policy if exists "Users can read own charge logs" on public.charge_logs;
drop policy if exists "Users can insert own charge logs" on public.charge_logs;
drop policy if exists "Users can delete own charge logs" on public.charge_logs;
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can read own notification deliveries" on public.notification_deliveries;
drop policy if exists "Superadmins can read audit logs" on public.audit_logs;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Superadmins can read all profiles"
  on public.profiles for select
  using (public.is_superadmin());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and plan = 'free' and role = 'user' and status = 'active');

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own customers"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "Users can insert own customers"
  on public.customers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own customers"
  on public.customers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own customers"
  on public.customers for delete
  using (auth.uid() = user_id);

create policy "Users can read own debts"
  on public.debts for select
  using (auth.uid() = user_id);

create policy "Users can insert own debts"
  on public.debts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debts"
  on public.debts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own debts"
  on public.debts for delete
  using (auth.uid() = user_id);

create policy "Users can read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own payments"
  on public.payments for delete
  using (auth.uid() = user_id);

create policy "Users can read own charge logs"
  on public.charge_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own charge logs"
  on public.charge_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own charge logs"
  on public.charge_logs for delete
  using (auth.uid() = user_id);

create policy "Users can read own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notification preferences"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);

create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create policy "Users can read own notification deliveries"
  on public.notification_deliveries for select
  using (auth.uid() = user_id);

create policy "Superadmins can read audit logs"
  on public.audit_logs for select
  using (public.is_superadmin());

drop trigger if exists audit_profiles_changes on public.profiles;
drop trigger if exists protect_profile_admin_fields on public.profiles;
drop trigger if exists audit_customers_changes on public.customers;
drop trigger if exists audit_debts_changes on public.debts;
drop trigger if exists audit_payments_changes on public.payments;
drop trigger if exists audit_charge_logs_changes on public.charge_logs;
drop trigger if exists audit_notification_preferences_changes on public.notification_preferences;
drop trigger if exists audit_push_subscriptions_changes on public.push_subscriptions;
drop trigger if exists audit_notification_deliveries_changes on public.notification_deliveries;

create trigger protect_profile_admin_fields
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_fields();

create trigger audit_profiles_changes
  after insert or update or delete on public.profiles
  for each row execute procedure public.audit_row_change();

create trigger audit_customers_changes
  after insert or update or delete on public.customers
  for each row execute procedure public.audit_row_change();

create trigger audit_debts_changes
  after insert or update or delete on public.debts
  for each row execute procedure public.audit_row_change();

create trigger audit_payments_changes
  after insert or update or delete on public.payments
  for each row execute procedure public.audit_row_change();

create trigger audit_charge_logs_changes
  after insert or update or delete on public.charge_logs
  for each row execute procedure public.audit_row_change();

create trigger audit_notification_preferences_changes
  after insert or update or delete on public.notification_preferences
  for each row execute procedure public.audit_row_change();

create trigger audit_push_subscriptions_changes
  after insert or update or delete on public.push_subscriptions
  for each row execute procedure public.audit_row_change();

create trigger audit_notification_deliveries_changes
  after insert or update or delete on public.notification_deliveries
  for each row execute procedure public.audit_row_change();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'debts'
  ) then
    alter publication supabase_realtime add table public.debts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'charge_logs'
  ) then
    alter publication supabase_realtime add table public.charge_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_preferences'
  ) then
    alter publication supabase_realtime add table public.notification_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'push_subscriptions'
  ) then
    alter publication supabase_realtime add table public.push_subscriptions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end $$;
