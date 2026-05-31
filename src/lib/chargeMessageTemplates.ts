import { buildChargeMessage, getChargeMessageParts, type ChargeMessageInput } from "@/lib/format";
import type { MessageTone } from "@/lib/types";

const STORAGE_KEY_PREFIX = "me-pague:charge-message-templates";
const TEMPLATE_UPDATED_EVENT = "me-pague:charge-message-template-updated";

type TemplateMap = Partial<Record<MessageTone, string>>;

const tokenRenderers = {
  "{nome}": (input: ChargeMessageInput) => getChargeMessageParts(input).firstName,
  "{valor}": (input: ChargeMessageInput) => getChargeMessageParts(input).amount,
  "{detalhe}": (input: ChargeMessageInput) => getChargeMessageParts(input).detail,
  "{vencimento}": (input: ChargeMessageInput) => getChargeMessageParts(input).due,
  "{atraso}": (input: ChargeMessageInput) => getChargeMessageParts(input).delay,
  "{pix}": (input: ChargeMessageInput) => getChargeMessageParts(input).pix,
};

function storageKey(userId?: string) {
  return `${STORAGE_KEY_PREFIX}:${userId || "local"}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllLiteral(value: string, search: string, replacement: string) {
  if (!search) return value;
  return value.replace(new RegExp(escapeRegExp(search), "g"), replacement);
}

function readTemplates(userId?: string): TemplateMap {
  if (!canUseStorage()) return {};

  try {
    const saved = window.localStorage.getItem(storageKey(userId));
    return saved ? (JSON.parse(saved) as TemplateMap) : {};
  } catch {
    return {};
  }
}

function writeTemplates(userId: string | undefined, templates: TemplateMap) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(storageKey(userId), JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent(TEMPLATE_UPDATED_EVENT, { detail: { userId } }));
}

export function subscribeChargeMessageTemplates(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleTemplateUpdate = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_KEY_PREFIX)) callback();
  };

  window.addEventListener(TEMPLATE_UPDATED_EVENT, handleTemplateUpdate);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(TEMPLATE_UPDATED_EVENT, handleTemplateUpdate);
    window.removeEventListener("storage", handleStorage);
  };
}

export function buildPersonalizedChargeMessage(userId: string | undefined, input: ChargeMessageInput) {
  const template = readTemplates(userId)[input.tone];

  if (!template) {
    return buildChargeMessage(input);
  }

  return renderChargeMessageTemplate(template, input);
}

export function saveLearnedChargeMessageTemplate(
  userId: string | undefined,
  tone: MessageTone,
  editedMessage: string,
  input: ChargeMessageInput,
) {
  const trimmed = editedMessage.trim();

  if (!trimmed) return;

  const templates = readTemplates(userId);
  const nextTemplate = createTemplateFromMessage(editedMessage, input);

  if (templates[tone] === nextTemplate) return;

  writeTemplates(userId, {
    ...templates,
    [tone]: nextTemplate,
  });
}

function renderChargeMessageTemplate(template: string, input: ChargeMessageInput) {
  return Object.entries(tokenRenderers).reduce(
    (message, [token, render]) => replaceAllLiteral(message, token, render(input)),
    template,
  );
}

function createTemplateFromMessage(message: string, input: ChargeMessageInput) {
  const parts = getChargeMessageParts(input);
  const replacements = [
    [input.debtorName, "{nome}"],
    [parts.firstName, "{nome}"],
    [parts.amount, "{valor}"],
    [parts.detail, "{detalhe}"],
    [parts.due, "{vencimento}"],
    [parts.delay, "{atraso}"],
    [parts.pix, "{pix}"],
  ] as const;

  return replacements
    .filter(([value]) => Boolean(value))
    .sort(([left], [right]) => right.length - left.length)
    .reduce((template, [value, token]) => replaceAllLiteral(template, value, token), message);
}
