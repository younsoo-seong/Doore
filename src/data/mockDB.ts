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

export const users: User[] = [
  { id: 1, email: 'admin@doore.com', name: '박재홍', created_at: '2026-01-10T09:00:00Z' },
  { id: 2, email: 'leader@doore.com', name: '오승민', created_at: '2026-02-15T10:30:00Z' },
  { id: 3, email: 'member@doore.com', name: '정동재', created_at: '2026-03-20T14:15:00Z' },
  { id: 4, email: 'jhpark@doore.com', name: '박지훈', created_at: '2026-04-05T08:45:00Z' },
  { id: 5, email: 'yjchoi@doore.com', name: '최유진', created_at: '2026-05-01T11:20:00Z' }
];

export const companies: Company[] = [
  { id: 1, name: 'DOORE Corp', created_at: '2026-01-01T00:00:00Z' }
];

export const company_members: CompanyMember[] = [
  { company_id: 1, user_id: 1, role: 'OWNER', joined_at: '2026-01-10T09:00:00Z' },
  { company_id: 1, user_id: 2, role: 'MEMBER', joined_at: '2026-02-15T10:30:00Z' },
  { company_id: 1, user_id: 3, role: 'MEMBER', joined_at: '2026-03-20T14:15:00Z' },
  { company_id: 1, user_id: 4, role: 'ADMIN', joined_at: '2026-04-05T08:45:00Z' },
  { company_id: 1, user_id: 5, role: 'MEMBER', joined_at: '2026-05-01T11:20:00Z' }
];

export const departments: Department[] = [
  { id: 101, company_id: 1, name: '개발 팀', created_at: '2026-01-15T09:00:00Z' },
  { id: 102, company_id: 1, name: '기획 팀', created_at: '2026-01-15T09:00:00Z' }
];

export const department_members: DepartmentMember[] = [
  { department_id: 101, user_id: 1, role: 'MEMBER' }, // 박재홍 (실시간 조회)
  { department_id: 101, user_id: 2, role: 'LEADER' }, // 오승민
  { department_id: 101, user_id: 3, role: 'MEMBER' }, // 정동재
  { department_id: 102, user_id: 2, role: 'LEADER' }, // 오승민
  { department_id: 102, user_id: 4, role: 'LEADER' }, // 박지훈
  { department_id: 102, user_id: 5, role: 'MEMBER' }  // 최유진
];

export const documents: Document[] = [
  {
    id: 1001,
    department_id: 101,
    title: '그룹웨어 아키텍처 1차 보고서',
    content: '시스템 아키텍처 설계 및 ERD 구성안 초안입니다.',
    status: 'WORKING',
    created_by: 1,
    approver_id: 1,
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-09T14:30:00Z'
  },
  {
    id: 1002,
    department_id: 102,
    title: '신규 서비스 기획안',
    content: '신규 서비스에 대한 정책과 요구사항 정리입니다.',
    status: 'PENDING',
    created_by: 4,
    approver_id: 1,
    created_at: '2026-05-08T10:00:00Z',
    updated_at: '2026-05-09T11:30:00Z'
  }
];

export const document_members: DocumentMember[] = [
  { user_id: 2, document_id: 1001, role: 'WRITE' },
  { user_id: 3, document_id: 1001, role: 'READ' }
];

export const tasks: Task[] = [
  {
    id: 5001,
    document_id: 1001,
    title: 'ERD 설계',
    requirement: '데이터베이스 테이블 및 관계도(ERD) 작성',
    content: '사용자, 문서, Task 테이블 스키마 작성 완료.',
    status: 'DONE',
    due_date: '2026-05-10T18:00:00Z',
    created_by: 1,
    assignee_count: 2,
    created_at: '2026-05-05T10:00:00Z',
    updated_at: '2026-05-09T14:00:00Z'
  },
  {
    id: 5002,
    document_id: 1001,
    title: 'API 명세서 작성',
    requirement: 'REST 및 WebSocket API 명세서 작성',
    content: '인터페이스 정의 중...',
    status: 'TODO',
    due_date: '2026-05-12T18:00:00Z',
    created_by: 1,
    assignee_count: 1,
    created_at: '2026-05-08T09:00:00Z',
    updated_at: '2026-05-08T09:00:00Z'
  },
  {
    id: 5003,
    document_id: 1002,
    title: '기획안 작성',
    requirement: '서비스 주요 기능 요구사항 도출',
    content: '요구사항 1차 도출 완료. 리뷰 필요.',
    status: 'DOING',
    due_date: '2026-05-15T18:00:00Z',
    created_by: 4,
    assignee_count: 2,
    created_at: '2026-05-08T10:30:00Z',
    updated_at: '2026-05-09T11:00:00Z'
  }
];

export const task_assignees: TaskAssignee[] = [
  { task_id: 5001, user_id: 2 }, // 오승민
  { task_id: 5001, user_id: 3 }, // 정동재
  { task_id: 5002, user_id: 3 }, // 정동재
  { task_id: 5003, user_id: 4 }, // 박지훈
  { task_id: 5003, user_id: 5 }  // 최유진
];

export const task_files: TaskFile[] = [
  {
    id: 9001,
    task_id: 5001,
    category: 'REFERENCE',
    type: 'IMAGE',
    name: '참고_구조도.png',
    url: 'https://s3.example.com/ref.png',
    created_at: '2026-05-06T10:00:00Z'
  }
];

