"use client";

import { useEffect, useState } from "react";
import { buildPersonalizedChargeMessage, subscribeChargeMessageTemplates } from "@/lib/chargeMessageTemplates";
import type { ChargeMessageInput } from "@/lib/format";

export function usePersonalizedChargeMessage(userId: string | undefined, input: ChargeMessageInput) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeChargeMessageTemplates(() => setVersion((current) => current + 1)), []);

  return buildPersonalizedChargeMessage(userId, input);
}
