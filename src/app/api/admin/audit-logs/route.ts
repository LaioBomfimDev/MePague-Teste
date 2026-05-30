import { NextResponse, type NextRequest } from "next/server";
import { adminErrorResponse, requireSuperAdmin } from "@/lib/admin-auth";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

type AuditLogRow = {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  target_user_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const context = await requireSuperAdmin(request);
    const { data, error } = await context.admin
      .from("audit_logs")
      .select("id,actor_id,actor_email,target_user_id,action,table_name,record_id,old_data,new_data,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const logs: AuditLog[] = ((data || []) as AuditLogRow[]).map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email || "",
      targetUserId: row.target_user_id,
      action: row.action,
      tableName: row.table_name,
      recordId: row.record_id,
      oldData: row.old_data,
      newData: row.new_data,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
