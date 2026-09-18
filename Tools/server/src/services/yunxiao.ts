import { z } from "zod";

export const connectionSchema = z.object({
  requirementUrl: z.string().trim().url().max(500),
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
  serialNumber?: string;
  subject: string;
  categoryId?: string;
  space: { id: string; name?: string };
  assignedTo?: { id: string; name?: string };
}

interface Project { id: string; customCode: string; name?: string }
interface Organization { id: string }

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
}

interface RequirementReference { origin: string; serialNumber: string; projectCode: string; central: boolean }

export function parseRequirementLink(link: string): RequirementReference {
  const url = new URL(link);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("需求链接必须是 HTTPS 地址，且不能包含账号、密码或端口");
  }
  const central = url.hostname.toLowerCase() === "devops.aliyun.com";
  if (!central && !url.hostname.toLowerCase().endsWith(".rdc.aliyuncs.com")) {
    throw new Error("仅支持官方云效需求详情链接");
  }
  const match = url.pathname.match(/^\/projex\/req\/([A-Z]{4,6}-\d+)\/?$/);
  if (!match) throw new Error("请粘贴具体需求的详情链接，例如 https://devops.aliyun.com/projex/req/WBGA-13685");
  return {
    origin: central ? "https://openapi-rdc.aliyuncs.com" : url.origin,
    serialNumber: match[1], projectCode: match[1].split("-")[0], central,
  };
}

