import { NextRequest, NextResponse } from "next/server";

import { HustAIUpstreamHttpError, HustAIUpstreamLogicError, queryHustAI } from "@/lib/hust-ai";

interface ApiRequestBody {
  query?: string;
  conversationId?: string;
  userId?: string;
  responseMode?: "streaming" | "sync";
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: ApiRequestBody;
  try {
    payload = (await request.json()) as ApiRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_JSON",
        message: "请求体必须为有效的 JSON。",
      },
      { status: 400 },
    );
  }

  if (!payload.query?.trim()) {
    return NextResponse.json(
      {
        error: "MISSING_QUERY",
        message: "字段 query 为必填项。",
      },
      { status: 400 },
    );
  }

  try {
    const upstreamResponse = await queryHustAI({
      query: payload.query,
      conversationId: payload.conversationId,
      responseMode: payload.responseMode,
    });

    const contentType = upstreamResponse.headers.get("content-type") || "text/plain";

    if (!upstreamResponse.body) {
      const text = await upstreamResponse.text();
      return NextResponse.json(
        {
          error: "EMPTY_RESPONSE",
          message: "上游接口未返回数据。",
          details: text,
        },
        { status: 502 },
      );
    }

    try {
      const clone = upstreamResponse.clone();
      const bodyText = await clone.text();
      console.log("[ai-chat] 上游原始响应：", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: [...upstreamResponse.headers.entries()],
        body: bodyText,
      });
    } catch (e) {
      console.error("[ai-chat] 无法读取上游响应体：", e);
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);

  return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[ai-chat] 调用上游接口失败", error);
    // 打印上游返回的详细信息（若有）
    if (error instanceof Response) {
      try {
        const clone = error.clone();
        const body = await clone.text();
        console.error("[ai-chat] 上游 Response:", {
          status: error.status,
          statusText: error.statusText,
          headers: [...error.headers.entries()],
          body,
        });
      } catch (e) {
        console.error("[ai-chat] 读取上游 Response 失败:", e);
      }
    } else if (error && typeof error === "object") {
      const e = error as Record<string, unknown>;
      console.error("[ai-chat] 错误对象:", {
        name: typeof e.name === "string" ? e.name : null,
        message: typeof e.message === "string" ? e.message : null,
        code: typeof e.code === "number" || typeof e.code === "string" ? e.code : null,
        upstreamMessage: typeof e.upstreamMessage === "string" ? e.upstreamMessage : null,
        stack: typeof e.stack === "string" ? e.stack : null,
      });

      const potentialResponse = e.response;
      if (
        potentialResponse &&
        typeof potentialResponse === "object" &&
        "text" in potentialResponse &&
        typeof (potentialResponse as { text?: unknown }).text === "function"
      ) {
        try {
          const respText = await (potentialResponse as { text: () => Promise<string> }).text();
          console.error("[ai-chat] 嵌套 response body:", respText);
        } catch (innerErr) {
          console.error("[ai-chat] 读取嵌套 response 失败:", innerErr);
        }
      }
    } else {
      console.error("[ai-chat] 未知类型错误:", error);
    }
    if (error instanceof HustAIUpstreamLogicError) {
      return NextResponse.json(
        {
          error: "UPSTREAM_RESPONSE_ERROR",
          message: "华中大 AI 服务返回错误响应，请稍后重试。",
          upstreamCode: error.code,
          upstreamMessage: error.upstreamMessage ?? "上游未提供错误详情。",
          upstreamData: error.data ?? null,
          attempts: error.attempts,
        },
        { status: 502 },
      );
    }

    if (error instanceof HustAIUpstreamHttpError) {
      return NextResponse.json(
        {
          error: "UPSTREAM_HTTP_ERROR",
          message: "华中大 AI 服务接口暂时不可用，请稍后重试。",
          upstreamStatus: error.status,
          upstreamStatusText: error.statusText,
          upstreamBody: error.body ?? null,
          attempts: error.attempts,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "UPSTREAM_ERROR",
        message: "华中大 AI 服务暂时不可用，请稍后重试。",
      },
      { status: 502 },
    );
  }
}
