// "Playbook light" — a lightweight, AI-inferred company profile (value
// prop, ICP, industry, competitors) from the rep's own company website,
// deliberately not full document ingestion (see
// mem/design/coaching-memory-v1.md's reasoning for deferring that bigger
// org-playbook idea). Two actions:
//   - "analyze": fetches a URL and asks an LLM to infer the profile fields.
//     Does NOT persist anything — the rep reviews/edits before saving.
//   - "save": persists the (possibly rep-edited) final fields.
// Both require a caller JWT (anonymous is fine, same as every other
// function except the two webhooks).
import { getCallerUser, serviceRoleClient } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
// Cheap, fast, good enough for structured extraction from a homepage —
// this runs once per rep (or whenever they change their URL), not per
// conversation, so cost/latency here barely matters either way.
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_PAGE_TEXT_CHARS = 6000;

interface InferredProfile {
  companyName: string | null;
  valueProp: string | null;
  icp: string | null;
  industry: string | null;
  competitors: string | null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CornerProfileBot/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status ${res.status})`);
  }
  const html = await res.text();
  return stripHtmlToText(html).slice(0, MAX_PAGE_TEXT_CHARS);
}

async function inferProfile(url: string, pageText: string): Promise<InferredProfile> {
  if (!OPENAI_API_KEY) {
    throw new Error("Company profile analysis isn't configured yet (missing OPENAI_API_KEY).");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You infer a short B2B sales company profile from raw website text. Be concise — this is spoken context for a voice sales coach, not documentation. Return strict JSON with exactly these keys: companyName (string or null), valueProp (one sentence, what they sell and the outcome it delivers, or null), icp (one sentence describing their ideal customer — industry/size/role, or null), industry (a short phrase, or null), competitors (a short comma-separated list of likely competitors if inferable, or null). If the text doesn't give enough signal for a field, use null rather than guessing wildly.",
        },
        { role: "user", content: `Website: ${url}\n\nPage text:\n${pageText}` },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`AI analysis request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI analysis returned no content");
  }
  const parsed = JSON.parse(content);
  return {
    companyName: parsed.companyName ?? null,
    valueProp: parsed.valueProp ?? null,
    icp: parsed.icp ?? null,
    industry: parsed.industry ?? null,
    competitors: parsed.competitors ?? null,
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getCallerUser(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.action === "analyze") {
      const url = typeof body.url === "string" ? normalizeUrl(body.url) : null;
      if (!url) {
        return jsonResponse({ error: "url is required" }, { status: 400 });
      }
      const pageText = await fetchPageText(url);
      const profile = await inferProfile(url, pageText);
      return jsonResponse({ profile });
    }

    if (body.action === "save") {
      const admin = serviceRoleClient();
      const { error } = await admin.from("user_profile").upsert(
        {
          user_id: user.id,
          display_name: typeof body.displayName === "string" ? body.displayName.trim() || null : undefined,
          role: typeof body.role === "string" ? body.role : undefined,
          company_url: typeof body.companyUrl === "string" ? body.companyUrl.trim() || null : undefined,
          company_name: typeof body.companyName === "string" ? body.companyName.trim() || null : undefined,
          value_prop: typeof body.valueProp === "string" ? body.valueProp.trim() || null : undefined,
          icp: typeof body.icp === "string" ? body.icp.trim() || null : undefined,
          industry: typeof body.industry === "string" ? body.industry.trim() || null : undefined,
          competitors: typeof body.competitors === "string" ? body.competitors.trim() || null : undefined,
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error(`Failed to save profile: ${error.message}`);
      return jsonResponse({ saved: true });
    }

    return jsonResponse({ error: `Unsupported action: ${body.action}` }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[company-profile]", message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
