import { db, saveDB } from '../data/mockDB';
import type { User } from '../data/mockDB';
import { emitDemoEvent } from '../utils/eventBus';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getDocumentCompanyId = (document: any) => {
  const department = db.departments.find((d: any) => d.id === document.department_id);
  return department?.company_id ?? null;
};

const getDocumentOwnerId = (document: any) => {
  const companyId = getDocumentCompanyId(document);
  return db.company_members.find((cm: any) => cm.company_id === companyId && cm.role === 'OWNER')?.user_id ?? null;
};

export const api = {
  // Authentication
  login: async (email: string, _password?: string): Promise<{ user: User; token: string }> => {
    await delay(600);
    const user = db.users.find((u: any) => u.email === email);
    if (!user) throw new Error('User not found. Please check your email.');
    return { user, token: `mock-jwt-token-${user.id}` };
  },

  signup: async (email: string, name: string, password?: string): Promise<{ user: User; token: string }> => {
    await delay(800);
    const existing = db.users.find((u: any) => u.email === email);
    if (existing) throw new Error('Email already exists.');
    const newUser: User = {
      id: db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1,
      email, name, password, created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDB();
    return { user: newUser, token: `mock-jwt-token-${newUser.id}` };
  },

  // Data Fetching
  getDashboardData: async () => {
    await delay(500);
    return {
      tasks: [...db.tasks],
      documents: [...db.documents],
      task_assignees: [...db.task_assignees],
      users: [...db.users],
      notifications: [...db.notifications],
      chat_messages: [...(db.chat_messages || [])],
      department_members: [...db.department_members],
      companies: [...db.companies],
      departments: [...db.departments],
      company_members: [...db.company_members],
    };
  },

  getDocuments: async (departmentId?: number) => {
    await delay(400);
    const docs = departmentId ? db.documents.filter((d: any) => d.department_id === departmentId) : db.documents;
    return { documents: docs, users: [...db.users] };
  },

  getTasksData: async (documentId?: number) => {
    await delay(400);
    const tasks = documentId ? db.tasks.filter((t: any) => t.document_id === documentId) : db.tasks;
    return {
      tasks,
      documents: [...db.documents],
      task_assignees: [...db.task_assignees],
      users: [...db.users],
      department_members: [...db.department_members],
    };
  },

  // Notifications
  getNotifications: async (userId: number) => {
    await delay(300);
    return db.notifications.filter((n: any) => n.user_id === userId).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  markNotificationAsRead: async (notificationId: number) => {
    await delay(200);
    const notif = db.notifications.find((n: any) => n.id === notificationId);
    if (notif) { notif.is_read = true; saveDB(); }
    return true;
  },

  markAllAsRead: async (userId: number) => {
    await delay(300);
    let changed = false;
    db.notifications.forEach((n: any) => {
      if (n.user_id === userId && !n.is_read) { n.is_read = true; changed = true; }
    });
    if (changed) saveDB();
    return true;
  },

  // Messenger
  getCompanyChatMessages: async (companyId: number, departmentId?: number | null) => {
    await delay(200);
    const companyMessages = (db.chat_messages || [])
      .filter((message: any) => (
        message.company_id === companyId &&
        (departmentId ? message.department_id === departmentId : true)
      ))
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return {
      messages: companyMessages,
      users: [...db.users],
    };
  },

  sendCompanyChatMessage: async (companyId: number, senderId: number, content: string, departmentId?: number | null) => {
    await delay(180);
    const trimmed = content.trim();
    if (!trimmed) throw new Error('메시지를 입력해 주세요.');
    if (!departmentId) throw new Error('메신저 부서를 선택해 주세요.');

    db.chat_messages ||= [];
    const now = new Date().toISOString();
    const message = {
      id: db.chat_messages.length > 0 ? Math.max(...db.chat_messages.map((item: any) => item.id)) + 1 : 1,
      company_id: companyId,
      department_id: departmentId,
      sender_id: senderId,
      content: trimmed,
      created_at: now,
    };
    db.chat_messages.push(message);
    saveDB();
    emitDemoEvent({
      title: '메신저 메시지 전송',
      api: 'POST /api/v1/companies/{companyId}/messages',
      method: 'POST',
      tables: ['chat_messages'],
      summary: '선택한 부서 메신저에 새 메시지를 저장하고 구독자에게 전달합니다.',
      payload: `{ department_id: ${departmentId}, sender_id: ${senderId}, content: "${trimmed}" }`,
      result: `message_id=${message.id}`,
    });
    return message;
  },

  // Company (Workspace) Management
  getCompanies: async (userId: number) => {
    await delay(200);
    const userCompanyIds = db.company_members.filter((cm: any) => cm.user_id === userId).map((cm: any) => cm.company_id);
    return db.companies.filter((c: any) => userCompanyIds.includes(c.id));
  },

  createCompany: async (userId: number, name: string) => {
    await delay(500);
    const newCompany = {
      id: db.companies.length > 0 ? Math.max(...db.companies.map((c: any) => c.id)) + 1 : 1,
      name, created_at: new Date().toISOString()
    };
    db.companies.push(newCompany);
    db.company_members.push({ company_id: newCompany.id, user_id: userId, role: 'OWNER', joined_at: new Date().toISOString() });
    
    // Create a default department
    const newDept = {
      id: db.departments.length > 0 ? Math.max(...db.departments.map((d: any) => d.id)) + 1 : 1,
      company_id: newCompany.id, name: '기본 부서', created_at: new Date().toISOString()
    };
    db.departments.push(newDept);
    db.department_members.push({ department_id: newDept.id, user_id: userId, role: 'LEADER' });
    
    saveDB();
    emitDemoEvent({
      title: '조직 생성',
      api: 'POST /api/v1/companies',
      method: 'POST',
      tables: ['companies', 'company_members', 'departments'],
      summary: '새 조직을 만들고 생성자를 조직장으로 등록합니다.',
      payload: `{ name: "${name}" }`,
      result: `company_id=${newCompany.id}, role=OWNER`,
    });
    return newCompany;
  },

  updateCompany: async (companyId: number, name: string) => {
    await delay(400);
    const comp = db.companies.find((c: any) => c.id === companyId);
    if (comp) { comp.name = name; saveDB(); }
    return comp;
  },

  // Member Management (with Department Info)
  getCompanyMembers: async (companyId: number) => {
    await delay(300);
    const companyDepts = db.departments.filter((d: any) => d.company_id === companyId);
    const deptIds = companyDepts.map((d: any) => d.id);
    
    const members = db.company_members.filter((cm: any) => cm.company_id === companyId);
    return members.map((m: any) => {
      const user = db.users.find((u: any) => u.id === m.user_id);
      
      // Find all departments this user belongs to in this company
      const deptMembers = db.department_members.filter((dm: any) => dm.user_id === m.user_id && deptIds.includes(dm.department_id));
      const userDepts = deptMembers.map((dm: any) => {
        const department = companyDepts.find((d: any) => d.id === dm.department_id);
        return {
          id: department ? department.id : null,
          name: department ? department.name : '소속 부서 없음',
          role: dm.role
        };
      });
      
      return { 
        ...user, 
        role: m.role, 
        joined_at: m.joined_at,
        departments: userDepts.length > 0 ? userDepts : [{ id: null, name: '소속 부서 없음', role: null }]
      };
    });
  },

  addCompanyMember: async (companyId: number, email: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER') => {
    await delay(400);
    const user = db.users.find((u: any) => u.email === email);
    if (!user) throw new Error('해당 이메일로 가입된 유저를 찾을 수 없습니다.');
    const exists = db.company_members.find((cm: any) => cm.company_id === companyId && cm.user_id === user.id);
    if (exists) throw new Error('이미 소속된 멤버입니다.');
    const newMember = { company_id: companyId, user_id: user.id, role, joined_at: new Date().toISOString() };
    db.company_members.push(newMember);
    saveDB();
    emitDemoEvent({
      title: '조직원 초대',
      api: 'POST /api/v1/companies/{companyId}/members',
      method: 'POST',
      tables: ['company_members', 'notifications'],
      summary: '가입된 사용자를 조직에 초대하고 회사 권한을 부여합니다.',
      payload: `{ email: "${email}", role: "${role}" }`,
      result: `${user.name} 조직 합류`,
    });
    return { ...user, ...newMember, department_name: '소속 부서 없음' };
  },

  updateMemberRole: async (companyId: number, userId: number, role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    await delay(200);
    const member = db.company_members.find((cm: any) => cm.company_id === companyId && cm.user_id === userId);
    if (member) {
      member.role = role;
      saveDB();
      emitDemoEvent({
        title: '조직 권한 변경',
        api: 'PATCH /api/v1/companies/{companyId}/members/{userId}',
        method: 'PATCH',
        tables: ['company_members'],
        summary: '조직장/관리자/조직원 권한을 갱신합니다.',
        payload: `{ role: "${role}" }`,
        result: `user_id=${userId}`,
      });
    }
    return true;
  },

  removeMember: async (companyId: number, userId: number) => {
    await delay(300);
    const index = db.company_members.findIndex((cm: any) => cm.company_id === companyId && cm.user_id === userId);
    if (index > -1) { db.company_members.splice(index, 1); saveDB(); }
    return true;
  },

  verifyUserEmail: async (email: string) => {
    await delay(200);
    const user = db.users.find((u: any) => u.email === email);
    if (!user) throw new Error('가입되지 않은 이메일입니다.');
    return user;
  },

  getAllUsers: async () => {
    await delay(200);
    return db.users;
  },

  // Department Management
  getDepartments: async (companyId: number) => {
    await delay(200);
    return db.departments.filter((d: any) => d.company_id === companyId);
  },
  
  createDepartment: async (companyId: number, name: string) => {
    await delay(400);
    const newDept = {
      id: db.departments.length > 0 ? Math.max(...db.departments.map((d: any) => d.id)) + 1 : 1,
      company_id: companyId, name, created_at: new Date().toISOString()
    };
    db.departments.push(newDept);
    saveDB();
    emitDemoEvent({
      title: '부서 생성',
      api: 'POST /api/v1/companies/{companyId}/departments',
      method: 'POST',
      tables: ['departments'],
      summary: '조직 하위에 협업 부서를 생성합니다.',
      payload: `{ name: "${name}" }`,
      result: `department_id=${newDept.id}`,
    });
    return newDept;
  },

  updateDepartment: async (departmentId: number, name: string) => {
    await delay(300);
    const dept = db.departments.find((d: any) => d.id === departmentId);
    if (dept) { dept.name = name; saveDB(); }
    return dept;
  },

  getDepartmentMembers: async (departmentId: number) => {
    await delay(200);
    const deptMembers = db.department_members.filter((dm: any) => dm.department_id === departmentId);
    return deptMembers.map((dm: any) => {
      const user = db.users.find((u: any) => u.id === dm.user_id);
      return { ...user, role: dm.role };
    });
  },

  addDepartmentMember: async (departmentId: number, userId: number, role: 'LEADER' | 'TASK_MANAGER' | 'MEMBER') => {
    await delay(300);
    const exists = db.department_members.find((dm: any) => dm.department_id === departmentId && dm.user_id === userId);
    if (exists) throw new Error('이미 이 부서에 소속되어 있습니다.');
    db.department_members.push({ department_id: departmentId, user_id: userId, role });
    saveDB();
    emitDemoEvent({
      title: role === 'LEADER' || role === 'TASK_MANAGER' ? '부서장 배치' : '부서원 배치',
      api: 'POST /api/v1/departments/{deptId}/members',
      method: 'POST',
      tables: ['department_members', 'notifications'],
      summary: '부서에 사용자를 배치하고 부서장/부서원 역할을 부여합니다.',
      payload: `{ user_id: ${userId}, role: "${role}" }`,
      result: `department_id=${departmentId}`,
    });
    return true;
  },

  updateDepartmentMemberRole: async (departmentId: number, userId: number, role: 'LEADER' | 'TASK_MANAGER' | 'MEMBER') => {
    await delay(200);
    const member = db.department_members.find((dm: any) => dm.department_id === departmentId && dm.user_id === userId);
    if (member) {
      member.role = role;
      saveDB();
      emitDemoEvent({
        title: '부서 권한 변경',
        api: 'PATCH /api/v1/departments/{deptId}/members/{userId}',
        method: 'PATCH',
        tables: ['department_members'],
        summary: '계정을 부서장 또는 부서원으로 변경합니다.',
        payload: `{ role: "${role}" }`,
        result: `user_id=${userId}`,
      });
    }
    return true;
  },

  removeDepartmentMember: async (departmentId: number, userId: number) => {
    await delay(200);
    const index = db.department_members.findIndex((dm: any) => dm.department_id === departmentId && dm.user_id === userId);
    if (index > -1) { db.department_members.splice(index, 1); saveDB(); }
    return true;
  },

  // Workflow (Documents & Tasks)
  createDocument: async (departmentId: number, title: string, userId: number) => {
    await delay(400);
    const newDoc = {
      id: db.documents.length > 0 ? Math.max(...db.documents.map((d: any) => d.id)) + 1 : 1,
      department_id: departmentId, title, content: '',
      status: 'WORKING' as const, created_by: userId, approver_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    db.documents.push(newDoc);
    saveDB();
    emitDemoEvent({
      title: '부서 문서 생성',
      api: 'POST /api/v1/departments/{departmentId}/documents',
      method: 'POST',
      tables: ['documents'],
      summary: '부서장이 협업 문서를 생성하고 Task 분할을 시작합니다.',
      payload: `{ title: "${title}" }`,
      result: `document.status=WORKING`,
    });
    return newDoc;
  },

  createTask: async (documentId: number, title: string, userIds: number | number[]) => {
    await delay(300);
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const targetIds = ids.slice(0, 5); // Limit max 5
    const now = new Date().toISOString();
    const newTask = {
      id: db.tasks.length > 0 ? Math.max(...db.tasks.map((t: any) => t.id)) + 1 : 1,
      document_id: documentId,
      title,
      requirement: '',
      content: '',
      status: 'TODO' as const,
      due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      created_by: targetIds[0] || 1,
      assignee_count: targetIds.length,
      insertion_index: db.tasks.filter((t: any) => t.document_id === documentId).length,
      block_order: db.tasks.filter((t: any) => t.document_id === documentId).length + 1,
      created_at: now,
      updated_at: now
    };
    db.tasks.push(newTask);

    targetIds.forEach((uid: number) => {
      if (uid > 0) {
        db.task_assignees.push({ task_id: newTask.id, user_id: uid, assigned_at: now });
        db.notifications.push({
          id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
          user_id: uid,
          type: 'TASK_ASSIGNED',
          message: `새로운 Task 담당자로 지정되었습니다: ${title}`,
          is_read: false,
          created_at: now,
        });
      }
    });

    saveDB();
    emitDemoEvent({
      title: 'Task 생성 및 담당자 할당',
      api: 'POST /api/v1/documents/{documentId}/tasks',
      method: 'POST',
      tables: ['tasks', 'task_assignees', 'notifications'],
      summary: '문서를 Task 단위로 분할하고 담당 부서원을 지정합니다.',
      payload: `{ title: "${title}", assignee_ids: [${targetIds.join(', ')}] }`,
      result: `task_id=${newTask.id}, status=TODO`,
    });
    return newTask;
  },

  updateTaskStatus: async (taskId: number, status: 'TODO'|'DOING'|'DONE') => {
    await delay(200);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.status = status;
      task.updated_at = new Date().toISOString();
      saveDB();
      emitDemoEvent({
        title: status === 'DONE' ? 'Task 완료 및 잠금' : 'Task 상태 변경',
        api: 'PATCH /api/v1/tasks/{taskId}/status',
        method: 'PATCH',
        tables: ['tasks', 'notifications'],
        summary: status === 'DONE' ? '완료된 Task를 읽기 전용으로 잠급니다.' : 'Task 칸반 상태를 갱신합니다.',
        payload: `{ status: "${status}" }`,
        result: `task_id=${taskId}`,
      });
    }
    return true;
  },

  approveTask: async (taskId: number, reviewerId: number) => {
    await delay(250);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (!task) throw new Error('Task를 찾을 수 없습니다.');
    const document = db.documents.find((d: any) => d.id === task.document_id);
    if (document?.status !== 'WORKING') throw new Error('작성 중 문서의 Task만 승인할 수 있습니다.');

    const now = new Date().toISOString();
    task.status = 'DONE';
    task.updated_at = now;

    const assigneeIds = db.task_assignees
      .filter((assignee: any) => assignee.task_id === taskId)
      .map((assignee: any) => assignee.user_id);

    assigneeIds.forEach((userId: number) => {
      db.notifications.push({
        id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
        user_id: userId,
        type: 'TASK_STATUS_CHANGED',
        message: `Task가 승인되어 완료 처리되었습니다: ${task.title}`,
        is_read: false,
        created_at: now,
      });
    });

    saveDB();
    emitDemoEvent({
      title: 'Task 승인 및 완료 처리',
      api: 'PATCH /api/v1/tasks/{taskId}/approve',
      method: 'PATCH',
      tables: ['tasks', 'notifications'],
      summary: 'Task를 DONE 상태로 전환하고 담당자에게 승인 완료 알림을 발송합니다.',
      payload: `{ reviewer_id: ${reviewerId} }`,
      result: `task_id=${taskId}, status=DONE`,
    });
    return task;
  },

  rejectTask: async (taskId: number, reviewerId: number, reason: string) => {
    await delay(300);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (!task) throw new Error('Task를 찾을 수 없습니다.');
    if (task.status !== 'DONE') throw new Error('완료된 Task만 반려할 수 있습니다.');
    const document = db.documents.find((d: any) => d.id === task.document_id);
    if (document?.status !== 'WORKING') throw new Error('작성 중 문서의 Task만 반려할 수 있습니다.');

    const now = new Date().toISOString();
    task.status = 'DOING';
    task.content = reason.trim() ? `[반려]\n${reason.trim()}` : '[반려]';
    task.rejected_at = now;
    task.rejected_by = reviewerId;
    task.updated_at = now;

    const assigneeIds = db.task_assignees
      .filter((assignee: any) => assignee.task_id === taskId)
      .map((assignee: any) => assignee.user_id);

    assigneeIds.forEach((userId: number) => {
      db.notifications.push({
        id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
        user_id: userId,
        type: 'TASK_STATUS_CHANGED',
        message: `Task가 반려되어 다시 작업이 필요합니다: ${task.title}${reason ? ` (${reason})` : ''}`,
        is_read: false,
        created_at: now,
      });
    });

    saveDB();
    emitDemoEvent({
      title: 'Task 반려 및 재작업 요청',
      api: 'PATCH /api/v1/tasks/{taskId}/reject',
      method: 'PATCH',
      tables: ['tasks', 'notifications'],
      summary: '완료된 Task를 반려하고 DOING 상태로 되돌려 담당자가 다시 편집할 수 있게 합니다.',
      payload: `{ reviewer_id: ${reviewerId}, reason: "${reason}" }`,
      result: `task_id=${taskId}, status=DOING`,
    });
    return task;
  },

  reopenTaskForEdit: async (taskId: number, reviewerId: number) => {
    await delay(250);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (!task) throw new Error('Task를 찾을 수 없습니다.');
    const document = db.documents.find((d: any) => d.id === task.document_id);
    if (document?.status !== 'WORKING') throw new Error('작성 중 문서의 Task만 수정 모드로 전환할 수 있습니다.');

    const now = new Date().toISOString();
    task.status = 'DOING';
    task.updated_at = now;

    const assigneeIds = db.task_assignees
      .filter((assignee: any) => assignee.task_id === taskId)
      .map((assignee: any) => assignee.user_id);

    assigneeIds.forEach((userId: number) => {
      db.notifications.push({
        id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
        user_id: userId,
        type: 'TASK_STATUS_CHANGED',
        message: `Task가 수정 가능 상태로 전환되었습니다: ${task.title}`,
        is_read: false,
        created_at: now,
      });
    });

    saveDB();
    emitDemoEvent({
      title: 'Task 수정 모드 전환',
      api: 'PATCH /api/v1/tasks/{taskId}/reopen',
      method: 'PATCH',
      tables: ['tasks', 'notifications'],
      summary: '완료된 Task를 DOING 상태로 되돌리고 담당자가 다시 편집할 수 있게 합니다.',
      payload: `{ reviewer_id: ${reviewerId} }`,
      result: `task_id=${taskId}, status=DOING`,
    });
    return task;
  },

  updateTaskContent: async (taskId: number, title: string, content: string) => {
    await delay(250);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.title = title;
      task.content = content;
      task.updated_at = new Date().toISOString();
      saveDB();
      emitDemoEvent({
        title: '실시간 공동 편집 병합',
        api: 'PUB /pub/tasks/{taskId}/edit',
        method: 'WSS',
        tables: ['tasks'],
        summary: '입력 변경분을 서버 정책 계층 검증 후 CRDT 병합 결과로 반영합니다.',
        payload: '{ version, patch }',
        result: `task_id=${taskId} updated`,
      });
    }
    return task;
  },

  getTaskById: async (taskId: number) => {
    await delay(200);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (!task) throw new Error('Task를 찾을 수 없습니다.');
    const document = db.documents.find((d: any) => d.id === task.document_id);
    const assignees = db.task_assignees.filter((ta: any) => ta.task_id === taskId).map((ta: any) => ta.user_id);
    return { task, document, assignees };
  },

  updateTaskAssignees: async (taskId: number, userIds: number[]) => {
    await delay(250);
    if (userIds.length < 1) {
      throw new Error('최소 한 명 이상의 담당자가 지정되어야 합니다.');
    }
    if (userIds.length > 5) {
      throw new Error('담당자는 최대 5명까지만 지정할 수 있습니다.');
    }
    // Delete old assignees
    db.task_assignees = db.task_assignees.filter((ta: any) => ta.task_id !== taskId);
    // Push new assignees
    userIds.forEach((uid) => {
      db.task_assignees.push({ task_id: taskId, user_id: uid, assigned_at: new Date().toISOString() });
    });
    saveDB();
    emitDemoEvent({
      title: 'Task 담당자 재할당',
      api: 'POST /api/v1/tasks/{taskId}/assignees',
      method: 'POST',
      tables: ['task_assignees', 'notifications'],
      summary: 'Task 담당자 목록을 갱신합니다.',
      payload: `{ assignee_ids: [${userIds.join(', ')}] }`,
      result: `task_id=${taskId}`,
    });
    return true;
  },

  getDocument: async (documentId: number) => {
    await delay(200);
    return db.documents.find((d: any) => d.id === documentId);
  },

  updateDocumentTitle: async (documentId: number, title: string) => {
    await delay(200);
    const doc = db.documents.find((d: any) => d.id === documentId);
    if (doc) {
      doc.title = title;
      doc.updated_at = new Date().toISOString();
      saveDB();
    }
    return doc;
  },

  updateDocumentCover: async (documentId: number, hasCover: boolean, subtitle: string, description: string) => {
    await delay(200);
    const doc = db.documents.find((d: any) => d.id === documentId);
    if (doc) {
      doc.has_cover_page = hasCover;
      doc.cover_subtitle = subtitle;
      doc.cover_description = description;
      doc.updated_at = new Date().toISOString();
      saveDB();
    }
    return doc;
  },

  reorderTasks: async (documentId: number, taskIdsOrder: number[]) => {
    await delay(300);
    // Fetch doc tasks and other tasks
    const docTasks = db.tasks.filter((t: any) => t.document_id === documentId);
    const otherTasks = db.tasks.filter((t: any) => t.document_id !== documentId);
    const now = new Date().toISOString();
    
    // Sort docTasks to match the order of taskIdsOrder
    const sortedDocTasks = [...docTasks].sort((a: any, b: any) => {
      const idxA = taskIdsOrder.indexOf(a.id);
      const idxB = taskIdsOrder.indexOf(b.id);
      const safeIdxA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
      const safeIdxB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
      return safeIdxA - safeIdxB;
    });

    sortedDocTasks.forEach((task: any, index: number) => {
      task.insertion_index = index;
      task.block_order = index + 1;
      task.updated_at = now;
    });
    
    db.tasks = [...otherTasks, ...sortedDocTasks];
    saveDB();
    emitDemoEvent({
      title: 'Task 순서 변경',
      api: 'PATCH /api/v1/documents/{documentId}/tasks/order',
      method: 'PATCH',
      tables: ['tasks'],
      summary: '문서에 포함된 Task 블록 순서를 재정렬합니다.',
      payload: `{ task_ids: [${taskIdsOrder.join(', ')}] }`,
      result: `document_id=${documentId}`,
    });
    return true;
  },

  requestDocumentApproval: async (documentId: number) => {
    await delay(600);
    // 1. Check if all tasks belonging to this document are DONE
    const relatedTasks = db.tasks.filter((t: any) => t.document_id === documentId);
    if (relatedTasks.length === 0) throw new Error('통합할 Task가 없습니다.');
    const allDone = relatedTasks.every((t: any) => t.status === 'DONE');
    if (!allDone) {
      throw new Error('완료되지 않은 Task가 존재합니다. 모든 Task를 DONE 상태로 변경 후 승인 요청을 진행해주세요.');
    }

    // 2. Integration: Merge all task contents into the document
    const doc = db.documents.find((d: any) => d.id === documentId);
    if (!doc) throw new Error('문서를 찾을 수 없습니다.');
    
    let integratedContent = '';
    relatedTasks.forEach((t: any) => {
      integratedContent += `[${t.title}]\n${t.content}\n\n`;
    });
    
    doc.content = integratedContent.trim();
    doc.status = 'PENDING';
    doc.approver_id = getDocumentOwnerId(doc) || doc.approver_id;
    doc.updated_at = new Date().toISOString();
    if (doc.approver_id) {
      db.notifications.push({
        id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
        user_id: doc.approver_id,
        type: 'DOC_APPROVAL_REQUEST',
        message: `문서 승인 요청이 도착했습니다: ${doc.title}`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }
    saveDB();
    emitDemoEvent({
      title: '문서 통합 및 승인 요청',
      api: 'POST /api/v1/documents/{documentId}/approval-requests',
      method: 'POST',
      tables: ['documents', 'tasks', 'notifications'],
      summary: '완료된 Task 결과물을 문서로 통합하고 PENDING 상태로 잠급니다.',
      payload: '{}',
      result: `document_id=${documentId}, status=PENDING`,
    });
    return doc;
  },

  getApprovalDocuments: async (userId: number) => {
    await delay(300);
    const approverDocs = db.documents.filter((d: any) => {
      const ownerId = getDocumentOwnerId(d);
      return ownerId === userId && (d.status === 'PENDING' || d.status === 'APPROVED');
    });
    return {
      documents: approverDocs,
      tasks: [...db.tasks],
      users: [...db.users],
      departments: [...db.departments],
    };
  },

  approveDocument: async (documentId: number, approverId: number) => {
    await delay(400);
    const doc = db.documents.find((d: any) => d.id === documentId);
    if (!doc) throw new Error('문서를 찾을 수 없습니다.');
    if (doc.status !== 'PENDING') throw new Error('결재 대기 문서만 승인할 수 있습니다.');
    const ownerId = getDocumentOwnerId(doc);
    if (ownerId !== approverId) throw new Error('조직장만 승인할 수 있습니다.');
    doc.status = 'APPROVED';
    doc.approver_id = ownerId;
    doc.updated_at = new Date().toISOString();
    db.notifications.push({
      id: db.notifications.length > 0 ? Math.max(...db.notifications.map((n: any) => n.id)) + 1 : 1,
      user_id: doc.created_by,
      type: 'DOC_APPROVED',
      message: `문서가 승인되었습니다: ${doc.title}`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    saveDB();
    emitDemoEvent({
      title: '문서 승인',
      api: 'PATCH /api/v1/documents/{documentId}/approve',
      method: 'PATCH',
      tables: ['documents', 'notifications'],
      summary: '조직장이 결재 대기 문서를 승인하고 영구 읽기 전용 상태로 전환합니다.',
      payload: '{}',
      result: `document_id=${documentId}, status=APPROVED`,
    });
    return doc;
  },

  
};
