import {
  calculateThreeCharts,
  resolveBirthplace,
  InputError,
} from "./calculation";
const VERSION = "0.2.0-candidate";
const birthSchema = {
  type: "object",
  additionalProperties: false,
  required: ["birthDate", "birthTime", "birthplace", "calendar", "gender"],
  properties: {
    birthDate: {
      type: "string",
      description: "생년월일 YYYY-MM-DD, 1900~2050",
    },
    birthTime: {
      type: "string",
      description: "출생 당시 현지 시각 HH:mm. 누락 시 질문한다.",
    },
    birthplace: {
      type: "string",
      description:
        "출생지역. 예: 서울, 부산 해운대구, 경기도 수원시. 현재 거주지와 구분.",
    },
    calendar: {
      type: "string",
      enum: ["solar", "lunar"],
      description: "양력 solar / 음력 lunar. 불명확하면 질문한다.",
    },
    gender: {
      type: "string",
      enum: ["남", "여"],
      description:
        "기존 사주·자미두수 대운 산출에 사용하는 성별. 불명확하면 질문한다.",
    },
    leapMonth: {
      type: "boolean",
      description:
        "음력 윤달이면 true. 기존 사주 앱이 윤달을 지원하지 않아 양력 날짜로 재입력해야 한다.",
    },
    latitude: {
      type: "number",
      minimum: -90,
      maximum: 90,
      description: "해외 출생지 등 정확한 좌표를 알고 있을 때만 입력",
    },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    timezone: {
      type: "string",
      description: "좌표 입력 시 필수 IANA 시간대. 예: Asia/Seoul",
    },
    dstFold: {
      type: "string",
      enum: ["earlier", "later"],
      description: "서머타임 종료의 중복 시각을 구분할 때만 지정",
    },
  },
};
const tools = [
  {
    name: "calculate_three_charts",
    title: "사주·자미두수·서양점성술 함께 계산",
    description:
      "기존 개인 사주 앱의 실제 계산 엔진으로 사주, 자미두수 명반, 서양 출생차트와 각 해석 및 통합 리포트를 계산합니다. 출생정보를 저장하지 않습니다. 생년월일·현지 출생시각·출생지역·양력/음력·성별이 필요합니다. 계산값은 도구 결과만 사용하고 없는 정보는 질문하세요. 쉬운 한국어로 각 체계 및 공통점·차이점을 설명합니다. 기존 앱에서 수동으로 바꾼 설정은 불러오지 않습니다.",
    inputSchema: birthSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "resolve_birthplace",
    title: "국내 출생지역 확인",
    description:
      "기존 앱의 국내 행정구역 좌표 자료로 지역명을 위도·경도·Asia/Seoul로 변환합니다. 모호한 지역은 후보를 반환합니다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["birthplace"],
      properties: { birthplace: { type: "string", maxLength: 100 } },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "three_charts_status",
    title: "삼종 계산 엔진 상태",
    description:
      "개인 전용 사주·자미두수·서양점성술 연결 상태와 입력 기준을 개인정보 없이 확인합니다.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
export function callTool(name: string, args: any) {
  try {
    let value;
    if (name === "calculate_three_charts") value = calculateThreeCharts(args);
    else if (name === "resolve_birthplace")
      value = resolveBirthplace(args?.birthplace);
    else if (name === "three_charts_status")
      value = {
        status: "ready",
        version: VERSION,
        algorithm: "existing-saju-app",
        systems: ["saju", "ziwei", "western"],
        storage: "none",
        required: [
          "birthDate",
          "birthTime",
          "birthplace",
          "calendar",
          "gender",
        ],
        calendar: "solar or lunar; leap lunar month requires solar input",
        location:
          "Korean regions automatic; overseas requires explicit coordinates and IANA timezone",
        defaults: "original app automatic settings; no manual overrides",
        privacy:
          "No database, analytics, birth-data persistence or external geocoding calls",
      };
    else
      return {
        content: [{ type: "text", text: "지원하지 않는 도구입니다." }],
        isError: true,
      };
    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
      structuredContent: value,
      isError: false,
    };
  } catch (e) {
    const value =
      e instanceof InputError
        ? { code: e.code, message: e.message, details: e.details }
        : {
            code: "CALCULATION_FAILED",
            message:
              "기존 엔진이 입력을 계산하지 못했습니다. 날짜·달력·출생시각을 확인해 주세요.",
          };
    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
      structuredContent: { error: value },
      isError: true,
    };
  }
}
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz")
      return json({ status: "ready", version: VERSION });
    if (url.pathname === "/")
      return new Response(
        '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>개인 삼종 명반</title><style>body{max-width:620px;margin:12vh auto;padding:24px;font:17px/1.8 system-ui;color:#24283a;background:#faf9f6}h1{font-size:30px}small{color:#626775}</style><h1>개인 삼종 명반</h1><p>ChatGPT에서 사주·자미두수·서양점성술을 함께 계산하는 개인 전용 도구입니다.</p><p>플러그인을 연결한 대화에서 생년월일, 출생시각, 출생지역, 양력/음력, 성별을 알려주세요.</p><p>예: “1992년 6월 15일 양력, 오후 2시 30분, 서울 출생, 여성이야. 삼종 계산해줘.”</p><small>기존 앱 계산 엔진 사용 · 출생정보 서버 저장 없음</small></html>',
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    if (url.pathname !== "/mcp") return json({ error: "not_found" }, 404);
    if (!request.headers.get("oai-authenticated-user-id"))
      return json({ error: "authentication_required" }, 401);
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405);
    if (Number(request.headers.get("content-length") ?? 0) > 16384)
      return json({ error: "payload_too_large" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384)
      return json({ error: "payload_too_large" }, 413);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
      );
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      body.jsonrpc !== "2.0" ||
      typeof body.method !== "string"
    )
      return json(
        {
          jsonrpc: "2.0",
          id: body?.id ?? null,
          error: { code: -32600, message: "Invalid Request" },
        },
        400,
      );
    if (body.method.startsWith("notifications/"))
      return new Response(null, { status: 202 });
    const id = body.id ?? null;
    let result;
    if (body.method === "server/discover")
      result = {
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {} },
        serverInfo: { name: "soyeon-three-charts", version: VERSION },
      };
    else if (body.method === "initialize")
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "soyeon-three-charts", version: VERSION },
        instructions:
          "개인 전용. 출생정보가 부족하면 질문하고 calculate_three_charts를 호출한다. 임의 계산이나 시각 추정 금지.",
      };
    else if (body.method === "ping") result = {};
    else if (body.method === "tools/list") result = { tools };
    else if (body.method === "tools/call")
      result = callTool(body.params?.name, body.params?.arguments ?? {});
    else
      return json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Method not found" },
      });
    return json({ jsonrpc: "2.0", id, result });
  },
};
