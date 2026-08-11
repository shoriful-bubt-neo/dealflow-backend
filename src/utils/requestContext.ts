import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client.js";

const MAX_IP_HISTORY = 20;
export type FingerprintData = Prisma.InputJsonValue;
export type CanonicalFingerprint = { visitorId: string; data: FingerprintData };

function normaliseIp(value: string): string | undefined {
  const trimmed = value.trim().replace(/^\[|\]$/g, "");
  if (!trimmed) return undefined;
  const ipv4Mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return ipv4Mapped ? ipv4Mapped[1] : trimmed.toLowerCase();
}

function isPublicIp(ip: string): boolean {
  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    const [a, b] = octets;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (!ip.includes(":")) return false;
  return !(ip === "::" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:") || ip.startsWith("ff"));
}

/** Returns the first public client address, ignoring private proxy hops. */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValues = Array.isArray(forwarded) ? forwarded : [forwarded];
  const candidates = [...forwardedValues.flatMap((value) => value?.split(",") ?? []), ...(req.ips ?? []), req.ip, req.socket.remoteAddress];
  for (const candidate of candidates) {
    const ip = candidate ? normaliseIp(candidate) : undefined;
    if (ip && isPublicIp(ip)) return ip;
  }
  return undefined;
}

/** Extracts the stable FingerprintJS identifier; never derive it from user-agent data. */
export function parseCanonicalFingerprint(raw: string): CanonicalFingerprint {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Device fingerprint must be valid JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof (parsed as { visitorId?: unknown }).visitorId !== "string") throw new Error("Device fingerprint visitorId is required");
  const visitorId = (parsed as { visitorId: string }).visitorId.trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)) throw new Error("Device fingerprint visitorId is invalid");
  return { visitorId, data: parsed as FingerprintData };
}

export function appendIpHistory(history: unknown, ipAddress?: string): Prisma.InputJsonValue | undefined {
  if (!ipAddress) return Array.isArray(history) ? history as Prisma.InputJsonValue : undefined;
  const existing = Array.isArray(history) ? history.filter((value): value is string => typeof value === "string") : [];
  return [...existing.filter((value) => value !== ipAddress), ipAddress].slice(-MAX_IP_HISTORY);
}