import { Router } from "express";
import { z } from "zod";
import { analyzeYunxiaoText } from "../services/yunxiaoAI.js";
import { connectionSchema, createYunxiaoTask, getTaskFields, getYunxiaoContext,
  taskSchema } from "../services/yunxiao.js";

export const yunxiaoRouter = Router();

const contextSchema = z.object({ connection: connectionSchema });
const analyzeSchema = z.object({
  text: z.string().trim().min(5).max(12000),
  requirementSubject: z.string().trim().min(1).max(200),
});
const fieldsSchema = contextSchema.extend({
  organizationId: z.string().max(128).regex(/^[\w-]*$/),
  projectId: z.string().min(1).max(128),
  taskTypeId: z.string().min(1).max(128),
});
const createSchema = fieldsSchema.extend({
  parentId: z.string().min(1).max(128),
  assigneeId: z.string().trim().min(1).max(128),
  customFieldValues: z.record(z.string().max(500)),
  task: taskSchema,
});

function message(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

yunxiaoRouter.post("/context", async (req, res) => {
  const parsed = contextSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: "需求链接或令牌无效" }); return; }
  try { res.json({ success: true, ...await getYunxiaoContext(parsed.data.connection) }); }
  catch (error) { res.status(502).json({ success: false, error: message(error) }); }
});

yunxiaoRouter.post("/analyze", async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: "请填写至少 5 字的任务描述" }); return; }
  try { res.json({ success: true, ...await analyzeYunxiaoText(parsed.data.text, parsed.data.requirementSubject) }); }
  catch (error) { res.status(502).json({ success: false, error: message(error) }); }
});

yunxiaoRouter.post("/fields", async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: "参数错误" }); return; }
  try { res.json({ success: true, fields: await getTaskFields(
    parsed.data.connection, parsed.data.organizationId,
    parsed.data.projectId, parsed.data.taskTypeId) }); }
  catch (error) { res.status(502).json({ success: false, error: message(error) }); }
});

yunxiaoRouter.post("/create", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: "请检查任务标题、描述和预计工时" }); return; }
  try { res.json({ success: true, ...await createYunxiaoTask(parsed.data.connection, parsed.data) }); }
  catch (error) { res.status(502).json({ success: false, error: message(error) }); }
});
