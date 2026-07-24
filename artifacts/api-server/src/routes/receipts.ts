import { Router, type IRouter } from "express";
import { eq, and, ilike, desc, asc } from "drizzle-orm";
import { db, receiptsTable } from "@workspace/db";
import {
  ListReceiptsQueryParams,
  CreateReceiptBody,
  ScanReceiptBody,
  GetReceiptParams,
  UpdateReceiptParams,
  UpdateReceiptBody,
  DeleteReceiptParams,
  ToggleReceiptFavoriteParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { scanRateLimiter } from "../middlewares/rateLimiters";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";

function getOpenRouterKey(): string {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("OPENROUTER_API_KEY secret is not yet available. Please stop and restart the Replit environment (not just the workflow) to pick up newly added secrets.");
  return key;
}

const router: IRouter = Router();

// List receipts
router.get("/receipts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = ListReceiptsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(receiptsTable).where(eq(receiptsTable.userId, userId)).$dynamic();

  if (params.data.favorite !== undefined && params.data.favorite !== null) {
    const favBool = String(params.data.favorite) === "true";
    query = query.where(and(eq(receiptsTable.userId, userId), eq(receiptsTable.isFavorite, favBool)));
  }

  if (params.data.category) {
    query = query.where(and(eq(receiptsTable.userId, userId), eq(receiptsTable.category, params.data.category)));
  }

  if (params.data.search) {
    query = query.where(and(eq(receiptsTable.userId, userId), ilike(receiptsTable.storeName, `%${params.data.search}%`)));
  }

  const sortOrder = params.data.sortOrder === "asc" ? asc : desc;
  const sortField = params.data.sortBy === "total" ? receiptsTable.total
    : params.data.sortBy === "storeName" ? receiptsTable.storeName
    : receiptsTable.createdAt;

  query = query.orderBy(sortOrder(sortField));

  const receipts = await query;

  res.json(receipts.map(r => ({
    ...r,
    total: parseFloat(r.total),
    tax: r.tax ? parseFloat(r.tax) : null,
    discount: r.discount ? parseFloat(r.discount) : null,
  })));
});

// Scan receipt with Gemini AI
router.post("/receipts/scan", requireAuth, scanRateLimiter, async (req, res): Promise<void> => {
  const parsed = ScanReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, mimeType = "image/jpeg" } = parsed.data;

  const prompt = `You are an expert multilingual receipt scanner and OCR system. Analyze this receipt image thoroughly and extract all structured data.

RECEIPT TYPES SUPPORTED:
- Physical printed receipts (supermarkets, restaurants, pharmacies, gas stations, electronics, retail)
- Digital receipts / screenshots from apps or websites
- Email receipts (order confirmations, invoices)
- Bank or card transaction screenshots
- Any other proof of purchase

LANGUAGE HANDLING:
- Automatically detect the receipt language — support ALL languages including English, Arabic, French, Spanish, German, Italian, Portuguese, Turkish, Hindi, Chinese (Simplified/Traditional), Japanese, Korean, Russian, Greek, Thai, Hebrew, Dutch, Polish, Swedish, Norwegian, Danish, Finnish, and any other
- Translate all item names into English regardless of the original language
- Correct OCR mistakes using context clues
- Use surrounding context to infer missing or unclear characters

CURRENCY HANDLING:
- Automatically detect currency from symbols (€, £, ¥, ₹, ﷼, ₩, ฿, ₺, etc.) or codes
- Supported currencies: USD, EUR, GBP, EGP, SAR, AED, KWD, QAR, BHD, OMR, TRY, JPY, CNY, KRW, INR, CAD, AUD, CHF, SEK, NOK, DKK, PLN, MXN, BRL, HKD, SGD, THB, ZAR, RUB, and any other

Return ONLY valid JSON with this EXACT structure (no markdown, no extra text):
{
  "storeName": "store name in English",
  "date": "YYYY-MM-DD",
  "time": "HH:MM or null",
  "total": number,
  "tax": number or null,
  "discount": number or null,
  "paymentMethod": "cash|card|credit|debit|mobile|other or null",
  "currency": "ISO 4217 currency code e.g. USD, EUR, GBP, EGP, SAR, AED, KWD, etc.",
  "category": "Groceries|Transport|Entertainment|Restaurants|Bills|Electronics|Shopping|Education|Pets|Travel|Health|Subscriptions|Other",
  "detectedLanguage": "English|Arabic|French|Spanish|German|Italian|Portuguese|Turkish|Hindi|Chinese|Japanese|Korean|Russian|Other",
  "originalLanguage": "name of the detected language",
  "items": [
    {
      "name": "item name translated to English",
      "originalName": "item name in original language if different",
      "price": number,
      "quantity": number or null,
      "category": "category string or null",
      "uncertain": false
    }
  ],
  "uncertainItems": ["list of item names where OCR confidence is low"],
  "confidenceScore": number between 0 and 100,
  "ocrAccuracy": "High|Medium|Low",
  "aiInsight": "one helpful financial insight about this purchase in one sentence",
  "isBlurry": false,
  "partiallyReadable": false,
  "warnings": []
}

If the image is blurry or unreadable, set isBlurry:true and still extract whatever you can.
If only partial text is readable, set partiallyReadable:true and extract all readable items.
Mark uncertain items in the uncertainItems array and set uncertain:true on those items.
Set confidenceScore based on how complete and accurate the extraction is (0-100).
Set ocrAccuracy to High (>85%), Medium (60-85%), or Low (<60%).`;

  try {
    const apiKey = getOpenRouterKey();
    const orRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!orRes.ok) {
      const errBody = await orRes.json().catch(() => ({})) as any;
      const errMsg: string = errBody?.error?.message ?? orRes.statusText;
      req.log.error({ status: orRes.status, errMsg }, "OpenRouter API error");
      if (orRes.status === 429) {
        res.status(429).json({ error: "AI quota exceeded. Please wait a moment and try again.", code: "RATE_LIMIT" });
        return;
      }
      if (orRes.status === 401 || orRes.status === 403) {
        res.status(503).json({ error: "Invalid API key. Please check your OpenRouter key.", code: "AUTH_FAILED" });
        return;
      }
      res.status(500).json({ error: `AI service error: ${errMsg}`, code: "SCAN_FAILED" });
      return;
    }

    const json = await orRes.json() as any;
    const text: string = json.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(422).json({ error: "Could not extract receipt data from image" });
      return;
    }
    const data = JSON.parse(jsonMatch[0]);
    res.json(data);
  } catch (err: any) {
    req.log.error({ err }, "OpenRouter scan error");
    const msg: string = err?.message ?? "";
    if (msg.includes("OPENROUTER_API_KEY")) {
      res.status(503).json({ error: msg, code: "CONFIG_ERROR" });
      return;
    }
    res.status(500).json({ error: "Failed to scan receipt. Please try a clearer image.", code: "SCAN_FAILED" });
  }
});

