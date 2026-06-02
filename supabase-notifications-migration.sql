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

create index if not exists notification_preferences_enabled_idx on public.notification_preferences(daily_reminders_enabled, reminder_days_before);
create index if not exists push_subscriptions_user_id_active_idx on public.push_subscriptions(user_id, is_active);
create index if not exists notification_deliveries_user_id_sent_at_idx on public.notification_deliveries(user_id, sent_at desc);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can read own notification deliveries" on public.notification_deliveries;

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

drop trigger if exists audit_notification_preferences_changes on public.notification_preferences;
drop trigger if exists audit_push_subscriptions_changes on public.push_subscriptions;
drop trigger if exists audit_notification_deliveries_changes on public.notification_deliveries;

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
end $$;
