import type { Handler } from "@netlify/functions";
import OpenAI from "openai";
import { withCors } from "./utils/cors"; 

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type PreCheckRequest = {
  image: string; // Single image data URL
};

const preCheckPrompt = `You are a document classifier. Analyze this image and determine if it is an OFFICIAL IDENTITY DOCUMENT or CERTIFICATE.

SUPPORTED document types:
- Government ID (driver license, passport, birth certificate, national ID)
- Work safety cards (White Card CPCWHS1001, High Risk Work Licence)
- Professional certificates (Verification of Competency, training certificates)
- Insurance certificates (Certificate of Currency)

UNSUPPORTED types (return is_document: false):
- Receipts, invoices, bills
- Letters, emails, text documents
- Screenshots, photos of screens
- Personal photos, selfies, landscapes
- Blank pages, handwritten notes
- Any non-official document

Return JSON with:
{
  "is_document": boolean,
  "confidence": number (0.0 to 1.0),
  "detected_type": string (e.g., "driver_license", "receipt", "photo", "screenshot"),
  "reasoning": string (brief explanation)
}

Be strict: only return is_document: true if you're confident it's an official document.`;


export const handler: Handler = async (event) => {
  const reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  if (event.httpMethod === "OPTIONS") {
    return withCors(200, {}, reqId);
  }

  if (event.httpMethod !== "POST") {
    return withCors(405, { error: "Method Not Allowed" }, reqId);
  }

  try {
    const body = JSON.parse(event.body || "{}") as PreCheckRequest;

    if (!body.image) {
      return withCors(400, { error: "image data URL required" }, reqId);
    }

    console.log('[PreCheck] Started', { reqId });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: preCheckPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: body.image,
                detail: "low" as const // Use low detail to save costs
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const result = JSON.parse(raw);

    console.log('[PreCheck] Result', {
      is_document: result.is_document,
      confidence: result.confidence,
      detected_type: result.detected_type
    });

    return withCors(200, {
      ok: true,
      result
    }, reqId);

  } catch (err: any) {
    console.error('[PreCheck] Error', err);

    // Handle OpenAI-specific errors
    if (err.status === 429 || err.code === 'rate_limit_exceeded') {
      return withCors(429, {
        error: "rate_limit_exceeded",
        userMessage: "Too many requests right now. Please wait 30 seconds and try again.",
        retryable: true
      }, reqId);
    }

    if (err.status === 401 || err.code === 'invalid_api_key') {
      return withCors(503, {
        error: "invalid_api_key",
        userMessage: "API configuration error. Please contact the developer.",
        retryable: false
      }, reqId);
    }

    if (err.code === 'insufficient_quota' || err.message?.includes('quota')) {
      return withCors(503, {
        error: "insufficient_quota",
        userMessage: "The developer has run out of API credits and needs to top up. Email gysagsohn@hotmail.com and tell them to stop being a tightass! 😅 (Auto top-up is disabled, so manual intervention required.)",
        retryable: false
      }, reqId);
    }

    // Generic error
    return withCors(500, {
      error: String(err?.message || err),
      userMessage: "Pre-check failed. You can still try uploading, but it might not work.",
      retryable: true
    }, reqId);
  }
};

export default handler;