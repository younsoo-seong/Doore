export interface DemoEvent {
  id: string;
  at: string;
  title: string;
  api: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'WSS';
  tables: string[];
  summary: string;
  payload?: string;
  result?: string;
}

const STORAGE_KEY = 'doore_demo_events';
const MAX_EVENTS = 60;

const seedEvents: DemoEvent[] = [
  {
    id: 'seed-task-create',
    at: new Date().toISOString(),
    title: 'Task 생성 및 담당자 할당',
    api: 'POST /api/v1/documents/{documentId}/tasks',
    method: 'POST',
    tables: ['tasks', 'task_assignees', 'notifications'],
    summary: '문서를 Task로 분할하고 담당자에게 알림을 발송합니다.',
    payload: '{ title, assignee_ids }',
    result: 'Task status=TODO, 담당자 칸반에 표시',
  },
  {
    id: 'seed-approval',
    at: new Date().toISOString(),
    title: '문서 승인 요청',
    api: 'POST /api/v1/documents/{documentId}/approval-requests',
    method: 'POST',
    tables: ['documents', 'notifications'],
    summary: '모든 Task가 DONE이면 문서를 통합하고 승인 대기 상태로 잠급니다.',
    payload: '{}',
    result: 'document.status=PENDING',
  },
];

export function getDemoEvents(): DemoEvent[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedEvents;

  try {
    const parsed = JSON.parse(stored) as DemoEvent[];
    return parsed.length > 0 ? parsed : seedEvents;
  } catch {
    return seedEvents;
  }
}

export function emitDemoEvent(input: Omit<DemoEvent, 'id' | 'at'>) {
  const event: DemoEvent = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: new Date().toISOString(),
  };
  const events = [event, ...getDemoEvents()].slice(0, MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent<DemoEvent>('doore-demo-event', { detail: event }));
  return event;
}

export function subscribeDemoEvents(callback: (event: DemoEvent) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<DemoEvent>).detail);
  window.addEventListener('doore-demo-event', handler);
  return () => window.removeEventListener('doore-demo-event', handler);
}
