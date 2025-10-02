export const withCors = (statusCode: number, body: any, reqId?: string) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Request-ID": reqId || Date.now().toString(36),
  },
  body: typeof body === "string" ? body : JSON.stringify(body),
});