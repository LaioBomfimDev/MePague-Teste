export type DebtStatus = "open" | "paid";
export type MessageTone = "friendly" | "firm" | "overdue";
export type ChargeLogAction = "copied" | "sent";
export type UserRole = "user" | "support" | "operations" | "admin" | "superadmin";
export type UserStatus = "pending" | "active" | "inactive" | "blocked" | "deleted";
export type RiskLevel = "low" | "medium" | "high";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  pixKey: string;
  plan: "free" | "pro";
  role: UserRole;
  status: UserStatus;
  adminNotes?: string;
  statusReason?: string;
  statusChangedAt?: string;
  statusChangedBy?: string | null;
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

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro";
  role: UserRole;
  status: UserStatus;
  authCreatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSignInAt?: string | null;
  emailConfirmedAt?: string | null;
  adminNotes: string;
  statusReason: string;
  statusChangedAt?: string | null;
  statusChangedBy?: string | null;
  deletedAt?: string | null;
  daysSinceCreated: number | null;
  daysSinceLastSignIn: number | null;
  riskLevel: RiskLevel;
  riskScore: number;
  riskTags: string[];
  recentSensitiveActionAt?: string | null;
};

export type AuditLog = {
  id: string;
  actorId?: string | null;
  actorEmail: string;
  targetUserId?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
