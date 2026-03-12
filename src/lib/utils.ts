export function toNumber(input: string | null, fallback?: number) {
  if (!input) {
    return fallback;
  }

  const parsed = Number(input);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function buildDocumentNo(prefix: "ORD" | "QTE") {
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const stamp = String(now.getTime()).slice(-6);

  return `${prefix}-${date}-${stamp}`;
}
