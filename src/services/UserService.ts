import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export class UserService {
  static findAll() {
    return prisma.user.findMany({ orderBy: { erstellt_am: "asc" } });
  }

  static findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  static findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  static async create(data: { name: string; email: string; password: string; rolle: string }) {
    const hash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: { ...data, password: hash, muss_pw_aendern: true },
    });
  }

  static async update(id: string, data: Record<string, unknown>) {
    const payload = { ...data };
    if (typeof payload.password === "string") {
      payload.password = await bcrypt.hash(payload.password, 12);
      payload.muss_pw_aendern = false;
    }
    return prisma.user.update({ where: { id }, data: payload });
  }
}
