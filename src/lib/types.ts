export type DebtStatus = "open" | "paid";
export type MessageTone = "friendly" | "firm" | "overdue";
export type ChargeLogAction = "copied" | "sent";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  pixKey: string;
  plan: "free" | "pro";
  createdAt?: string;
  updatedAt?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Debt = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  dueDate: string;
  dailyInterest: number;
  description: string;
  status: DebtStatus;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Payment = {
  id: string;
  debtId: string;
  customerId: string;
  amount: number;
  note?: string;
  paidAt: string;
  createdAt?: string;
};

export type ChargeLog = {
  id: string;
  debtId?: string | null;
  customerId: string;
  customerName: string;
  action: ChargeLogAction;
  tone: MessageTone;
  message: string;
  createdAt: string;
};

export type DebtWithCustomer = Debt & {
  isOverdue: boolean;
  amountWithInterest: number;
  outstandingAmount: number;
  paidAmount: number;
  daysOverdue: number;
  daysUntilDue: number;
  installmentIndex?: number;
  installmentTotal?: number;
  installmentGroupKey?: string;
  baseDescription: string;
  lastChargedAt?: string;
};

export type DashboardStats = {
  totalOpen: number;
  totalOriginalOpen: number;
  totalOverdue: number;
  totalPaid: number;
  forecast7Days: number;
  forecast30Days: number;
  dueTodayCount: number;
  dueSoonCount: number;
  overdueCount: number;
  openCount: number;
  paidCount: number;
};
