create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Meu Perfil',
  email text not null default '',
  pix_key text not null default '',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists customers_user_id_created_at_idx on public.customers(user_id, created_at desc);
create index if not exists debts_user_id_created_at_idx on public.debts(user_id, created_at desc);
create index if not exists debts_user_id_customer_id_status_idx on public.debts(user_id, customer_id, status);
create index if not exists payments_user_id_paid_at_idx on public.payments(user_id, paid_at desc);
create index if not exists payments_user_id_debt_id_idx on public.payments(user_id, debt_id);
create index if not exists charge_logs_user_id_created_at_idx on public.charge_logs(user_id, created_at desc);
create index if not exists charge_logs_user_id_customer_id_idx on public.charge_logs(user_id, customer_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Meu Perfil'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.debts enable row level security;
alter table public.payments enable row level security;
alter table public.charge_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
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

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

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
end $$;
