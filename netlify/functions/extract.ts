// netlify/functions/extract.ts
import type { Handler } from "@netlify/functions";
import OpenAI from "openai";
import fetch from "node-fetch";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RAW_APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || "").trim();

type ExtractReq = {
  images: string[]; // data URLs (max 2)
  file: { file_name: string; mime_type: string; file_size: number; file_hash: string };
};

const schema = {
  document_type: null,
  name_full: null,
  date_issued: null,
  date_expiry: null,
  document_number: null,
  document_number_type: null,
  issuer: null,
  confidence: {},
  extras: {},
  file: {},
  audit: {},
};

const systemPrompt = `
You are a meticulous document analyst.
Read up to TWO images of the same document (page 1–2).
Output STRICT JSON matching the provided schema.
- Parse dates as YYYY-MM-DD.
- For numbers: prefer one explicitly labeled Licence/License/Certificate/Policy Number.
- If both a licence number and a card number exist, choose licence as primary.
- If ambiguous, set document_number null and include all candidates in extras.identifiers[] with labels and confidences.
- Include document_number_type describing the chosen primary (e.g., "licence_number", "certificate_number", "policy_number", "card_number").
- Put additional fields (e.g., licence_class, state, dob, address) into extras.
Return ONLY valid JSON.
`.trim();

const userPrompt = (schemaJson: string) => `
Extract fields using this schema (keys must match; values can be null if absent):
${schemaJson}

Document hints (non-exclusive):
- Government ID (driver licence, passport)
- White Card (CPCWHS1001)
- High Risk Work Licence
- Verification of Competency (VOC)
- Insurance Certificate of Currency
`.trim();

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.abs((a - b) / (1000 * 60 * 60 * 24));
}

function isAppsScriptLibraryUrl(url: string) {
  return /\/macros\/library\/d\//i.test(url);
}

function normalizeAppsScriptUrl(url: string) {
  if (!url) throw new Error("APPS_SCRIPT_URL missing");
  // Absolute requirement: must be a Web App /exec endpoint
  if (isAppsScriptLibraryUrl(url)) {
    throw new Error(
      "APPS_SCRIPT_URL points to a /library/ URL. Use your Web App deployment URL instead: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
    );
  }
  // Convert .../dev to .../exec (common copy-paste slip)
  const devMatch = url.match(/^(https:\/\/script\.google\.com\/macros\/s\/[^/]+)\/dev$/i);
  if (devMatch) return `${devMatch[1]}/exec`;
  return url;
}

function isLikelyHtml(contentType: string | null | undefined, bodyText: string) {
  if (contentType && contentType.toLowerCase().includes("application/json")) return false;
  return /<!DOCTYPE html>|<html/i.test(bodyText);
}

