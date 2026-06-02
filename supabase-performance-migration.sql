-- =============================================================
-- Migração de Performance: Índice para consulta do cron diário
-- Aplicar no Supabase SQL Editor
-- =============================================================

-- Índice para a query do daily-reminders:
-- SELECT * FROM debts WHERE status = 'open' AND due_date = 'YYYY-MM-DD'
create index if not exists debts_status_due_date_idx
  on public.debts(status, due_date);

-- Índice adicional para busca de pagamentos por debt (usado no cálculo de saldo)
create index if not exists payments_debt_id_idx
  on public.payments(debt_id);

-- Índice para push subscriptions ativas por usuário (usado no cron e no endpoint)
create index if not exists push_subscriptions_user_active_seen_idx
  on public.push_subscriptions(user_id, is_active, last_seen_at desc)
  where is_active = true;

-- Índice para notification_deliveries (busca de deduplicação)
create index if not exists notification_deliveries_rule_date_idx
  on public.notification_deliveries(rule, target_date);
