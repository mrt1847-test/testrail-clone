import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

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
  private readonly sessions = new Map<string, AuthUser>();

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

    const token = randomUUID();
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null
    };
    this.sessions.set(token, authUser);
    return { token, user: authUser };
  }

  async me(token?: string): Promise<AuthUser | null> {
    if (!token) return null;
    return this.sessions.get(token) ?? null;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    this.sessions.delete(token);
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
