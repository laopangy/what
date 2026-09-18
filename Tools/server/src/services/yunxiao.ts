import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128).regex(/^[\w-]+$/);

export const connectionSchema = z.object({
  address: z.string().trim().url().max(500),
  requirementId: idSchema,
  token: z.string().trim().min(8).max(500),
});

export const taskSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(10000),
  estimatedHours: z.number().positive().max(1000),
  estimateBasis: z.enum(["explicit", "inferred", "edited"]),
});

export type TaskDraft = z.infer<typeof taskSchema>;
export type ConnectionInput = z.infer<typeof connectionSchema>;

interface Workitem {
  id: string;
  subject: string;
  categoryId?: string;
  space: { id: string; name?: string };
  assignedTo?: { id: string; name?: string };
}

interface WorkitemType {
  id: string;
  name: string;
  categoryId: string;
  enable?: boolean;
  defaultType?: boolean;
}

export interface WorkitemField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  options?: Array<{ id: string; displayValue?: string; value?: string }>;
}

interface ApiLocation {
  origin: string;
  prefix: string;
  organizationId?: string;
}

export function resolveApiLocation(address: string): ApiLocation {
  const url = new URL(address);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("云效地址必须是 HTTPS 地址，且不能包含账号、密码或端口");
  }
  const hostname = url.hostname.toLowerCase();
  const organizationId = url.pathname.match(/\/organization\/([\w-]+)/)?.[1];
  if (hostname === "devops.aliyun.com" || hostname === "openapi-rdc.aliyuncs.com") {
    if (!organizationId) throw new Error("请填写包含 /organization/组织ID 的云效地址");
    return {
      origin: "https://openapi-rdc.aliyuncs.com",
      prefix: `/oapi/v1/projex/organizations/${organizationId}`,
      organizationId,
    };
  }
  if (hostname.endsWith(".rdc.aliyuncs.com")) {
    return { origin: url.origin, prefix: "/oapi/v1/projex" };
  }
  throw new Error("仅支持云效中心版地址或官方 Region 版 rdc.aliyuncs.com 实例域名");
}

async function apiRequest<T>(location: ApiLocation, token: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${location.origin}${location.prefix}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-yunxiao-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`云效请求失败（HTTP ${response.status}）：请检查令牌权限、地址和工作项 ID`);
  }
  if (typeof data === "object" && data !== null && "success" in data && data.success === false) {
    throw new Error("云效拒绝了请求，请检查项目权限与必填字段");
  }
  return data as T;
}

export async function getYunxiaoContext(input: ConnectionInput) {
  const location = resolveApiLocation(input.address);
  const requirement = await apiRequest<Workitem>(
    location, input.token, `/workitems/${encodeURIComponent(input.requirementId)}`,
  );
  if (!requirement.id || !requirement.space?.id) {
    throw new Error("需求信息缺少工作项 ID 或所属项目，请确认填写的是工作项唯一 ID");
  }
  if (requirement.categoryId && requirement.categoryId !== "Req") {
    throw new Error("该工作项不是需求（Req），请填写需求的工作项 ID");
  }
  const taskTypes = await apiRequest<WorkitemType[]>(
    location, input.token,
    `/projects/${encodeURIComponent(requirement.space.id)}/workitemTypes?category=Task`,
  );
  if (!Array.isArray(taskTypes) || !taskTypes.some((type) => type.categoryId === "Task" && type.enable !== false)) {
    throw new Error("该项目没有可用的任务类型，请先在云效中配置任务类型");
  }
  return {
    requirement: {
      id: requirement.id,
      subject: requirement.subject,
      projectId: requirement.space.id,
      projectName: requirement.space.name ?? "",
      assigneeId: requirement.assignedTo?.id ?? "",
      assigneeName: requirement.assignedTo?.name ?? "",
    },
    taskTypes: taskTypes.filter((type) => type.categoryId === "Task" && type.enable !== false)
      .map(({ id, name, defaultType }) => ({ id, name, defaultType: Boolean(defaultType) })),
  };
}

export async function getTaskFields(input: ConnectionInput, projectId: string, taskTypeId: string) {
  const location = resolveApiLocation(input.address);
  const fields = await apiRequest<WorkitemField[]>(
    location, input.token,
    `/projects/${encodeURIComponent(projectId)}/workitemTypes/${encodeURIComponent(taskTypeId)}/fields`,
  );
  if (!Array.isArray(fields)) throw new Error("无法读取任务类型字段配置");
  return fields.filter((field) => field.required &&
    (field.type === "CustomField" || field.type === "SystemCustomField"));
}

export async function createYunxiaoTask(
  input: ConnectionInput,
  options: {
    projectId: string;
    taskTypeId: string;
    assigneeId: string;
    customFieldValues: Record<string, string>;
    task: TaskDraft;
  },
) {
  const location = resolveApiLocation(input.address);
  const context = await getYunxiaoContext(input);
  if (context.requirement.projectId !== options.projectId ||
      !context.taskTypes.some((type) => type.id === options.taskTypeId)) {
    throw new Error("需求所属项目或任务类型已变化，请重新读取需求");
  }
  const requiredFields = await getTaskFields(input, options.projectId, options.taskTypeId);
  for (const field of requiredFields) {
    if (!options.customFieldValues[field.id]?.trim() && !field.defaultValue) {
      throw new Error(`请填写云效必填字段：${field.name}`);
    }
  }
  const result = await apiRequest<{ id: string }>(location, input.token, "/workitems", {
    assignedTo: options.assigneeId,
    customFieldValues: options.customFieldValues,
    description: options.task.description,
    formatType: "MARKDOWN",
    parentId: context.requirement.id,
    spaceId: options.projectId,
    subject: options.task.subject,
    workitemTypeId: options.taskTypeId,
  });
  if (!result?.id) throw new Error("云效未返回新任务 ID；请先到云效检查是否已创建，避免重复提交");
  try {
    await apiRequest<{ id: string }>(
      location, input.token, `/workitems/${encodeURIComponent(result.id)}/estimatedEfforts`,
      { description: options.task.description.slice(0, 200), owner: options.assigneeId,
        spentTime: options.task.estimatedHours },
    );
    return { id: result.id, effortSaved: true };
  } catch {
    return { id: result.id, effortSaved: false,
      warning: "任务已创建，但预计工时登记失败。请到云效任务中手动补录，勿重复创建任务。" };
  }
}