export const comments: Comment[] = [
  {
    id: 8001,
    task_id: 5001,
    user_id: 1,
    content: 'ERD 스키마에서 알림 도메인 부분 추가 부탁드립니다.',
    created_at: '2026-05-07T14:20:00Z'
  }
];

export const chat_messages: ChatMessage[] = [
  {
    id: 10001,
    company_id: 1,
    department_id: 101,
    sender_id: 2,
    content: 'ERD 설계 리뷰가 끝나면 API 명세 쪽도 같이 확인하겠습니다.',
    created_at: '2026-05-09T15:00:00Z'
  },
  {
    id: 10002,
    company_id: 1,
    department_id: 101,
    sender_id: 3,
    content: '네, API 명세 초안 업데이트 후 공유하겠습니다.',
    created_at: '2026-05-09T15:04:00Z'
  },
  {
    id: 10003,
    company_id: 1,
    department_id: 102,
    sender_id: 4,
    content: '기획안 승인 요청 전에 핵심 기능 범위를 한 번 더 정리하겠습니다.',
    created_at: '2026-05-09T15:12:00Z'
  },
  {
    id: 10004,
    company_id: 1,
    department_id: 102,
    sender_id: 5,
    content: '사용자 시나리오 기준으로 우선순위 표를 업데이트해 두겠습니다.',
    created_at: '2026-05-09T15:16:00Z'
  }
];

export const notifications: Notification[] = [
  {
    id: 7001,
    user_id: 1, // Changed to user 1
    type: 'TASK_ASSIGNED',
    message: '새로운 Task 담당자로 지정되었습니다: ERD 설계',
    is_read: false,
    created_at: '2026-05-09T14:30:00Z'
  },
  {
    id: 7002,
    user_id: 1, // Changed to user 1
    type: 'DOC_APPROVAL_REQUEST',
    message: '기획안 승인 요청이 도착했습니다.',
    is_read: false,
    created_at: '2026-05-09T11:30:00Z'
  },
  {
    id: 7003,
    user_id: 1, // Changed to user 1
    type: 'TASK_STATUS_CHANGED',
    message: '개발 팀에 배치 되었습니다.',
    is_read: true,
    created_at: '2026-05-09T10:30:00Z'
  }
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

function normalizeDB(database: any) {
  const owner = database.company_members?.find((cm: CompanyMember) => cm.company_id === 1 && cm.user_id === 1);
  if (owner) owner.role = 'OWNER';

  const executive = database.users?.find((user: User) => user.id === 1);
  if (executive) {
    executive.email = 'admin@doore.com';
    executive.name = '박재홍';
  }

  const leader = database.users?.find((user: User) => user.id === 2);
  if (leader) {
    leader.email = 'leader@doore.com';
    leader.name = '오승민';
  }

  const member = database.users?.find((user: User) => user.id === 3);
  if (member) {
    member.email = 'member@doore.com';
    member.name = '정동재';
  }

  const plannerAdmin = database.company_members?.find((cm: CompanyMember) => cm.company_id === 1 && cm.user_id === 4);
  if (plannerAdmin && plannerAdmin.role === 'MEMBER') plannerAdmin.role = 'ADMIN';

  const ownerDeptMember = database.department_members?.find((dm: DepartmentMember) => dm.department_id === 101 && dm.user_id === 1);
  if (ownerDeptMember) ownerDeptMember.role = 'MEMBER';

  const departmentLeader = database.department_members?.find((dm: DepartmentMember) => dm.department_id === 101 && dm.user_id === 2);
  if (departmentLeader) departmentLeader.role = 'LEADER';

  const planningLeader = database.department_members?.find((dm: DepartmentMember) => dm.department_id === 102 && dm.user_id === 2);
  if (planningLeader) {
    planningLeader.role = 'LEADER';
  } else {
    database.department_members?.push({ department_id: 102, user_id: 2, role: 'LEADER' });
  }

  const departmentWorker = database.department_members?.find((dm: DepartmentMember) => dm.department_id === 101 && dm.user_id === 3);
  if (departmentWorker) departmentWorker.role = 'MEMBER';

  const apiTask = database.tasks?.find((task: Task) => task.id === 5002);
  if (apiTask) {
    apiTask.created_by = 2;
    apiTask.assignee_count = 1;
  }

  const task5002Assignee = database.task_assignees?.find((assignee: TaskAssignee) => assignee.task_id === 5002);
  if (task5002Assignee) task5002Assignee.user_id = 3;

  database.department_members?.forEach((dm: DepartmentMember) => {
    if (!['LEADER', 'TASK_MANAGER', 'MEMBER'].includes(dm.role)) dm.role = 'MEMBER';
  });

  database.task_assignees?.forEach((assignee: TaskAssignee) => {
    assignee.assigned_at ||= '2026-05-09T09:00:00Z';
  });

  database.chat_messages ||= [...chat_messages];
  database.chat_messages?.forEach((message: ChatMessage) => {
    if (message.department_id === undefined) message.department_id = 101;
  });
  chat_messages.forEach((message) => {
    const exists = database.chat_messages?.some((item: ChatMessage) => item.id === message.id);
    if (!exists) database.chat_messages?.push({ ...message });
  });

  return database;
}

const stored = localStorage.getItem('doore_mock_db');
export const db = normalizeDB(stored ? JSON.parse(stored) : defaultDB);
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
