import bcrypt from "bcrypt";
import prisma from "../../../config/prisma.js";
import { generateOtp, verifyOtp } from "../../../services/otp.service.js";
import { dispatchOtp } from "../../../services/otpDispatcher.service.js";
import { generateToken, type JWTPayload } from "../../../utils/jwt.js";
import type { LoginBody, RegisterBody, VerifyOtpBody } from "./auth.validation.js";

const SALT_ROUNDS = 10;
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_ROLE_ID = 1;

export type AuthRedirectTo = "/admin/dashboard" | "/dashboard";

export type SanitizedUser = {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  isVerified: boolean;
  status: string;
  type: string;
  trustLevel: number;
  roleId: number | null;
  createdAt: string;
};

const userAuthSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  isVerified: true,
  trustLevel: true,
  status: true,
  type: true,
  createdAt: true,
  identities: { select: { trustLevel: true }, take: 5 },
  roles: { select: { roleId: true } },
} as const;

function resolveRoleId(roles?: { roleId: number }[]): number | null {
  if (!roles?.length) return null;
  const adminRole = roles.find((r) => r.roleId === ADMIN_ROLE_ID);
  return adminRole?.roleId ?? roles[0]!.roleId;
}

export function resolveRedirectTo(roleId: number | null | undefined): AuthRedirectTo {
  return roleId === ADMIN_ROLE_ID ? "/admin/dashboard" : "/dashboard";
}

function sanitizeUser(
  user: {
    id: number;
    email: string | null;
    name: string | null;
    phone?: string | null;
    isVerified: boolean;
    status: string;
    type: string;
    trustLevel?: number;
    createdAt: Date;
    identities?: { trustLevel: number }[];
    roles?: { roleId: number }[];
  },
): SanitizedUser {
  const identityTrust =
    user.identities?.reduce((max, i) => Math.max(max, i.trustLevel), 0) ?? 0;
  const trustLevel =
    typeof user.trustLevel === "number" && user.trustLevel > 0
      ? user.trustLevel
      : identityTrust >= 2
        ? 100
        : identityTrust >= 1
          ? 50
          : 0;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    isVerified: user.isVerified,
    status: user.status,
    type: user.type,
    trustLevel,
    roleId: resolveRoleId(user.roles),
    createdAt: user.createdAt.toISOString(),
  };
}

export function buildSessionToken(user: SanitizedUser, extra?: Partial<JWTPayload>): string {
  return generateToken({
    id: user.id,
    userId: user.id,
    email: user.email,
    trustLevel: user.trustLevel,
    roleId: user.roleId,
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

export async function startRegistration(payload: RegisterBody): Promise<{
  channelSent: string;
}> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: payload.email, deletedAt: null },
        { phone: payload.phone, deletedAt: null },
      ],
    },
    select: { id: true, email: true, phone: true },
  });

  if (existing) {
    if (existing.email === payload.email) {
      throw new Error("Email already registered");
    }
    throw new Error("Phone number already registered");
  }

  const code = await generateOtp(payload.phone);
  const { channel } = await dispatchOtp(payload.phone, payload.email, code);
  return { channelSent: channel };
}

export async function completeRegistration(payload: VerifyOtpBody): Promise<{
  user: SanitizedUser;
  token: string;
  redirectTo: AuthRedirectTo;
}> {
  const ok = await verifyOtp(payload.phone, payload.code);
  if (!ok) {
    throw new Error("Invalid or expired OTP");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: payload.email, deletedAt: null },
        { phone: payload.phone, deletedAt: null },
      ],
    },
    select: { id: true, email: true, phone: true },
  });
  if (existing) {
    if (existing.email === payload.email) {
      throw new Error("Email already registered");
    }
    throw new Error("Phone number already registered");
  }

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      passwordHash,
      type: "BUYER",
      status: "PENDING_VERIFICATION",
      isVerified: false,
      trustLevel: 10,
      phoneVerifiedAt: new Date(),
      isActive: true,
      lastOtpAt: new Date(),
      lastLoginAt: new Date(),
    },
    select: userAuthSelect,
  });

  const sanitized = sanitizeUser(user);
  return {
    user: sanitized,
    token: buildSessionToken(sanitized),
    redirectTo: resolveRedirectTo(sanitized.roleId),
  };
}

export async function loginUser(payload: LoginBody): Promise<{
  user: SanitizedUser;
  token: string;
  redirectTo: AuthRedirectTo;
}> {
  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
      deletedAt: null,
    },
    select: {
      ...userAuthSelect,
      passwordHash: true,
      isActive: true,
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
  return {
    user: sanitized,
    token: buildSessionToken(sanitized),
    redirectTo: resolveRedirectTo(sanitized.roleId),
  };
}

export async function getCurrentUser(userId: number): Promise<SanitizedUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      isActive: true,
    },
    select: userAuthSelect,
  });

  return user ? sanitizeUser(user) : null;
}
