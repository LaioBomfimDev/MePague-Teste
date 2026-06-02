import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { addMonthsToDateString, addWeeksToDateString, getInitials, normalizePhone, toDateInputValue } from "@/lib/format";
import type { ChargeLog, ChargeLogAction, Customer, Debt, MessageTone, Payment, UserProfile, UserRole, UserStatus } from "@/lib/types";

type Unsubscribe = () => void;
type DemoStore = {
  profile: UserProfile;
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  chargeLogs: ChargeLog[];
};

export type AppDataSnapshot = {
  profile: UserProfile | null;
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  chargeLogs: ChargeLog[];
};

export const DEMO_USER_ID = "demo-admlaio";

const DEMO_STORAGE_KEY = "me-pague:demo-store";
const DEMO_STORE_EVENT = "me-pague:demo-store-updated";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  pix_key: string;
  plan: "free" | "pro";
  role?: UserRole;
  status?: UserStatus;
  admin_notes?: string;
  status_reason?: string;
  status_changed_at?: string;
  status_changed_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CustomerRow = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  initials: string;
  created_at?: string;
  updated_at?: string;
};

type DebtRow = {
  id: string;
  user_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  amount: number | string;
  due_date: string;
  daily_interest: number | string;
  description: string;
  status: "open" | "paid";
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PaymentRow = {
  id: string;
  user_id: string;
  debt_id: string;
  customer_id: string;
  amount: number | string;
  note?: string | null;
  paid_at: string;
  created_at?: string;
};

type ChargeLogRow = {
  id: string;
  user_id: string;
  debt_id?: string | null;
  customer_id: string;
  customer_name: string;
  action: ChargeLogAction;
  tone: MessageTone;
  message: string;
  created_at: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function demoDate(daysFromToday: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return toDateInputValue(date);
}

function demoTimestamp(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString();
}

function isDemoUid(uid: string) {
  return uid === DEMO_USER_ID;
}

function createDefaultDemoStore(): DemoStore {
  const customers: Customer[] = [
    {
      id: "demo-customer-maria",
      name: "Maria Souza",
      phone: "11999990001",
      initials: "MS",
      createdAt: demoTimestamp(-12),
    },
    {
      id: "demo-customer-carlos",
      name: "Carlos Lima",
      phone: "11999990002",
      initials: "CL",
      createdAt: demoTimestamp(-5),
    },
    {
      id: "demo-customer-ana",
      name: "Ana Pereira",
      phone: "11999990003",
      initials: "AP",
      createdAt: demoTimestamp(-18),
    },
  ];

  return {
    profile: {
      id: DEMO_USER_ID,
      name: "admLaio",
      email: "admLaio",
      pixKey: "teste@pix",
      plan: "pro",
      role: "user",
      status: "active",
      adminNotes: "",
      statusReason: "",
      createdAt: demoTimestamp(-20),
    },
    customers,
    debts: [
      {
        id: "demo-debt-overdue",
        customerId: customers[0].id,
        customerName: customers[0].name,
        customerPhone: customers[0].phone,
        amount: 180,
        dueDate: demoDate(-5),
        dailyInterest: 1.5,
        description: "Venda de produtos",
        status: "open",
        createdAt: demoTimestamp(-10),
      },
      {
        id: "demo-debt-today",
        customerId: customers[1].id,
        customerName: customers[1].name,
        customerPhone: customers[1].phone,
        amount: 250,
        dueDate: demoDate(0),
        dailyInterest: 1,
        description: "Servico de montagem",
        status: "open",
        createdAt: demoTimestamp(-2),
      },
      {
        id: "demo-debt-paid",
        customerId: customers[2].id,
        customerName: customers[2].name,
        customerPhone: customers[2].phone,
        amount: 90,
        dueDate: demoDate(-12),
        dailyInterest: 0,
        description: "Entrega concluida",
        status: "paid",
        paidAt: demoTimestamp(-2),
        createdAt: demoTimestamp(-18),
      },
    ],
    payments: [
      {
        id: "demo-payment-paid",
        debtId: "demo-debt-paid",
        customerId: customers[2].id,
        amount: 90,
        note: "Pagamento inicial de teste",
        paidAt: demoTimestamp(-2),
        createdAt: demoTimestamp(-2),
      },
    ],
    chargeLogs: [
      {
        id: "demo-charge-maria",
        debtId: "demo-debt-overdue",
        customerId: customers[0].id,
        customerName: customers[0].name,
        action: "sent",
        tone: "overdue",
        message: "Mensagem de cobranca enviada pelo WhatsApp.",
        createdAt: demoTimestamp(-1),
      },
    ],
  };
}

function mapDemoStoreToSnapshot(store: DemoStore): AppDataSnapshot {
  return {
    profile: store.profile,
    customers: store.customers,
    debts: store.debts,
    payments: store.payments || [],
    chargeLogs: store.chargeLogs || [],
  };
}

function getDemoStore(): DemoStore {
  if (!canUseStorage()) return createDefaultDemoStore();

  const saved = window.localStorage.getItem(DEMO_STORAGE_KEY);

  if (!saved) {
    const defaultStore = createDefaultDemoStore();
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(defaultStore));
    return defaultStore;
  }

  try {
    const parsed = JSON.parse(saved) as DemoStore;
    parsed.payments = parsed.payments || [];
    parsed.chargeLogs = parsed.chargeLogs || [];

    const paidDebtsWithoutPayment = parsed.debts.filter(
      (debt) => debt.status === "paid" && !parsed.payments.some((payment) => payment.debtId === debt.id),
    );

    if (paidDebtsWithoutPayment.length > 0) {
      parsed.payments = [
        ...paidDebtsWithoutPayment.map((debt) => ({
          id: createLocalId("demo-payment"),
          debtId: debt.id,
          customerId: debt.customerId,
          amount: debt.amount,
          note: "Pagamento migrado",
          paidAt: debt.paidAt || new Date().toISOString(),
          createdAt: debt.paidAt || new Date().toISOString(),
        })),
        ...parsed.payments,
      ];
      saveDemoStore(parsed);
    }

    return parsed;
  } catch {
    const defaultStore = createDefaultDemoStore();
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(defaultStore));
    return defaultStore;
  }
}

