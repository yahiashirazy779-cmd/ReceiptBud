import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
  GenerateGeminiImageBody,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  chatRateLimiter,
  imageGenRateLimiter,
} from "../../middlewares/rateLimiters";
import { ai } from "@workspace/integrations-gemini-ai";
import { generateImage } from "@workspace/integrations-gemini-ai/image";

const router: IRouter = Router();

// List conversations — only returns conversations owned by the authenticated user
router.get("/gemini/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const allConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(asc(conversations.createdAt));
  res.json(allConversations);
});

// Create conversation — links the new conversation to the authenticated user
router.post("/gemini/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conversation] = await db
    .insert(conversations)
    .values({ userId, title: parsed.data.title })
    .returning();
  res.status(201).json(conversation);
});

// Get conversation with messages — ownership enforced
router.get("/gemini/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...conversation, messages: msgs });
});

// Delete conversation — ownership enforced
router.delete("/gemini/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conversation] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning();
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

// List messages — ownership of the parent conversation enforced
router.get("/gemini/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Verify the conversation belongs to the authenticated user before returning messages
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

// Per-conversation message cap — keeps token costs bounded as history grows
const MAX_MESSAGES_PER_CONVERSATION = 100;

// Send message (SSE streaming) — ownership of the parent conversation enforced
router.post("/gemini/conversations/:id/messages", requireAuth, chatRateLimiter, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = SendGeminiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendGeminiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify the conversation belongs to the authenticated user before processing
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Enforce per-conversation message cap to prevent unbounded token accumulation
  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id));
  if (existingMessages.length >= MAX_MESSAGES_PER_CONVERSATION) {
    res.status(429).json({
      error:
        "This conversation has reached its message limit. Please start a new conversation to continue.",
      code: "CONVERSATION_LIMIT",
    });
    return;
  }

  // Save user message
  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: parsed.data.content,
  });

  // Load history
  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  // Build Gemini context
  const systemPrompt = `You are Bud, a friendly AI financial assistant inside the ReceiptBud app. 
You help users understand their spending, track budgets, and make smarter financial decisions. 
Be concise, friendly, and encouraging. Use a warm, supportive tone. 
If asked about receipts, budgets, or spending patterns, give practical, actionable advice.
Never be preachy — be like a knowledgeable friend who happens to be great with money.`;

  const chatMessages = history.map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents: chatMessages,
      config: {
        maxOutputTokens: 8192,
        systemInstruction: systemPrompt,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }
  } catch (err) {
    req.log.error({ err }, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ content: "Sorry, I'm having trouble responding right now. Please try again!" })}\n\n`);
    fullResponse = "Sorry, I'm having trouble responding right now. Please try again!";
  }

  // Save assistant response
  await db.insert(messages).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// Generate image
router.post("/gemini/generate-image", requireAuth, imageGenRateLimiter, async (req, res): Promise<void> => {
  const parsed = GenerateGeminiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
    res.json({ b64_json, mimeType });
  } catch (err) {
    req.log.error({ err }, "Image generation error");
    res.status(500).json({ error: "Failed to generate image" });
  }
});

export default router;
