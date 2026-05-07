import { prisma } from "./prisma";

export interface LogData {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  ip?: string;
  userId?: string;
  apiKeyId?: string;
  error?: string;
}

export async function logApiRequest(data: LogData): Promise<void> {
  try {
    await prisma.apiLog.create({
      data: {
        method: data.method,
        path: data.path,
        status_code: data.statusCode,
        duration_ms: data.durationMs,
        request_headers: data.requestHeaders
          ? JSON.stringify(data.requestHeaders, null, 0).slice(0, 5000)
          : null,
        request_body: data.requestBody
          ? JSON.stringify(data.requestBody).slice(0, 8000)
          : null,
        response_body: data.responseBody
          ? JSON.stringify(data.responseBody).slice(0, 8000)
          : null,
        ip: data.ip ?? null,
        user_id: data.userId ?? null,
        api_key_id: data.apiKeyId ?? null,
        error: data.error ?? null,
      },
    });
  } catch (e) {
    // Never let logging failures break the application
    console.error("[api-logger] Failed to write log entry:", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: Request, ctx: any) => Promise<Response> | Response;

/**
 * Wraps a Next.js API route handler with request/response logging.
 *
 * Usage:
 *   export const GET = withLogging(async (req) => { ... });
 */
export function withLogging(
  handler: RouteHandler,
  options?: { captureBody?: boolean }
): RouteHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: Request, ctx: any): Promise<Response> => {
    const start = Date.now();
    const url = new URL(req.url);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // Capture safe headers (omit auth/cookie values)
    const safeHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower === "authorization") {
        safeHeaders[k] = v.replace(/^(Bearer\s+\S{4}).*/, "$1***");
      } else if (lower !== "cookie") {
        safeHeaders[k] = v;
      }
    });

    // Optionally capture body (clone request so it can still be read)
    let requestBody: unknown;
    let handlerReq = req;
    if (options?.captureBody && ["POST", "PUT", "PATCH"].includes(req.method)) {
      try {
        const bodyText = await req.text();
        requestBody = JSON.parse(bodyText);
        handlerReq = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: bodyText,
        });
      } catch {
        // ignore parse errors
      }
    }

    let response: Response;
    let errorMessage: string | undefined;

    try {
      response = await handler(handlerReq, ctx);
    } catch (e) {
      errorMessage = String(e);
      response = new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const duration = Date.now() - start;

    // Fire-and-forget logging
    void logApiRequest({
      method: req.method,
      path: url.pathname,
      statusCode: response.status,
      durationMs: duration,
      requestHeaders: safeHeaders,
      requestBody,
      ip,
      error: errorMessage,
    });

    return response;
  };
}
