const DEFAULT_API_URL = "https://ai.hust.edu.cn/proxy/chatai-session/agent/sseProxy/chat_query";

export interface HustAIQuery {
  query: string;
  conversationId?: string;
  userId?: string;
  responseMode?: "streaming" | "sync";
}

export interface HustAIConfigOverrides {
  appId?: number;
  referer?: string;
  origin?: string;
  acceptLanguage?: string;
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  conversationId?: string;
}

interface HustAIEnvConfig {
  apiUrl: string;
  bearerToken: string;
  cookie?: string;
  appId: number;
  referer?: string;
  defaultUserId?: string;
  defaultConversationId?: string;
  userAgent?: string;
  origin?: string;
  acceptLanguage?: string;
  extraHeaders: Record<string, string>;
}

interface HustAIJsonEnvelope {
  code?: number;
  msg?: string | null;
  message?: string | null;
  data?: unknown;
}

export class HustAIUpstreamLogicError extends Error {
  constructor(
    public readonly code: number,
    public readonly upstreamMessage?: string | null,
    public readonly data?: unknown,
    public readonly attempts = 1,
  ) {
    const summary = `华中大 AI 返回错误 code=${code}${upstreamMessage ? `，msg=${upstreamMessage}` : ""}`;
    super(summary);
    this.name = "HustAIUpstreamLogicError";
  }
}

export class HustAIUpstreamHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string,
    public readonly attempts = 1,
  ) {
    const summary = `华中大 AI HTTP 错误 ${status} ${statusText}`;
    super(summary);
    this.name = "HustAIUpstreamHttpError";
  }
}

const parseEnvConfig = (): HustAIEnvConfig => {
  const apiUrl = process.env.HUST_AI_API_URL?.trim() || DEFAULT_API_URL;
  const bearerToken = process.env.HUST_AI_BEARER_TOKEN?.trim();
  if (!bearerToken) {
    throw new Error("Missing HUST_AI_BEARER_TOKEN environment variable.");
  }

  const cookie = process.env.HUST_AI_COOKIE?.trim();
  const referer = process.env.HUST_AI_REFERER?.trim();
  const defaultUserId = process.env.HUST_AI_DEFAULT_USER_ID?.trim();
  const defaultConversationId = process.env.HUST_AI_DEFAULT_CONVERSATION_ID?.trim();
  const appIdRaw = process.env.HUST_AI_APP_ID?.trim();
  const userAgent = process.env.HUST_AI_USER_AGENT?.trim();
  const acceptLanguage = process.env.HUST_AI_ACCEPT_LANGUAGE?.trim();
  const originFromEnv = process.env.HUST_AI_ORIGIN?.trim();
  const appId = appIdRaw ? Number.parseInt(appIdRaw, 10) : 143;

  let derivedOrigin: string | undefined;
  if (!originFromEnv && referer) {
    try {
      derivedOrigin = new URL(referer).origin;
    } catch {
      derivedOrigin = undefined;
    }
  }

  const extraHeadersRaw = process.env.HUST_AI_EXTRA_HEADERS?.trim();
  let extraHeaders: Record<string, string> = {};
  if (extraHeadersRaw) {
    try {
      extraHeaders = JSON.parse(extraHeadersRaw) as Record<string, string>;
    } catch {
      console.warn("[hust-ai] 无法解析 HUST_AI_EXTRA_HEADERS，必须为 JSON 对象字符串");
    }
  }

  return {
    apiUrl,
    bearerToken,
    cookie,
    appId: Number.isFinite(appId) ? appId : 143,
    referer,
    defaultUserId,
  defaultConversationId,
    userAgent,
    acceptLanguage,
    origin: originFromEnv || derivedOrigin,
    extraHeaders,
  };
};

