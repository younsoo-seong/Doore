import { db, saveDB } from '../data/mockDB';
import type { User } from '../data/mockDB';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      department_members: [...db.department_members]
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
    return { tasks, documents: [...db.documents], task_assignees: [...db.task_assignees] };
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
    db.company_members.push({ company_id: newCompany.id, user_id: userId, role: 'ADMIN', joined_at: new Date().toISOString() });
    
    // Create a default department
    const newDept = {
      id: db.departments.length > 0 ? Math.max(...db.departments.map((d: any) => d.id)) + 1 : 1,
      company_id: newCompany.id, name: '기본 부서', created_at: new Date().toISOString()
    };
    db.departments.push(newDept);
    db.department_members.push({ department_id: newDept.id, user_id: userId, role: 'LEADER' });
    
    saveDB();
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
          name: department ? department.name : '소속 부서 없음',
          role: dm.role
        };
      });
      
      return { 
        ...user, 
        role: m.role, 
        joined_at: m.joined_at,
        departments: userDepts.length > 0 ? userDepts : [{ name: '소속 부서 없음', role: null }]
      };
    });
  },

  addCompanyMember: async (companyId: number, email: string) => {
    await delay(400);
    const user = db.users.find((u: any) => u.email === email);
    if (!user) throw new Error('해당 이메일로 가입된 유저를 찾을 수 없습니다.');
    const exists = db.company_members.find((cm: any) => cm.company_id === companyId && cm.user_id === user.id);
    if (exists) throw new Error('이미 소속된 멤버입니다.');
    const newMember = { company_id: companyId, user_id: user.id, role: 'MEMBER' as const, joined_at: new Date().toISOString() };
    db.company_members.push(newMember);
    saveDB();
    return { ...user, ...newMember, department_name: '소속 부서 없음' };
  },

  updateMemberRole: async (companyId: number, userId: number, role: 'ADMIN' | 'MEMBER') => {
    await delay(200);
    const member = db.company_members.find((cm: any) => cm.company_id === companyId && cm.user_id === userId);
    if (member) { member.role = role; saveDB(); }
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

  addDepartmentMember: async (departmentId: number, userId: number, role: 'LEADER' | 'MEMBER') => {
    await delay(300);
    const exists = db.department_members.find((dm: any) => dm.department_id === departmentId && dm.user_id === userId);
    if (exists) throw new Error('이미 이 부서에 소속되어 있습니다.');
    db.department_members.push({ department_id: departmentId, user_id: userId, role });
    saveDB();
    return true;
  },

  updateDepartmentMemberRole: async (departmentId: number, userId: number, role: 'LEADER' | 'MEMBER') => {
    await delay(200);
    const member = db.department_members.find((dm: any) => dm.department_id === departmentId && dm.user_id === userId);
    if (member) {
      member.role = role;
      saveDB();
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
    return newDoc;
  },

  createTask: async (documentId: number, title: string, userIds: number | number[]) => {
    await delay(300);
    const newTask = {
      id: db.tasks.length > 0 ? Math.max(...db.tasks.map((t: any) => t.id)) + 1 : 1,
      document_id: documentId, title, content: '',
      status: 'TODO' as const, priority: 'MEDIUM' as const,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    db.tasks.push(newTask);

    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const targetIds = ids.slice(0, 5); // Limit max 5
    targetIds.forEach((uid: number) => {
      if (uid > 0) {
        db.task_assignees.push({ task_id: newTask.id, user_id: uid });
      }
    });

    saveDB();
    return newTask;
  },

  updateTaskStatus: async (taskId: number, status: 'TODO'|'DOING'|'DONE') => {
    await delay(200);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) { task.status = status; saveDB(); }
    return true;
  },

  updateTaskContent: async (taskId: number, title: string, content: string) => {
    await delay(250);
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.title = title;
      task.content = content;
      task.updated_at = new Date().toISOString();
      saveDB();
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
      db.task_assignees.push({ task_id: taskId, user_id: uid });
    });
    saveDB();
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
    
    // Sort docTasks to match the order of taskIdsOrder
    const sortedDocTasks = [...docTasks].sort((a: any, b: any) => {
      const idxA = taskIdsOrder.indexOf(a.id);
      const idxB = taskIdsOrder.indexOf(b.id);
      return idxA - idxB;
    });
    
    db.tasks = [...otherTasks, ...sortedDocTasks];
    saveDB();
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
    doc.updated_at = new Date().toISOString();
    saveDB();
    return doc;
  }
};