// Create receipt
router.post("/receipts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [receipt] = await db.insert(receiptsTable).values({
    userId,
    storeName: parsed.data.storeName,
    date: parsed.data.date,
    total: String(parsed.data.total),
    tax: parsed.data.tax != null ? String(parsed.data.tax) : null,
    discount: parsed.data.discount != null ? String(parsed.data.discount) : null,
    paymentMethod: parsed.data.paymentMethod ?? null,
    category: parsed.data.category ?? "Other",
    currency: parsed.data.currency ?? "USD",
    notes: parsed.data.notes ?? null,
    imageBase64: parsed.data.imageBase64 ?? null,
    items: (parsed.data.items ?? []) as any,
    aiInsight: parsed.data.aiInsight ?? null,
  }).returning();

  res.status(201).json({
    ...receipt,
    total: parseFloat(receipt.total),
    tax: receipt.tax ? parseFloat(receipt.tax) : null,
    discount: receipt.discount ? parseFloat(receipt.discount) : null,
  });
});

// Get receipt
router.get("/receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = GetReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [receipt] = await db.select().from(receiptsTable)
    .where(and(eq(receiptsTable.id, params.data.id), eq(receiptsTable.userId, userId)));

  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  res.json({
    ...receipt,
    total: parseFloat(receipt.total),
    tax: receipt.tax ? parseFloat(receipt.tax) : null,
    discount: receipt.discount ? parseFloat(receipt.discount) : null,
  });
});

// Update receipt
router.patch("/receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = UpdateReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.storeName != null) updateData.storeName = parsed.data.storeName;
  if (parsed.data.date != null) updateData.date = parsed.data.date;
  if (parsed.data.total != null) updateData.total = String(parsed.data.total);
  if (parsed.data.tax != null) updateData.tax = String(parsed.data.tax);
  if (parsed.data.discount != null) updateData.discount = String(parsed.data.discount);
  if (parsed.data.paymentMethod != null) updateData.paymentMethod = parsed.data.paymentMethod;
  if (parsed.data.category != null) updateData.category = parsed.data.category;
  if (parsed.data.notes != null) updateData.notes = parsed.data.notes;
  if (parsed.data.items != null) updateData.items = parsed.data.items;

  const [receipt] = await db.update(receiptsTable)
    .set(updateData)
    .where(and(eq(receiptsTable.id, params.data.id), eq(receiptsTable.userId, userId)))
    .returning();

  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  res.json({
    ...receipt,
    total: parseFloat(receipt.total),
    tax: receipt.tax ? parseFloat(receipt.tax) : null,
    discount: receipt.discount ? parseFloat(receipt.discount) : null,
  });
});

// Delete receipt
router.delete("/receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = DeleteReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [receipt] = await db.delete(receiptsTable)
    .where(and(eq(receiptsTable.id, params.data.id), eq(receiptsTable.userId, userId)))
    .returning();

  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  res.sendStatus(204);
});

// Toggle favorite
router.patch("/receipts/:id/favorite", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = ToggleReceiptFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(receiptsTable)
    .where(and(eq(receiptsTable.id, params.data.id), eq(receiptsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  const [receipt] = await db.update(receiptsTable)
    .set({ isFavorite: !existing.isFavorite })
    .where(and(eq(receiptsTable.id, params.data.id), eq(receiptsTable.userId, userId)))
    .returning();

  res.json({
    ...receipt,
    total: parseFloat(receipt.total),
    tax: receipt.tax ? parseFloat(receipt.tax) : null,
    discount: receipt.discount ? parseFloat(receipt.discount) : null,
  });
});

export default router;
