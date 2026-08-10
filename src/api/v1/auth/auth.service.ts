import bcrypt from "bcrypt";
import prisma from "../../../config/prisma.js";
import { generateToken, type JWTPayload } from "../../../utils/jwt.js";
import type { LoginBody, RegisterBody } from "./auth.validation.js";

const SALT_ROUNDS = 10;
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SanitizedUser = {
  id: number;
  email: string | null;
  name: string | null;
  isVerified: boolean;
  status: string;
  type: string;
  trustLevel: number;
  createdAt: string;
};

function sanitizeUser(
  user: {
    id: number;
    email: string | null;
    name: string | null;
    isVerified: boolean;
    status: string;
    type: string;
    createdAt: Date;
    identities?: { trustLevel: number }[];
  },
): SanitizedUser {
  const trustLevel =
    user.identities?.reduce((max, i) => Math.max(max, i.trustLevel), 0) ?? 0;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: user.isVerified,
    status: user.status,
    type: user.type,
    trustLevel,
    createdAt: user.createdAt.toISOString(),
  };
}

export function buildSessionToken(user: SanitizedUser, extra?: Partial<JWTPayload>): string {
  return generateToken({
    id: user.id,
    userId: user.id,
    email: user.email,
    trustLevel: user.trustLevel,
    ...extra,
  });
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

export async function registerUser(payload: RegisterBody): Promise<{
  user: SanitizedUser;
  token: string;
}> {
  const existing = await prisma.user.findFirst({
    where: {
      email: payload.email,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      passwordHash,
      type: "BUYER",
      status: "PENDING_VERIFICATION",
      isVerified: false,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      status: true,
      type: true,
      createdAt: true,
      identities: { select: { trustLevel: true }, take: 5 },
    },
  });

  const sanitized = sanitizeUser(user);
  return { user: sanitized, token: buildSessionToken(sanitized) };
}

export async function loginUser(payload: LoginBody): Promise<{
  user: SanitizedUser;
  token: string;
}> {
  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isVerified: true,
      status: true,
      type: true,
      isActive: true,
      createdAt: true,
      identities: { select: { trustLevel: true }, take: 5 },
    },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }

  if (!user.isActive || user.status === "SUSPENDED" || user.status === "CLOSED") {
    throw new Error("Account is not active");
  }

  const ok = await bcrypt.compare(payload.password, user.passwordHash);
  if (!ok) {
    throw new Error("Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const sanitized = sanitizeUser(user);
  return { user: sanitized, token: buildSessionToken(sanitized) };
}

export async function getCurrentUser(userId: number): Promise<SanitizedUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      status: true,
      type: true,
      createdAt: true,
      identities: { select: { trustLevel: true }, take: 5 },
    },
  });

  return user ? sanitizeUser(user) : null;
}
