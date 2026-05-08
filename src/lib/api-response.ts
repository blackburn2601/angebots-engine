import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ data }, { status });

export const created = (data: unknown) =>
  NextResponse.json({ data }, { status: 201 });

export const apiError = (message: string, status: number, code?: string) =>
  NextResponse.json({ error: message, ...(code && { code }) }, { status });
