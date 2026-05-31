export type CompanyRole = 'OWNER' | 'MEMBER';
export type DepartmentRole = 'LEADER' | 'TASK_MANAGER' | 'MEMBER';

export const companyRoleLabels: Record<CompanyRole, string> = {
  OWNER: '조직장',
  MEMBER: '조직원',
};

export const departmentRoleLabels: Record<DepartmentRole, string> = {
  LEADER: '부서장',
  TASK_MANAGER: '부서장',
  MEMBER: '부서원',
};

export function isCompanyManager(role?: string | null) {
  return role === 'OWNER';
}

export function canManageTasks(role?: string | null) {
  return role === 'LEADER' || role === 'TASK_MANAGER';
}

export function canEditTask(params: {
  documentStatus?: string;
  taskStatus?: string;
  currentUserId?: number;
  assigneeIds: number[];
  departmentRole?: string | null;
  isOffline?: boolean;
}) {
  const { documentStatus, taskStatus, currentUserId, assigneeIds } = params;
  if (documentStatus === 'PENDING' || documentStatus === 'APPROVED') return false;
  if (taskStatus === 'DONE') return false;
  return currentUserId ? assigneeIds.includes(currentUserId) : false;
}

export function canReviewTask(params: {
  documentStatus?: string;
  departmentRole?: string | null;
}) {
  const { documentStatus, departmentRole } = params;
  if (documentStatus !== 'WORKING') return false;
  return canManageTasks(departmentRole);
}

export function getDocumentStatusLabel(status: string) {
  if (status === 'WORKING') return '작성 중';
  if (status === 'PENDING') return '결재 대기';
  if (status === 'APPROVED') return '승인 완료';
  if (status === 'REJECTED') return '반려';
  return status;
}

export function getTaskStatusLabel(status: string) {
  if (status === 'TODO') return '할 일';
  if (status === 'DOING') return '진행 중';
  if (status === 'DONE') return '완료';
  return status;
}