function locationFor(reference: RequirementReference, organizationId?: string): ApiLocation {
  if (reference.central && (!organizationId || !/^[\w-]+$/.test(organizationId))) {
    throw new Error("无法确认云效组织 ID，已停止请求");
  }
  return {
    origin: reference.origin,
    prefix: reference.central
      ? `/oapi/v1/projex/organizations/${organizationId}`
      : "/oapi/v1/projex",
  };
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

async function listOrganizations(reference: RequirementReference, token: string) {
  if (!reference.central) return [undefined];
  const organizations: Organization[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const result = await apiRequest<Organization[]>(
      { origin: reference.origin, prefix: "/oapi/v1/platform" }, token,
      `/organizations?page=${page}&perPage=100`,
    );
    if (!Array.isArray(result)) throw new Error("无法读取组织列表，请检查令牌的组织只读权限");
    organizations.push(...result.filter((item) => item.id));
    if (result.length < 100) break;
  }
  if (!organizations.length) throw new Error("令牌没有可访问的组织，请检查组织只读权限");
  return organizations.map((item) => item.id);
}

async function findProject(location: ApiLocation, token: string, projectCode: string) {
  for (let page = 1; page <= 10; page += 1) {
    const projects = await apiRequest<Project[]>(location, token, "/projects:search", {
      page, perPage: 200,
    });
    if (!Array.isArray(projects)) throw new Error("无法读取项目列表，请检查项目只读权限");
    const exact = projects.find((project) => project.customCode === projectCode);
    if (exact) return exact;
    if (projects.length < 200) return null;
  }
  throw new Error("项目列表过大，无法安全定位需求所属项目");
}

async function findRequirement(
  location: ApiLocation, token: string, projectId: string, serialNumber: string,
) {
  try {
    const filtered = await apiRequest<Workitem[]>(location, token, "/workitems:search", {
      category: "Req", spaceId: projectId, spaceType: "Project", page: 1, perPage: 20,
      conditions: JSON.stringify({ conditionGroups: [[{
        fieldIdentifier: "serialNumber", operator: "CONTAINS", value: [serialNumber],
        toValue: null, className: "string", format: "input",
      }]] }),
    });
    const exact = Array.isArray(filtered)
      ? filtered.find((item) => item.serialNumber === serialNumber) : undefined;
    if (exact) return exact;
  } catch {
    // Some Yunxiao projects do not expose a serial-number filter; scan pages below.
  }
  // 云效搜索以项目为范围；逐页精确匹配编号，避免把同名需求当成目标。
  for (let page = 1; page <= 150; page += 1) {
    const items = await apiRequest<Workitem[]>(location, token, "/workitems:search", {
      category: "Req", spaceId: projectId, spaceType: "Project", page, perPage: 200,
    });
    if (!Array.isArray(items)) throw new Error("无法读取需求列表，请检查工作项只读权限");
    const exact = items.find((item) => item.serialNumber === serialNumber);
    if (exact) return exact;
    if (items.length < 200) break;
  }
  throw new Error(`未在项目中找到需求 ${serialNumber}；请确认令牌有该项目的读取权限`);
}

export async function getYunxiaoContext(input: ConnectionInput) {
  const reference = parseRequirementLink(input.requirementUrl);
  const matches: Array<{ location: ApiLocation; project: Project; organizationId?: string }> = [];
  for (const organizationId of await listOrganizations(reference, input.token)) {
    const location = locationFor(reference, organizationId);
    try {
      const project = await findProject(location, input.token, reference.projectCode);
      if (project) matches.push({ location, project, organizationId });
    } catch {
      // A token can list an organization without project access; try the other organizations.
    }
  }
  if (matches.length !== 1) {
    throw new Error(matches.length > 1
      ? "多个组织存在相同项目编号，无法仅凭需求链接安全定位，请联系管理员确认组织"
      : `找不到编号为 ${reference.projectCode} 的项目，请检查令牌的组织只读、项目只读权限`);
  }
  const { location, project, organizationId } = matches[0];
  const matched = await findRequirement(location, input.token, project.id, reference.serialNumber);
  const requirement = await apiRequest<Workitem>(
    location, input.token, `/workitems/${encodeURIComponent(matched.id)}`,
  );
  if (requirement.serialNumber !== reference.serialNumber || requirement.space?.id !== project.id ||
      requirement.categoryId !== "Req") {
    throw new Error("需求详情与链接编号或项目不一致，已停止创建");
  }
  const taskTypes = await apiRequest<WorkitemType[]>(
    location, input.token,
    `/projects/${encodeURIComponent(project.id)}/workitemTypes?category=Task`,
  );
  if (!Array.isArray(taskTypes) || !taskTypes.some((type) => type.categoryId === "Task" && type.enable !== false)) {
    throw new Error("该项目没有可用的任务类型，请先在云效中配置任务类型");
  }
  return {
    requirement: {
      id: requirement.id,
      serialNumber: requirement.serialNumber,
      subject: requirement.subject,
      projectId: project.id,
      projectName: project.name ?? requirement.space.name ?? "",
      organizationId: organizationId ?? "",
      assigneeId: requirement.assignedTo?.id ?? "",
      assigneeName: requirement.assignedTo?.name ?? "",
    },
    taskTypes: taskTypes.filter((type) => type.categoryId === "Task" && type.enable !== false)
      .map(({ id, name, defaultType }) => ({ id, name, defaultType: Boolean(defaultType) })),
  };
}

export async function getTaskFields(
  input: ConnectionInput, organizationId: string, projectId: string, taskTypeId: string,
) {
  const location = locationFor(parseRequirementLink(input.requirementUrl), organizationId);
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
    organizationId: string;
    parentId: string;
    projectId: string;
    taskTypeId: string;
    assigneeId: string;
    customFieldValues: Record<string, string>;
    task: TaskDraft;
  },
) {
  const reference = parseRequirementLink(input.requirementUrl);
  const location = locationFor(reference, options.organizationId);
  const requirement = await apiRequest<Workitem>(
    location, input.token, `/workitems/${encodeURIComponent(options.parentId)}`,
  );
  if (requirement.serialNumber !== reference.serialNumber || requirement.space?.id !== options.projectId ||
      requirement.categoryId !== "Req") {
    throw new Error("需求链接与父工作项不一致，已停止创建");
  }
  const taskTypes = await apiRequest<WorkitemType[]>(
    location, input.token,
    `/projects/${encodeURIComponent(options.projectId)}/workitemTypes?category=Task`,
  );
  if (!Array.isArray(taskTypes) || !taskTypes.some((type) => type.id === options.taskTypeId &&
      type.categoryId === "Task" && type.enable !== false)) {
    throw new Error("所选任务类型已不可用，请重新读取需求");
  }
  const requiredFields = await getTaskFields(
    input, options.organizationId, options.projectId, options.taskTypeId,
  );
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
    parentId: requirement.id,
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