// Timezone-safe date normalization
function normalizeToISODate(s: any): string | null {
  if (!s) return null;
  
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Extract date-only pattern to avoid timezone shifts
  const match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  
  // Fallback for formats like "15 Sep 2025"
  try {
    const date = new Date(s);
    if (isNaN(date.getTime())) return null;
    // Use UTC to prevent timezone shifts
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

const withCors = (statusCode: number, body: any, reqId?: string) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Request-ID": reqId || Date.now().toString(36),
  },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  const reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const startTime = Date.now();

  if (event.httpMethod === "OPTIONS") {
    return withCors(200, {}, reqId);
  }

  if (event.httpMethod !== "POST") {
    return withCors(405, { error: "Method Not Allowed" }, reqId);
  }

  // Diagnostic mode - quick preflight check
  if (event.queryStringParameters?.diagnostic === 'true') {
    return withCors(200, {
      ok: true,
      mode: 'diagnostic',
      env: {
        model: MODEL,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasAppsScriptUrl: !!RAW_APPS_SCRIPT_URL,
        appsScriptUrlValid: !isAppsScriptLibraryUrl(RAW_APPS_SCRIPT_URL)
      },
      timestamp: new Date().toISOString()
    }, reqId);
  }

  let APPS_SCRIPT_URL: string;
  try {
    APPS_SCRIPT_URL = normalizeAppsScriptUrl(RAW_APPS_SCRIPT_URL);
  } catch (e: any) {
    return withCors(500, {
      error: e?.message || "Invalid APPS_SCRIPT_URL",
      hint:
        "Open your Apps Script → Deploy → Manage deployments → copy the Web app URL that ends with /exec and set it in Netlify env APPS_SCRIPT_URL.",
    }, reqId);
  }

  try {
    const body = JSON.parse(event.body || "{}") as ExtractReq;
    
    // Validate required fields
    if (!body.images?.length || !body.file?.file_hash) {
      return withCors(400, { error: "images[] and file.file_hash required" }, reqId);
    }

    // Validate max image count
    if (body.images.length > 2) {
      return withCors(400, { error: "Maximum 2 images allowed" }, reqId);
    }

    // Validate payload size (prevent huge base64 strings)
    const totalBase64Size = body.images.reduce((sum, dataUrl) => {
      const b64 = dataUrl.split(',')[1] || '';
      return sum + b64.length;
    }, 0);

    const MAX_BASE64_BYTES = 20 * 1024 * 1024; // 20MB
    if (totalBase64Size > MAX_BASE64_BYTES) {
      return withCors(413, { 
        error: "Images too large after encoding",
        hint: "Try reducing PDF quality or image resolution. Total base64 size exceeds 20MB.",
        size: `${(totalBase64Size / 1024 / 1024).toFixed(2)}MB`
      }, reqId);
    }

    console.log('[Extract] Started', { 
      reqId, 
      fileSize: body.file.file_size,
      imageCount: body.images.length,
      base64Size: `${(totalBase64Size / 1024 / 1024).toFixed(2)}MB`
    });

    // Duplicate check via Apps Script GET ?hash=
    let isDupWithin7Days = false;
    try {
      const hashURL = `${APPS_SCRIPT_URL}?hash=${encodeURIComponent(body.file.file_hash)}`;
      const hashRes = await fetch(hashURL);
      const hashText = await hashRes.text();
      if (isLikelyHtml(hashRes.headers.get("content-type"), hashText)) {
        throw new Error("Apps Script GET returned HTML (likely wrong URL or permissions).");
      }
      const hashJson = JSON.parse(hashText) as { rows: { timestamp: string; file_hash: string }[] };
      isDupWithin7Days =
        hashJson.rows?.some((r) => r.timestamp && daysBetween(r.timestamp, new Date().toISOString()) <= 7) || false;
    } catch (dupErr: any) {
      console.warn('[Duplicate check failed]', dupErr.message);
      // Non-fatal; continue without duplicate knowledge
    }

    // OpenAI Vision call (JSON mode)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const inputImgs = body.images.slice(0, 2).map((dataUrl) => ({
      type: "image_url" as const,
      image_url: { 
        url: dataUrl,
        detail: "high" as const // OpenAI will auto-scale based on complexity
      },
    }));

    const baseMsg = { 
      type: "text" as const, 
      text: userPrompt(JSON.stringify(schema)) 
    };

    const openaiStart = Date.now();
    const completion1 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            baseMsg,
            ...inputImgs
          ] as Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    console.log('[OpenAI] Completed', { 
      duration: Date.now() - openaiStart,
      tokens: completion1.usage?.total_tokens,
      model: MODEL
    });

    let raw = completion1.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    
    try {
      parsed = JSON.parse(raw);
    } catch {
      // One repair retry (still JSON-only)
      console.warn('[OpenAI] Initial parse failed, retrying with temp 0.0');
      const completion2 = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt + "\nReturn strictly valid JSON only." },
          { 
            role: "user", 
            content: [
              baseMsg,
              ...inputImgs
            ] as Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>
          },
        ],
        temperature: 0.0,
        response_format: { type: "json_object" },
      });
      raw = completion2.choices?.[0]?.message?.content || "{}";
      parsed = JSON.parse(raw);
    }

    // Normalize dates (timezone-safe)
    parsed.date_issued = normalizeToISODate(parsed.date_issued);
    parsed.date_expiry = normalizeToISODate(parsed.date_expiry);

    parsed.file = body.file;
    parsed.audit = {
      ...(parsed.audit || {}),
      model: `openai:${MODEL}`,
      prompt_version: "v0.4",
      duplicate_within_days: isDupWithin7Days ? 7 : 0,
      request_id: reqId,
    };

    // Append to Google Sheet
    const sheetStart = Date.now();
    const postRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    console.log('[Apps Script] Completed', { 
      duration: Date.now() - sheetStart,
      status: postRes.status
    });

    const postText = await postRes.text();
    if (isLikelyHtml(postRes.headers.get("content-type"), postText)) {
      return withCors(502, {
        error: "Apps Script returned HTML instead of JSON.",
        hint:
          "Check that APPS_SCRIPT_URL ends with /exec and that your deployment access is set to 'Anyone'. Try re-deploying the Web app.",
        sample: postText.slice(0, 200),
      }, reqId);
    }

    let postJson: any = {};
    try {
      postJson = JSON.parse(postText);
    } catch {
      return withCors(502, {
        error: "Apps Script returned non-JSON.",
        body: postText.slice(0, 200),
      }, reqId);
    }

    console.log('[Extract] Total duration', Date.now() - startTime, 'ms');

    return withCors(200, { 
      ok: true, 
      duplicate: isDupWithin7Days, 
      sheet: postJson, 
      result: parsed 
    }, reqId);
    
  } catch (err: any) {
    console.error('[Extract] Error', err);
    
    // Check if it's a timeout error
    const isTimeout = err?.message?.includes('timeout') || err?.code === 'ETIMEDOUT';
    
    return withCors(isTimeout ? 504 : 500, { 
      error: String(err?.message || err),
      hint: isTimeout 
        ? "The request took too long. Try a smaller file or check if your Apps Script is responding quickly."
        : "Check server logs for details"
    }, reqId);
  }
};

export default handler;