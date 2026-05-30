import { Router } from "express";
import { z } from "zod";
import { handleChat } from "../services/chatService.js";

export const chatRouter = Router();

chatRouter.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })
      ),
    }).parse(req.body);

    const result = await handleChat(body.messages);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});
