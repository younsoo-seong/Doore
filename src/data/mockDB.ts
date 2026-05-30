// 1. 사용자 및 조직 도메인
export interface User {
  id: number;
  email: string;
  password?: string; // 클라이언트 사이드 mock에서는 숨김 처리 가능
  name: string;
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  created_at: string;
}

export interface CompanyMember {
  company_id: number;
  user_id: number;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: string;
}

export interface Department {
  id: number;
  company_id: number;
  name: string;
  created_at: string;
}

export interface DepartmentMember {
  department_id: number;
  user_id: number;
  role: 'LEADER' | 'TASK_MANAGER' | 'MEMBER';
}

// 2. 문서 및 결재 도메인
export interface Document {
  id: number;
  department_id: number;
  title: string;
  content: string;
  status: 'WORKING' | 'PENDING' | 'APPROVED' | 'REJECTED';
  created_by: number;
  approver_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentMember {
  user_id: number;
  document_id: number;
  role: 'READ' | 'WRITE';
}

// 3. Task 및 협업 도메인
export interface Task {
  id: number;
  document_id: number;
  title: string;
  requirement: string;
  content: string;
  status: 'TODO' | 'DOING' | 'DONE';
  due_date: string;
  created_by: number;
  assignee_count: number; // 1 이상 5 이하
  created_at: string;
  updated_at: string;
}

export interface TaskFile {
  id: number;
  task_id: number;
  category: 'REFERENCE' | 'ATTACHMENT';
  type: 'FILE' | 'LINK' | 'IMAGE';
  name: string;
  url: string;
  created_at: string;
}

export interface TaskAssignee {
  task_id: number;
  user_id: number;
  assigned_at?: string;
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  company_id: number;
  department_id: number | null;
  sender_id: number;
  content: string;
  created_at: string;
}

// 4. 알림 도메인
export interface Notification {
  id: number;
  user_id: number;
  type: 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' | 'DOC_APPROVAL_REQUEST' | 'DOC_APPROVED' | 'DOC_REJECTED';
  message: string;
  is_read: boolean;
  created_at: string;
}

// ----------------------------------------------------
// Mock 데이터 테이블 (In-memory DB 역할)
// ----------------------------------------------------

export const users: User[] = [];

export const companies: Company[] = [
];

export const company_members: CompanyMember[] = [
];

export const departments: Department[] = [
];

export const department_members: DepartmentMember[] = [
];

export const documents: Document[] = [
];

export const document_members: DocumentMember[] = [
];

export const tasks: Task[] = [
];

export const task_assignees: TaskAssignee[] = [
];

export const task_files: TaskFile[] = [
];

export const comments: Comment[] = [
];

export const chat_messages: ChatMessage[] = [
];

export const notifications: Notification[] = [
];

const defaultDB = {
  users,
  companies,
  company_members,
  departments,
  department_members,
  documents,
  document_members,
  tasks,
  task_files,
  task_assignees,
  comments,
  chat_messages,
  notifications
};

const stored = localStorage.getItem('doore_mock_db');
export const db = stored ? JSON.parse(stored) : defaultDB;
localStorage.setItem('doore_mock_db', JSON.stringify(db));

const storedUser = localStorage.getItem('doore_user');
if (storedUser) {
  try {
    const currentUser = JSON.parse(storedUser);
    const normalizedUser = db.users.find((user: User) => user.id === currentUser.id);
    if (normalizedUser) {
      localStorage.setItem('doore_user', JSON.stringify(normalizedUser));
    }
  } catch {
    localStorage.removeItem('doore_user');
  }
}

export const saveDB = () => {
  localStorage.setItem('doore_mock_db', JSON.stringify(db));
};