export const normaliseConversationId = (conversationId?: string): string => {
  if (conversationId?.trim()) {
    return conversationId.trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return crypto.randomUUID();
};

export type HustAIResponse = Response;

export async function queryHustAI(
  { query, conversationId, userId, responseMode = "streaming" }: HustAIQuery,
  overrides: HustAIConfigOverrides = {},
): Promise<HustAIResponse> {
  const envConfig = parseEnvConfig();
  const { appId, referer, origin, acceptLanguage, userAgent, extraHeaders } = {
    appId: envConfig.appId,
    referer: envConfig.referer,
    origin: envConfig.origin,
    acceptLanguage: envConfig.acceptLanguage,
    userAgent: envConfig.userAgent,
    extraHeaders: envConfig.extraHeaders,
    ...overrides,
  };

  const resolvedConversationId = normaliseConversationId(
    overrides.conversationId?.trim() || conversationId?.trim() || envConfig.defaultConversationId,
  );
  const providedUserId = userId?.trim();
  let resolvedUserId = envConfig.defaultUserId?.trim();

  if (!resolvedUserId && providedUserId) {
    resolvedUserId = providedUserId;
  }

  if (!resolvedUserId) {
    throw new Error(
      "Missing HUST AI user identifier. Please configure HUST_AI_DEFAULT_USER_ID in the environment or supply a valid override.",
    );
  }

  if (providedUserId && providedUserId !== resolvedUserId) {
    console.warn(
      `[hust-ai] Provided userId "${providedUserId}" does not match the configured default. Using the configured value to avoid upstream authentication errors.`,
    );
  }

  const requestBody = {
    appId,
    AppConversationID: resolvedConversationId,
    UserID: resolvedUserId,
    ResponseMode: responseMode,
    Query: query,
    QueryExtends: {
      Files: [] as Array<unknown>,
    },
  };

  const upstreamHeaders = new Headers({
    accept: "*/*",
    authorization: `Bearer ${envConfig.bearerToken}`,
    "content-type": "application/json",
  });

  if (userAgent) {
    upstreamHeaders.set("user-agent", userAgent);
  }

  if (envConfig.cookie) {
    upstreamHeaders.set("cookie", envConfig.cookie);
  }

  upstreamHeaders.set("sec-fetch-mode", "cors");
  upstreamHeaders.set("sec-fetch-site", "same-origin");
  upstreamHeaders.set("sec-fetch-dest", "empty");

  if (acceptLanguage) {
    upstreamHeaders.set("accept-language", acceptLanguage);
  }

  const effectiveReferer = referer;
  if (effectiveReferer) {
    upstreamHeaders.set("referer", effectiveReferer);
  }

  const effectiveOrigin = origin;
  if (effectiveOrigin) {
    upstreamHeaders.set("origin", effectiveOrigin);
  }

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (key && typeof value === "string" && !upstreamHeaders.has(key)) {
        upstreamHeaders.set(key, value);
      }
    }
  }

  const requestPayload = JSON.stringify(requestBody);
  const maxAttempts = responseMode === "streaming" ? 2 : 3;

  const delay = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

  const maskHeaderValue = (val: string | null | undefined): string | null | undefined => {
    if (val == null) return val;
    // 保留末尾 4 个字符作为辨识信息，其余掩码
    if (val.length <= 8) return "***REDACTED***";
    return "*".repeat(Math.max(0, val.length - 4)) + val.slice(-4);
  };

  // 打印请求的全部内容（对敏感头做掩码）
  try {
    const headersObj: Record<string, string | null | undefined> = {};
    for (const [key, value] of upstreamHeaders.entries()) {
      const lk = key.toLowerCase();
      if (lk === "authorization" || lk === "cookie" || lk.includes("token") || lk.includes("secret")) {
        headersObj[key] = maskHeaderValue(value);
      } else {
        headersObj[key] = value;
      }
    }

    console.debug("[hust-ai] 上游请求原始内容：", {
      url: envConfig.apiUrl,
      method: "POST",
      headers: headersObj,
      // 同时包含解析后的对象和原始序列化字符串，方便调试
      bodyObject: requestBody,
      rawBody: requestPayload,
    });
  } catch (err) {
    console.warn("[hust-ai] 无法打印上游请求内容：", err);
  }

  const isRetriableError = (error: unknown): boolean => {
    if (error instanceof HustAIUpstreamLogicError) {
      return error.code >= 500 && error.code < 600;
    }
    if (error instanceof HustAIUpstreamHttpError) {
      return error.status >= 500 && error.status < 600;
    }
    if (error instanceof TypeError) {
      // Node fetch throws TypeError on network failures.
      return true;
    }
    return false;
  };

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(envConfig.apiUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: requestPayload,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new HustAIUpstreamHttpError(response.status, response.statusText, errorBody, attempt);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          // 打印原始返回内容
          const raw = await response.clone().text();
          console.debug("[hust-ai] 上游原始返回：", raw);

          try {
            const envelope = JSON.parse(raw) as HustAIJsonEnvelope;
            if (typeof envelope?.code === "number" && envelope.code !== 200) {
              console.error("[hust-ai] 上游返回业务错误", {
          code: envelope.code,
          msg: envelope.msg ?? envelope.message ?? null,
          data: envelope.data ?? null,
          attempt,
              });
              throw new HustAIUpstreamLogicError(
          envelope.code,
          envelope.msg ?? envelope.message,
          envelope.data,
          attempt,
              );
            }
          } catch {
            // 忽略 JSON 解析错误（有时 upstream 声明了 JSON 但实际不是）
          }
        } catch (error) {
          console.warn("[hust-ai] 无法读取上游原始文本，尝试回退至 JSON 解析", error);
          // 如果读取原始文本失败，降级到原有的 json() 检查逻辑
          try {
            const envelope = (await response.clone().json()) as HustAIJsonEnvelope;
            if (typeof envelope?.code === "number" && envelope.code !== 200) {
              console.error("[hust-ai] 上游返回业务错误", {
          code: envelope.code,
          msg: envelope.msg ?? envelope.message ?? null,
          data: envelope.data ?? null,
          attempt,
              });
              throw new HustAIUpstreamLogicError(
          envelope.code,
          envelope.msg ?? envelope.message,
          envelope.data,
          attempt,
              );
            }
          } catch (err) {
            if (err instanceof HustAIUpstreamLogicError) {
              throw err;
            }
            // 忽略解析错误
          }
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetriableError(error)) {
        break;
      }

      const backoffMs = 300 * Math.pow(2, attempt - 1);
      console.warn(
        `[hust-ai] 请求失败，准备重试 (${attempt}/${maxAttempts})，等待 ${backoffMs}ms`,
        error instanceof Error ? { name: error.name, message: error.message } : error,
      );
      // eslint-disable-next-line no-await-in-loop
      await delay(backoffMs);
    }
  }

  if (lastError instanceof HustAIUpstreamLogicError) {
    throw lastError;
  }
  if (lastError instanceof HustAIUpstreamHttpError) {
    throw lastError;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("未知上游错误，且无法重试成功。", { cause: lastError as unknown });
}
