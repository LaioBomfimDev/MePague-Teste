-- =============================================================
-- Migração de Pagamento Atômico: RPC para evitar race condition
-- Aplicar no Supabase SQL Editor
-- =============================================================

-- Função atômica de registro de pagamento
-- Usa SELECT FOR UPDATE para garantir que dois pagamentos simultâneos
-- não causem inconsistência no status da dívida.
create or replace function public.record_payment_atomic(
  p_debt_id uuid,
  p_user_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt record;
  v_paid_total numeric;
  v_outstanding numeric;
  v_next_status text;
  v_payment_id uuid;
  v_now timestamptz := now();
begin
  -- Bloqueia a linha da dívida para evitar race condition
  select id, user_id, amount, status
  into v_debt
  from public.debts
  where id = p_debt_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Divida nao encontrada ou sem permissao.' using errcode = 'P0002';
  end if;

  if v_debt.status = 'paid' then
    raise exception 'Divida ja esta paga.' using errcode = 'P0003';
  end if;

  -- Calcula total já pago
  select coalesce(sum(amount), 0)
  into v_paid_total
  from public.payments
  where debt_id = p_debt_id
    and user_id = p_user_id;

  v_outstanding := v_debt.amount - v_paid_total;

  -- Valida o valor do pagamento
  if p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero.' using errcode = 'P0004';
  end if;

  -- Insere o pagamento
  insert into public.payments (user_id, debt_id, customer_id, amount, note, paid_at, created_at)
  values (p_user_id, p_debt_id, p_customer_id, p_amount, p_note, v_now, v_now)
  returning id into v_payment_id;

  -- Determina o novo status da dívida
  v_next_status := case when p_amount >= v_outstanding then 'paid' else 'open' end;

  -- Atualiza a dívida atomicamente
  update public.debts
  set
    status = v_next_status,
    paid_at = case when v_next_status = 'paid' then v_now else null end,
    updated_at = v_now
  where id = p_debt_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'debt_status', v_next_status,
    'outstanding_before', v_outstanding,
    'amount_paid', p_amount,
    'fully_paid', v_next_status = 'paid'
  );
end;
$$;

-- Permissão: usuários autenticados podem chamar (RLS da dívida protege o acesso)
revoke all on function public.record_payment_atomic(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.record_payment_atomic(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