function saveDemoStore(store: DemoStore) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(DEMO_STORE_EVENT));
}

function subscribeDemoStore<T>(callback: (value: T) => void, selector: (store: DemoStore) => T): Unsubscribe {
  callback(selector(getDemoStore()));

  if (!canUseStorage()) return () => {};

  const handler = () => callback(selector(getDemoStore()));
  window.addEventListener(DEMO_STORE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(DEMO_STORE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRealtimeChannelName(prefix: string, ...parts: string[]) {
  // Usa nome determinístico para evitar acumular canais se o componente re-renderizar.
  // O cleanup via supabase.removeChannel() no unsubscribe garante idempotência.
  return [prefix, ...parts].join(":");
}

function getUserDisplayName(user: User) {
  const metadataName = user.user_metadata?.name || user.user_metadata?.full_name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email?.split("@")[0] || "Meu Perfil";
}

function createDemoDebtWithCustomer(input: {
  name: string;
  phone: string;
  amount: number;
  dueDate: string;
  dailyInterest: number;
  description: string;
  installments?: number;
  frequency?: "monthly" | "weekly";
}) {
  const store = getDemoStore();
  const normalizedPhone = normalizePhone(input.phone);
  let customer = store.customers.find((item) => normalizePhone(item.phone) === normalizedPhone);

  if (customer) {
    customer = {
      ...customer,
      name: input.name,
      phone: input.phone,
      initials: getInitials(input.name),
      updatedAt: new Date().toISOString(),
    };
    store.customers = store.customers.map((item) => (item.id === customer?.id ? customer : item));
  } else {
    customer = {
      id: createLocalId("demo-customer"),
      name: input.name,
      phone: input.phone,
      initials: getInitials(input.name),
      createdAt: new Date().toISOString(),
    };
    store.customers = [customer, ...store.customers];
  }

  const installments = Math.max(1, Math.min(24, Math.floor(input.installments || 1)));
  const installmentAmounts = splitAmount(input.amount, installments);
  const debts: Debt[] = installmentAmounts.map((installmentAmount, index) => ({
    id: createLocalId("demo-debt"),
    customerId: customer.id,
    customerName: input.name,
    customerPhone: input.phone,
    amount: installmentAmount,
    dueDate: input.frequency === "weekly" ? addWeeksToDateString(input.dueDate, index) : addMonthsToDateString(input.dueDate, index),
    dailyInterest: input.dailyInterest,
    description:
      installments > 1
        ? `Parcela ${index + 1}/${installments}${input.description ? ` - ${input.description}` : ""}`
        : input.description,
    status: "open",
    createdAt: new Date().toISOString(),
  }));

  store.debts = [...debts, ...store.debts];
  saveDemoStore(store);
}

function mapProfile(row: ProfileRow): UserProfile {
  const role = row.role || "user";
  const status = row.status === "pending" && role === "user" ? "active" : row.status || "active";

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    pixKey: row.pix_key,
    plan: row.plan,
    role,
    status,
    adminNotes: row.admin_notes || "",
    statusReason: row.status_reason || "",
    statusChangedAt: row.status_changed_at,
    statusChangedBy: row.status_changed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    initials: row.initials,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    amount: Number(row.amount),
    dueDate: row.due_date,
    dailyInterest: Number(row.daily_interest),
    description: row.description,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    debtId: row.debt_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    note: row.note || "",
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapChargeLog(row: ChargeLogRow): ChargeLog {
  return {
    id: row.id,
    debtId: row.debt_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    action: row.action,
    tone: row.tone,
    message: row.message,
    createdAt: row.created_at,
  };
}

async function fetchUserProfile(uid: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();

  if (error) throw error;

  return data ? mapProfile(data as ProfileRow) : null;
}

async function fetchCustomers(uid: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as CustomerRow[]).map(mapCustomer);
}

async function findOrCreateCustomer(uid: string, input: { name: string; phone: string }) {
  const normalizedPhone = normalizePhone(input.phone);
  const existingCustomers = await fetchCustomers(uid);
  const existingCustomer = existingCustomers.find((customer) => normalizePhone(customer.phone) === normalizedPhone);

  if (existingCustomer) {
    const { error } = await supabase
      .from("customers")
      .update({
        name: input.name,
        phone: input.phone,
        initials: getInitials(input.name),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingCustomer.id)
      .eq("user_id", uid);

    if (error) throw error;

    return {
      ...existingCustomer,
      name: input.name,
      phone: input.phone,
      initials: getInitials(input.name),
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      user_id: uid,
      name: input.name,
      phone: input.phone,
      initials: getInitials(input.name),
    })
    .select("*")
    .single();

  if (error) throw error;

  return mapCustomer(data as CustomerRow);
}

function splitAmount(amount: number, installments: number) {
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / installments);
  const remainder = cents % installments;

  return Array.from({ length: installments }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

async function fetchDebts(uid: string) {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as DebtRow[]).map(mapDebt);
}

async function fetchPayments(uid: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", uid)
    .order("paid_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as PaymentRow[]).map(mapPayment);
}

async function fetchChargeLogs(uid: string) {
  const { data, error } = await supabase
    .from("charge_logs")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as ChargeLogRow[]).map(mapChargeLog);
}

export async function loadAppData(uid: string): Promise<AppDataSnapshot> {
  if (isDemoUid(uid)) {
    return mapDemoStoreToSnapshot(getDemoStore());
  }

  const [profile, customers, debts, payments, chargeLogs] = await Promise.all([
    fetchUserProfile(uid),
    fetchCustomers(uid),
    fetchDebts(uid),
    fetchPayments(uid),
    fetchChargeLogs(uid),
  ]);

  return {
    profile,
    customers,
    debts,
    payments,
    chargeLogs,
  };
}

export function subscribeAppData(
  uid: string,
  callback: (snapshot: AppDataSnapshot) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, mapDemoStoreToSnapshot);
  }

  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const load = async () => {
    try {
      const snapshot = await loadAppData(uid);

      if (!disposed) {
        callback(snapshot);
      }
    } catch (error) {
      if (!disposed) {
        onError?.(error);
      }
    }
  };

  const scheduleRefresh = () => {
    if (disposed) return;

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void load();
    }, 150);
  };

  void load();

  const channel = supabase
    .channel(createRealtimeChannelName("app-data", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `user_id=eq.${uid}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "debts", filter: `user_id=eq.${uid}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${uid}` }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "charge_logs", filter: `user_id=eq.${uid}` }, scheduleRefresh)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(new Error(`Realtime ${status.toLowerCase()}`));
      }
    });

  return () => {
    disposed = true;

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    void supabase.removeChannel(channel);
  };
}

export async function ensureUserProfile(user: User) {
  if (isDemoUid(user.id)) return;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      name: getUserDisplayName(user),
      email: user.email || "",
      pix_key: "",
      plan: "free",
      role: "user",
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) throw error;
}

export async function getUserAccessState(user: User): Promise<{
  allowed: boolean;
  message?: string;
  profile: UserProfile | null;
}> {
  if (isDemoUid(user.id)) {
    return { allowed: true, profile: createDefaultDemoStore().profile };
  }

  await ensureUserProfile(user);

  const profile = await fetchUserProfile(user.id);

  if (!profile) {
    return {
      allowed: false,
      message: "Perfil nao encontrado. Fale com o suporte.",
      profile: null,
    };
  }

  if (profile.status === "blocked") {
    return {
      allowed: false,
      message: "Sua conta esta bloqueada. Fale com o suporte.",
      profile,
    };
  }

  if (profile.status === "pending") {
    return {
      allowed: false,
      message: "Conta administrativa pendente. Fale com o suporte.",
      profile,
    };
  }

  if (profile.status === "inactive") {
    return {
      allowed: false,
      message: "Sua conta esta inativa. Fale com o suporte.",
      profile,
    };
  }

  if (profile.status === "deleted") {
    return {
      allowed: false,
      message: "Esta conta foi excluida do acesso ao app.",
      profile,
    };
  }

  return { allowed: true, profile };
}

export function subscribeUserProfile(uid: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) => store.profile);
  }

  fetchUserProfile(uid).then(callback).catch(() => callback(null));

  const channel = supabase
    .channel(createRealtimeChannelName("profile", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, async () => {
      callback(await fetchUserProfile(uid));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function updateUserProfile(uid: string, data: Pick<UserProfile, "name" | "pixKey">) {
  if (isDemoUid(uid)) {
    const store = getDemoStore();
    store.profile = {
      ...store.profile,
      name: data.name,
      pixKey: data.pixKey,
      updatedAt: new Date().toISOString(),
    };
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name: data.name,
      pix_key: data.pixKey,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);

  if (error) throw error;
}

export function subscribeCustomers(uid: string, callback: (customers: Customer[]) => void, onError?: (error: unknown) => void): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) => store.customers);
  }

  fetchCustomers(uid)
    .then(callback)
    .catch((error) => {
      onError?.(error);
      callback([]);
    });

  const channel = supabase
    .channel(createRealtimeChannelName("customers", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `user_id=eq.${uid}` }, async () => {
      callback(await fetchCustomers(uid));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeDebts(uid: string, callback: (debts: Debt[]) => void, onError?: (error: unknown) => void): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) => store.debts);
  }

  fetchDebts(uid)
    .then(callback)
    .catch((error) => {
      onError?.(error);
      callback([]);
    });

  const channel = supabase
    .channel(createRealtimeChannelName("debts", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "debts", filter: `user_id=eq.${uid}` }, async () => {
      callback(await fetchDebts(uid));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribePayments(uid: string, callback: (payments: Payment[]) => void, onError?: (error: unknown) => void): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) => store.payments || []);
  }

  fetchPayments(uid)
    .then(callback)
    .catch((error) => {
      onError?.(error);
      callback([]);
    });

  const channel = supabase
    .channel(createRealtimeChannelName("payments", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${uid}` }, async () => {
      callback(await fetchPayments(uid));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeChargeLogs(uid: string, callback: (chargeLogs: ChargeLog[]) => void, onError?: (error: unknown) => void): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) => store.chargeLogs || []);
  }

  fetchChargeLogs(uid)
    .then(callback)
    .catch((error) => {
      onError?.(error);
      callback([]);
    });

  const channel = supabase
    .channel(createRealtimeChannelName("charge_logs", uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "charge_logs", filter: `user_id=eq.${uid}` }, async () => {
      callback(await fetchChargeLogs(uid));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function updateCustomer(uid: string, customerId: string, data: Pick<Customer, "name" | "phone">) {
  const initials = getInitials(data.name);

  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const now = new Date().toISOString();
    store.customers = store.customers.map((customer) =>
      customer.id === customerId ? { ...customer, ...data, initials, updatedAt: now } : customer,
    );
    store.debts = store.debts.map((debt) =>
      debt.customerId === customerId
        ? { ...debt, customerName: data.name, customerPhone: data.phone, updatedAt: now }
        : debt,
    );
    saveDemoStore(store);
    return;
  }

  const { error: customerError } = await supabase
    .from("customers")
    .update({
      name: data.name,
      phone: data.phone,
      initials,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("user_id", uid);

  if (customerError) throw customerError;

  const { error: debtError } = await supabase
    .from("debts")
    .update({
      customer_name: data.name,
      customer_phone: data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("user_id", uid);

  if (debtError) throw debtError;
}

export async function recordPayment(
  uid: string,
  input: {
    debtId: string;
    customerId: string;
    amount: number;
    note?: string;
    outstandingAmount: number;
  },
) {
  const now = new Date().toISOString();
  const nextStatus = input.amount >= input.outstandingAmount ? "paid" : "open";

  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const payment: Payment = {
      id: createLocalId("demo-payment"),
      debtId: input.debtId,
      customerId: input.customerId,
      amount: input.amount,
      note: input.note,
      paidAt: now,
      createdAt: now,
    };
    store.payments = [payment, ...(store.payments || [])];
    store.debts = store.debts.map((debt) =>
      debt.id === input.debtId
        ? {
            ...debt,
            status: nextStatus,
            paidAt: nextStatus === "paid" ? now : debt.paidAt,
            updatedAt: now,
          }
        : debt,
    );
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase.rpc("record_payment_atomic", {
    p_debt_id: input.debtId,
    p_user_id: uid,
    p_customer_id: input.customerId,
    p_amount: input.amount,
    p_note: input.note || "",
  });

  if (error) throw error;
}

export async function recordChargeLog(
  uid: string,
  input: {
    debtId?: string | null;
    customerId: string;
    customerName: string;
    action: ChargeLogAction;
    tone: MessageTone;
    message: string;
  },
) {
  const now = new Date().toISOString();

  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const log: ChargeLog = {
      id: createLocalId("demo-charge"),
      debtId: input.debtId,
      customerId: input.customerId,
      customerName: input.customerName,
      action: input.action,
      tone: input.tone,
      message: input.message,
      createdAt: now,
    };
    store.chargeLogs = [log, ...(store.chargeLogs || [])];
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase.from("charge_logs").insert({
    user_id: uid,
    debt_id: input.debtId,
    customer_id: input.customerId,
    customer_name: input.customerName,
    action: input.action,
    tone: input.tone,
    message: input.message,
  });

  if (error) throw error;
}

export async function createDebtWithCustomer(
  uid: string,
  input: {
    name: string;
    phone: string;
    amount: number;
    dueDate: string;
    dailyInterest: number;
    description: string;
    installments?: number;
    frequency?: "monthly" | "weekly";
  },
) {
  if (isDemoUid(uid)) {
    createDemoDebtWithCustomer(input);
    return;
  }

  const customer = await findOrCreateCustomer(uid, {
    name: input.name,
    phone: input.phone,
  });
  const installments = Math.max(1, Math.min(24, Math.floor(input.installments || 1)));
  const installmentAmounts = splitAmount(input.amount, installments);
  const debts = installmentAmounts.map((installmentAmount, index) => ({
    user_id: uid,
    customer_id: customer.id,
    customer_name: input.name,
    customer_phone: input.phone,
    amount: installmentAmount,
    due_date: input.frequency === "weekly" ? addWeeksToDateString(input.dueDate, index) : addMonthsToDateString(input.dueDate, index),
    daily_interest: input.dailyInterest,
    description:
      installments > 1
        ? `Parcela ${index + 1}/${installments}${input.description ? ` - ${input.description}` : ""}`
        : input.description,
    status: "open",
  }));

  const { error: debtError } = await supabase.from("debts").insert(debts);

  if (debtError) throw debtError;
}

export async function markDebtAsPaid(uid: string, debtId: string) {
  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const now = new Date().toISOString();
    store.debts = store.debts.map((debt) =>
      debt.id === debtId
        ? {
            ...debt,
            status: "paid",
            paidAt: now,
            updatedAt: now,
          }
        : debt,
    );
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase
    .from("debts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", debtId)
    .eq("user_id", uid);

  if (error) throw error;
}

export async function markDebtAsOpen(uid: string, debtId: string) {
  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const now = new Date().toISOString();
    store.payments = (store.payments || []).filter((payment) => payment.debtId !== debtId);
    store.debts = store.debts.map((debt) =>
      debt.id === debtId
        ? {
            ...debt,
            status: "open",
            paidAt: null,
            updatedAt: now,
          }
        : debt,
    );
    saveDemoStore(store);
    return;
  }

  const { error: paymentError } = await supabase.from("payments").delete().eq("debt_id", debtId).eq("user_id", uid);

  if (paymentError) throw paymentError;

  const { error } = await supabase
    .from("debts")
    .update({
      status: "open",
      paid_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debtId)
    .eq("user_id", uid);

  if (error) throw error;
}

export async function deleteDebt(uid: string, debtId: string) {
  if (isDemoUid(uid)) {
    const store = getDemoStore();
    store.debts = store.debts.filter((debt) => debt.id !== debtId);
    store.payments = (store.payments || []).filter((payment) => payment.debtId !== debtId);
    store.chargeLogs = (store.chargeLogs || []).filter((log) => log.debtId !== debtId);
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase.from("debts").delete().eq("id", debtId).eq("user_id", uid);

  if (error) throw error;
}

export async function updateDebt(
  uid: string,
  debtId: string,
  data: Pick<Debt, "amount" | "dueDate" | "dailyInterest" | "description">,
) {
  if (isDemoUid(uid)) {
    const store = getDemoStore();
    const now = new Date().toISOString();
    store.debts = store.debts.map((debt) =>
      debt.id === debtId
        ? {
            ...debt,
            amount: data.amount,
            dueDate: data.dueDate,
            dailyInterest: data.dailyInterest,
            description: data.description,
            updatedAt: now,
          }
        : debt,
    );
    saveDemoStore(store);
    return;
  }

  const { error } = await supabase
    .from("debts")
    .update({
      amount: data.amount,
      due_date: data.dueDate,
      daily_interest: data.dailyInterest,
      description: data.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debtId)
    .eq("user_id", uid);

  if (error) throw error;
}

export function subscribeOpenDebtsByCustomer(
  uid: string,
  customerId: string,
  callback: (debts: Debt[]) => void,
): Unsubscribe {
  if (isDemoUid(uid)) {
    return subscribeDemoStore(callback, (store) =>
      store.debts.filter((debt) => debt.customerId === customerId && debt.status === "open"),
    );
  }

  const fetchOpenDebts = async () => {
    const { data, error } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", uid)
      .eq("customer_id", customerId)
      .eq("status", "open");

    if (error) throw error;

    return ((data || []) as DebtRow[]).map(mapDebt);
  };

  fetchOpenDebts().then(callback).catch(() => callback([]));

  const channel = supabase
    .channel(createRealtimeChannelName("debts", uid, customerId))
    .on("postgres_changes", { event: "*", schema: "public", table: "debts", filter: `customer_id=eq.${customerId}` }, async () => {
      callback(await fetchOpenDebts());
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
