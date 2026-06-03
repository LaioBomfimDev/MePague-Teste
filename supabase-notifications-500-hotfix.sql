begin;

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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notification_preferences',
    'push_subscriptions',
    'notification_deliveries',
    'customers',
    'debts',
    'payments',
    'charge_logs',
    'audit_logs'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists protect_profile_admin_fields on public.%I', table_name);
    end if;
  end loop;
end $$;

drop trigger if exists protect_profile_admin_fields on public.profiles;

create trigger protect_profile_admin_fields
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_fields();

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

commit;
