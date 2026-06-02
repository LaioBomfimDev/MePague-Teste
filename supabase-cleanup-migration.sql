-- =============================================================
-- Migração de Limpeza: TTL automático de dados antigos
-- Aplicar no Supabase SQL Editor
-- =============================================================

-- Função de limpeza de registros antigos
create or replace function public.cleanup_old_records()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_audit_logs integer;
  deleted_deliveries integer;
  deleted_subscriptions integer;
begin
  -- Deleta audit_logs com mais de 1 ano
  delete from public.audit_logs
  where created_at < now() - interval '1 year';
  get diagnostics deleted_audit_logs = row_count;

  -- Deleta notification_deliveries com mais de 90 dias
  delete from public.notification_deliveries
  where created_at < now() - interval '90 days';
  get diagnostics deleted_deliveries = row_count;

  -- Deleta push_subscriptions inativas com falha há mais de 30 dias
  delete from public.push_subscriptions
  where is_active = false
    and (
      failed_at < now() - interval '30 days'
      or (failed_at is null and updated_at < now() - interval '30 days')
    );
  get diagnostics deleted_subscriptions = row_count;

  return jsonb_build_object(
    'audit_logs_deleted', deleted_audit_logs,
    'deliveries_deleted', deleted_deliveries,
    'subscriptions_deleted', deleted_subscriptions,
    'cleaned_at', now()
  );
end;
$$;

-- Permissão: apenas funções com service role podem chamar diretamente
revoke all on function public.cleanup_old_records() from public, anon, authenticated;
grant execute on function public.cleanup_old_records() to service_role;

-- View para monitorar tamanho das tabelas (útil para decidir quando limpar)
create or replace view public.table_sizes as
select
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
  pg_total_relation_size(schemaname || '.' || tablename) as total_bytes
from pg_tables
where schemaname = 'public'
order by total_bytes desc;

-- Acesso à view apenas para superadmin (via RLS não se aplica a views, então limitamos via função)
-- Para chamar a limpeza manualmente via Supabase SQL Editor:
-- SELECT public.cleanup_old_records();
