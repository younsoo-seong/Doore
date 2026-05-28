export interface ApiHintContent {
  title: string;
  api: string;
  erd: string[];
  event?: string;
  result: string;
}

export const apiHints = {
  login: {
    title: '로그인',
    api: 'POST /api/v1/auth/login',
    erd: ['users', 'company_members', 'department_members'],
    event: 'JWT 발급 및 역할/워크스페이스 로드',
    result: '조직장/부서장/부서원 권한에 맞는 화면으로 진입합니다.',
  },
  signup: {
    title: '회원가입',
    api: 'POST /api/v1/auth/signup',
    erd: ['users'],
    event: '신규 사용자 생성',
    result: '사용자 계정 생성 후 로그인 토큰을 발급합니다.',
  },
  createCompany: {
    title: '조직 생성',
    api: 'POST /api/v1/companies',
    erd: ['companies', 'company_members', 'departments'],
    event: '회사 생성 후 생성자를 OWNER로 등록',
    result: '조직 워크스페이스와 기본 부서가 생성됩니다.',
  },
  inviteCompanyMember: {
    title: '조직원 초대',
    api: 'POST /api/v1/companies/{companyId}/members',
    erd: ['company_members', 'notifications'],
    event: '회사 멤버 추가',
    result: '초대된 사용자가 조직 멤버 목록에 표시됩니다.',
  },
  updateCompanyRole: {
    title: '회사 권한 변경',
    api: 'PATCH /api/v1/companies/{companyId}/members/{userId}',
    erd: ['company_members'],
    event: 'OWNER / ADMIN / MEMBER 변경',
    result: '계정의 조직 권한이 즉시 변경됩니다.',
  },
  createDepartment: {
    title: '부서 생성',
    api: 'POST /api/v1/companies/{companyId}/departments',
    erd: ['departments'],
    event: '조직 하위 부서 생성',
    result: '부서 문서함에 새 부서가 추가됩니다.',
  },
  assignDepartmentMember: {
    title: '부서 배치 및 권한 부여',
    api: 'POST /api/v1/departments/{deptId}/members',
    erd: ['department_members', 'notifications'],
    event: 'LEADER / MEMBER 배치',
    result: '부서 역할에 따라 문서/Task 권한이 달라집니다.',
  },
  updateDepartmentRole: {
    title: '부서 권한 변경',
    api: 'PATCH /api/v1/departments/{deptId}/members/{userId}',
    erd: ['department_members'],
    event: '부서장 또는 부서원 지정',
    result: 'Task 분할과 담당자 지정 권한이 즉시 반영됩니다.',
  },
  createDocument: {
    title: '부서 문서 생성',
    api: 'POST /api/v1/departments/{departmentId}/documents',
    erd: ['documents'],
    event: '문서 status=WORKING',
    result: '새 문서가 부서 문서함에 생성됩니다.',
  },
  createTask: {
    title: 'Task 생성 및 담당자 지정',
    api: 'POST /api/v1/documents/{documentId}/tasks',
    erd: ['tasks', 'task_assignees', 'notifications'],
    event: 'TASK_ASSIGNED 알림 발생',
    result: '담당자 내 Task 보드에 TODO 카드가 표시됩니다.',
  },
  updateTaskStatus: {
    title: 'Task 상태 변경',
    api: 'PATCH /api/v1/tasks/{taskId}/status',
    erd: ['tasks', 'notifications'],
    event: 'TODO -> DOING -> DONE',
    result: 'DONE이 되면 Task가 읽기 전용으로 잠깁니다.',
  },
  approveTask: {
    title: 'Task 승인',
    api: 'PATCH /api/v1/tasks/{taskId}/approve',
    erd: ['tasks', 'notifications'],
    event: 'TASK_STATUS_CHANGED 알림 발생, Task -> DONE',
    result: 'Task가 승인되어 완료 상태로 전환됩니다.',
  },
  rejectTask: {
    title: 'Task 반려',
    api: 'PATCH /api/v1/tasks/{taskId}/reject',
    erd: ['tasks', 'notifications'],
    event: 'TASK_STATUS_CHANGED 알림 발생, DONE Task -> DOING 재오픈',
    result: '완료된 Task를 반려하면 담당자가 다시 편집할 수 있습니다.',
  },
  reopenTask: {
    title: 'Task 수정 모드 전환',
    api: 'PATCH /api/v1/tasks/{taskId}/reopen',
    erd: ['tasks', 'notifications'],
    event: 'TASK_STATUS_CHANGED 알림 발생, DONE Task -> DOING',
    result: '업무 보드로 이동하기 전에 완료 Task를 다시 편집 가능한 상태로 전환합니다.',
  },
  editTaskRealtime: {
    title: 'Task 실시간 편집',
    api: 'PUB /pub/tasks/{taskId}/edit',
    erd: ['tasks'],
    event: 'WebSocket patch 전송, 오프라인 시 IndexedDB patch queue 적재',
    result: '온라인은 서버 병합, 오프라인은 로컬 IndexedDB 임시 저장 후 재연결 때 동기화됩니다.',
  },
  requestApproval: {
    title: '문서 통합 및 승인 요청',
    api: 'POST /api/v1/documents/{documentId}/approval-requests',
    erd: ['documents', 'tasks', 'notifications'],
    event: 'DOC_APPROVAL_REQUEST 알림 발생',
    result: '모든 Task 결과가 통합되고 문서가 PENDING으로 잠깁니다.',
  },
  approveDocument: {
    title: '문서 승인',
    api: 'PATCH /api/v1/documents/{documentId}/approve',
    erd: ['documents', 'notifications'],
    event: 'DOCUMENT_APPROVED 알림 발생',
    result: '문서가 APPROVED로 전환되고 최종본 추출이 가능합니다.',
  },
  readNotification: {
    title: '알림 읽음 처리',
    api: 'PATCH /api/v1/notifications/{notificationId}/read',
    erd: ['notifications'],
    event: 'is_read=true',
    result: '알림 배지가 갱신됩니다.',
  },
  sendMessage: {
    title: '메신저 메시지 전송',
    api: 'POST /api/v1/companies/{companyId}/messages',
    erd: ['chat_messages'],
    event: '워크스페이스 메시지 저장 및 배포',
    result: '회사 메신저 목록에 새 메시지가 표시됩니다.',
  },
  reconnectSync: {
    title: '네트워크 복구 동기화',
    api: 'PUB /pub/tasks/{taskId}/reconnect-sync',
    erd: ['tasks'],
    event: 'IndexedDB 임시 변경분 재전송',
    result: '서버 최신 버전과 로컬 변경분을 다시 맞춥니다.',
  },
} satisfies Record<string, ApiHintContent>;
