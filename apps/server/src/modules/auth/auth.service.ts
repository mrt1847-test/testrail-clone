import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";

type AuthUser = {
  id: bigint;
  email: string;
  name: string | null;
};

type MembershipRow = {
  projectId: bigint;
  role: string;
};

export class AuthService {
  constructor(private readonly prisma?: PrismaClient) {}

  async login(email: string): Promise<{ token: string; user: AuthUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.prisma
      ? await this.prisma.user.upsert({
          where: { email: normalizedEmail },
          update: {},
          create: { email: normalizedEmail, name: normalizedEmail.split("@")[0] ?? "User" }
        })
      : { id: 1n, email: normalizedEmail, name: "Admin" };

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null
    };
    const token = signAuthToken(authUser);
    return { token, user: authUser };
  }

  async me(token?: string): Promise<AuthUser | null> {
    if (!token) return null;
    return verifyAuthToken(token);
  }

  async logout(token?: string): Promise<void> {
    void token;
  }

  async listMemberships(userId: bigint): Promise<MembershipRow[]> {
    if (!this.prisma) return [];
    const rows = await this.prisma.projectMember.findMany({
      where: { userId, deletedAt: null, project: { deletedAt: null } },
      select: { projectId: true, role: true }
    });
    return rows.map((row: (typeof rows)[number]) => ({
      projectId: row.projectId,
      role: row.role
    }));
  }
}

type AuthTokenPayload = {
  id: string;
  email: string;
  name: string | null;
  exp: number;
};

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", env.authSecret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signAuthToken(user: AuthUser) {
  const payload: AuthTokenPayload = {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `v1.${encodedPayload}.${signPayload(encodedPayload)}`;
}

function verifyAuthToken(token: string): AuthUser | null {
  const [version, encodedPayload, signature] = token.split(".");
  if (version !== "v1" || !encodedPayload || !signature) return null;
  if (!signaturesMatch(signature, signPayload(encodedPayload))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AuthTokenPayload>;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.id || !payload.email) return null;
    return {
      id: BigInt(String(payload.id)),
      email: String(payload.email),
      name: payload.name == null ? null : String(payload.name)
    };
  } catch {
    return null;
  }
}
