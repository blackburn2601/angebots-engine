import { AsyncLocalStorage } from "async_hooks";
import { prisma } from "./prisma";
import { checkApiRateLimit } from "./api-rate-limit";

// Populated by getRequestAuth() inside each handler; read by withLogging() after the handler returns
export const requestAuthStore = new AsyncLocalStorage<{
  userId?: string;
  apiKeyId?: string;
}>();

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
    console.error("[api-logger] Failed to write log entry:", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: Request, ctx: any) => Promise<Response> | Response;

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

    const safeHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower === "authorization") {
        safeHeaders[k] = v.replace(/^(Bearer\s+\S{4}).*/, "$1***");
      } else if (lower !== "cookie") {
        safeHeaders[k] = v;
      }
    });

    const rateLimitPassed = checkApiRateLimit(ip);

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

    const authContext: { userId?: string; apiKeyId?: string } = {};
    let response: Response;
    let errorMessage: string | undefined;

    if (!rateLimitPassed) {
      response = new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    } else {
      try {
        response = await requestAuthStore.run(authContext, () => handler(handlerReq, ctx));
      } catch (e) {
        errorMessage = String(e);
        response = new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const duration = Date.now() - start;

    void logApiRequest({
      method: req.method,
      path: url.pathname,
      statusCode: response.status,
      durationMs: duration,
      requestHeaders: safeHeaders,
      requestBody,
      ip,
      userId: authContext.userId,
      apiKeyId: authContext.apiKeyId,
      error: errorMessage,
    });

    return response;
  };
}
