import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { canEditTask, canReviewTask, getTaskStatusLabel } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import RichTextContent from '../components/RichTextContent';

const cursorColors = ['#ec4899', '#2563eb', '#16a34a'];
const cursorPath = [
  { left: 0, top: 0 },
  { left: 54, top: 1 },
  { left: 112, top: 2 },
  { left: 174, top: 2 },
  { left: 238, top: 3 },
  { left: 302, top: 5 },
  { left: 42, top: 34 },
  { left: 102, top: 35 },
  { left: 166, top: 36 },
  { left: 236, top: 37 },
  { left: 304, top: 38 },
];
const cursorActivities = ['문장 입력 중', '단락 이어 쓰는 중', '내용 검토 중', '표현 다듬는 중'];
const taskDraftLibrary = {
  erd: [
    'users, documents, tasks 테이블의 관계를 기준으로 ERD를 정리합니다.',
    'task_assignees는 다대다 배정 관계를 분리하기 위한 매핑 테이블로 둡니다.',
    'notifications는 Task 상태 변경과 승인 요청 이벤트를 사용자별로 저장합니다.',
  ],
  api: [
    'Task 생성 API는 documentId를 기준으로 하위 업무와 담당자 목록을 함께 저장합니다.',
    '상태 변경 API는 TODO, DOING, DONE 값만 허용하고 문서 상태가 WORKING일 때만 처리합니다.',
    '공동 편집 WebSocket은 taskId 채널을 구독해 변경 패치와 커서 위치를 전달합니다.',
  ],
  plan: [
    '신규 서비스 기획안은 핵심 기능, 사용자 시나리오, 우선순위 기준으로 정리합니다.',
    '요구사항은 필수 기능과 후순위 기능으로 나누어 승인자가 검토하기 쉽게 구성합니다.',
    '정책 항목은 부서 검토 후 최종 승인 문서에 반영할 수 있도록 표 형태로 정리합니다.',
  ],
  default: [
    'Task 요구사항을 기준으로 본문 초안을 정리하고 검토 의견을 반영합니다.',
    '담당자별 작성 내용은 완료 후 문서 통합 단계에서 순서대로 병합됩니다.',
    '수정이 필요한 부분은 반려 사유를 남긴 뒤 DOING 상태에서 다시 작업합니다.',
  ],
};
const taskStatusOptions = ['TODO', 'DOING', 'DONE'] as const;
const taskStatusColors = {
  TODO: { background: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  DOING: { background: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
  DONE: { background: '#dcfce7', color: '#15803d', border: '#86efac' },
};
type CursorSnapshot = { top: number; left: number; activity: string; step: number; draft: string };
type InlineFormatCommand = 'bold' | 'italic' | 'underline';

const getTaskDraftBackupKey = (taskId: number) => `doore_task_content_backup_${taskId}`;

const writeTaskDraftBackup = (taskId: number, content: string) => {
  if (!content.trim()) return;
  localStorage.setItem(getTaskDraftBackupKey(taskId), content);
};

const getPeerDraftSentences = (taskTitle = '', taskRequirement = '') => {
  const source = `${taskTitle} ${taskRequirement}`.toLowerCase();
  if (source.includes('erd') || source.includes('데이터베이스') || source.includes('테이블')) return taskDraftLibrary.erd;
  if (source.includes('api') || source.includes('websocket') || source.includes('rest')) return taskDraftLibrary.api;
  if (source.includes('기획') || source.includes('요구사항') || source.includes('서비스')) return taskDraftLibrary.plan;
  return taskDraftLibrary.default;
};

export default function EditTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentUser, currentCompany } = useAuth();
  const { isOffline } = useNetwork();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  
  const [taskInfo, setTaskInfo] = useState<any>(null);
  const [documentInfo, setDocumentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [taskStatus, setTaskStatus] = useState<'TODO' | 'DOING' | 'DONE'>('TODO');

  // Assignee selection states
  const [deptMembers, setDeptMembers] = useState<any[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [myDeptRole, setMyDeptRole] = useState<string | null>(null);
  const [showAssigneeEditor, setShowAssigneeEditor] = useState(false);
  const [draftAssignees, setDraftAssignees] = useState<number[]>([]);
  const [isSavingAssignees, setIsSavingAssignees] = useState(false);

  // Confirmation & Save indicators
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Simulated live peer typing
  const [simulatedTyping, setSimulatedTyping] = useState('');
  const [cursorSnapshots, setCursorSnapshots] = useState<Record<number, CursorSnapshot>>({});

  const collaboratorCursors = useMemo(() => {
    if (!currentUser) return null;

    const selectedMembers = deptMembers.filter((member: any) => selectedAssignees.includes(member.id) && member.id !== currentUser.id);
    const managers = deptMembers.filter((member: any) => (
      member.id !== currentUser.id &&
      member.name !== currentUser.name &&
      !selectedAssignees.includes(member.id) &&
      (member.role === 'LEADER' || member.role === 'TASK_MANAGER')
    ));
    return [...selectedMembers, ...managers]
      .filter((member: any) => member.id !== currentUser.id && member.name !== currentUser.name)
      .slice(0, 3);
  }, [currentUser, deptMembers, selectedAssignees]);
  const peerCursorMember = collaboratorCursors?.[0] ?? null;
  const peerDraftSentences = useMemo(
    () => getPeerDraftSentences(taskInfo?.title, taskInfo?.requirement),
    [taskInfo?.title, taskInfo?.requirement],
  );
  const remoteDrafts = useMemo(() => {
    if (!collaboratorCursors?.length) return [];
    return collaboratorCursors
      .map((member: any, index: number) => ({
        member,
        draft: cursorSnapshots[member.id]?.draft || peerDraftSentences[index % peerDraftSentences.length],
      }))
      .filter((item: any) => item.draft.trim().length > 0);
  }, [collaboratorCursors, cursorSnapshots, peerDraftSentences]);

  useEffect(() => {
    async function loadTaskDetails() {
      if (!taskId) return;
      try {
        const id = parseInt(taskId, 10);
        // 1. Fetch task, parent document and current assignees list
        const { task, document, assignees } = await api.getTaskById(id);
        setTaskInfo(task);
        setDocumentInfo(document);
        setEditTitle(task.title);
        setEditContent(task.content || '');
        setTaskStatus(task.status);
        setSelectedAssignees(assignees || []);

        // 2. Fetch department members to populate assignee options
        const members = await api.getDepartmentMembers(document.department_id);
        const companyMembers = currentCompany ? await api.getCompanyMembers(currentCompany.id) : [];
        const ownerIds = new Set(
          companyMembers
            .filter((member: any) => member.role === 'OWNER')
            .map((member: any) => member.id)
        );
        const assignableMembers = members.filter((member: any) => !ownerIds.has(member.id));
        setDeptMembers(assignableMembers);
        const me = members.find((member: any) => member.id === currentUser?.id);
        setMyDeptRole(me?.role ?? null);


      } catch (error) {
        console.error("Failed to load task details", error);
        alert('존재하지 않거나 불러올 수 없는 Task입니다.');
        navigate('/tasks');
      } finally {
        setLoading(false);
      }
    }
    loadTaskDetails();
  }, [taskId, navigate, currentUser, currentCompany]);


  useEffect(() => {
    const editor = contentRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;

    if (editor.value !== editContent) {
      editor.value = editContent;
    }
  }, [editContent, taskInfo?.id, taskStatus]);

  useEffect(() => {
    if (!documentInfo || !collaboratorCursors?.length || documentInfo.status === 'PENDING' || documentInfo.status === 'APPROVED') {
      setCursorSnapshots({});
      return;
    }

    const moveCursors = () => {
      setCursorSnapshots((prev) => {
        const next: Record<number, CursorSnapshot> = {};
        collaboratorCursors.forEach((member: any, index: number) => {
          const prior = prev[member.id];
          const step = ((prior?.step ?? index) + 1) % cursorPath.length;
          const path = cursorPath[step];
          const sentence = peerDraftSentences[index % peerDraftSentences.length];
          const draftLength = Math.min(sentence.length, Math.max(6, (step + 1) * 5));
          next[member.id] = {
            top: 118 + index * 72 + path.top,
            left: 470 + index * 24 + path.left,
            activity: cursorActivities[(step + index) % cursorActivities.length],
            step,
            draft: sentence.slice(0, draftLength),
          };
        });
        return next;
      });
    };

    moveCursors();
    const interval = window.setInterval(moveCursors, 2400);
    return () => window.clearInterval(interval);
  }, [documentInfo, collaboratorCursors, peerDraftSentences]);


  // Simulated peer typing effect
  useEffect(() => {
    if (!documentInfo) return;
    if (!peerCursorMember) return;
    if (documentInfo.status === 'PENDING' || documentInfo.status === 'APPROVED') return;

    const interval = setInterval(() => {
      const activity = cursorActivities[Math.floor(Math.random() * cursorActivities.length)];
      setSimulatedTyping(`${peerCursorMember.name}님이 ${activity}`);
    }, 7000);
    return () => clearInterval(interval);
  }, [documentInfo, peerCursorMember]);

  // Handle content auto-saving
  const handleContentSave = async (title: string, content: string) => {
    if (!taskInfo) return;
    if (!isEditable) return;
    setSaveStatus('saving');
    try {
      const updatedTask = await api.updateTaskContent(taskInfo.id, title, content);
      writeTaskDraftBackup(taskInfo.id, content);
      if (updatedTask) setTaskInfo({ ...updatedTask });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const syncEditorContent = () => {
    const editor = contentRef.current;
    if (!editor) return;
    const nextContent = editor.value;
    setEditContent(nextContent);
    if (taskInfo) writeTaskDraftBackup(taskInfo.id, nextContent);
    handleContentSave(editTitle, nextContent);
  };

  const getCurrentEditorContent = () => {
    const editor = contentRef.current;
    if (!editor) return editContent || taskInfo?.content || '';
    return editor.value;
  };

  const persistCurrentEditorContent = async () => {
    if (!taskInfo || !isEditable) return editContent || taskInfo?.content || '';
    const currentContent = getCurrentEditorContent();
    setEditContent(currentContent);
    writeTaskDraftBackup(taskInfo.id, currentContent);
    const updatedTask = await api.updateTaskContent(taskInfo.id, editTitle, currentContent);
    if (updatedTask) setTaskInfo({ ...updatedTask });
    setSaveStatus('saved');
    return currentContent;
  };

  const mergeRemoteDraftsIntoContent = async () => {
    if (!taskInfo || !isEditable) return editContent || taskInfo?.content || '';

    const currentContent = getCurrentEditorContent();
    if (remoteDrafts.length === 0) {
      await persistCurrentEditorContent();
      return currentContent;
    }

    const mergedDrafts = remoteDrafts
      .map(({ member, draft }: any) => `${member.name}: ${draft}`)
      .filter((line: string) => !currentContent.includes(line))
      .join('\n');

    if (!mergedDrafts) {
      await persistCurrentEditorContent();
      return currentContent;
    }

    const mergedContent = `${mergedDrafts}${currentContent ? '\n' : ''}${currentContent}`;
    setEditContent(mergedContent);
    writeTaskDraftBackup(taskInfo.id, mergedContent);
    const editor = contentRef.current;
    if (editor) editor.value = mergedContent;
    const updatedTask = await api.updateTaskContent(taskInfo.id, editTitle, mergedContent);
    if (updatedTask) setTaskInfo({ ...updatedTask });
    return mergedContent;
  };

  const applyInlineFormat = (command: InlineFormatCommand) => {
    if (isReadOnly) return;
    const editor = contentRef.current;
    if (!editor || !taskInfo) return;
    const wrappers = {
      bold: ['<strong>', '</strong>'],
      italic: ['<em>', '</em>'],
      underline: ['<u>', '</u>'],
    } as const;
    const [open, close] = wrappers[command];
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editContent.slice(start, end);
    const nextContent = `${editContent.slice(0, start)}${open}${selected || '텍스트'}${close}${editContent.slice(end)}`;
    setEditContent(nextContent);
    writeTaskDraftBackup(taskInfo.id, nextContent);
    window.requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + open.length + (selected || '텍스트').length + close.length;
      editor.setSelectionRange(cursor, cursor);
    });
    handleContentSave(editTitle, nextContent);
  };

  const handleStatusChange = async (newStatus: 'TODO' | 'DOING' | 'DONE') => {
    if (!taskInfo) return;
    if (!isEditable && taskStatus !== newStatus) {
      alert('잠금 상태에서는 진행 상태를 변경할 수 없습니다.');
      return;
    }
    try {
      if (newStatus === 'DONE') {
        await mergeRemoteDraftsIntoContent();
      }
      await api.updateTaskStatus(taskInfo.id, newStatus);
      setTaskStatus(newStatus);
      

    } catch (e) {
      alert('진행상태 변경에 실패했습니다.');
    }
  };

  const handleRequestTaskApproval = async () => {
    if (!taskInfo || !isEditable) return;
    if (taskStatus !== 'DOING') {
      alert('진행 중(DOING) 상태에서만 승인 요청할 수 있습니다.');
      return;
    }
    try {
      await mergeRemoteDraftsIntoContent();
      await api.updateTaskStatus(taskInfo.id, 'DONE');
      const updated = { ...taskInfo, status: 'DONE', review_status: 'REQUESTED' };
      setTaskInfo(updated);
      setTaskStatus('DONE');
      alert('부서장에게 Task 승인 요청을 보냈습니다.');
    } catch (e: any) {
      alert(e.message || '승인 요청에 실패했습니다.');
    }
  };

  const openAssigneeEditor = () => {
    setDraftAssignees(selectedAssignees);
    setShowAssigneeEditor(true);
  };

  const handleToggleDraftAssignee = (userId: number) => {
    setDraftAssignees((prev) => {
      if (prev.includes(userId)) {
        if (prev.length <= 1) {
          alert('최소 1명 이상의 담당자가 지정되어야 합니다.');
          return prev;
        }
        return prev.filter((id) => id !== userId);
      }

      if (prev.length >= 5) {
        alert('담당자는 최대 5명까지만 지정할 수 있습니다.');
        return prev;
      }
      return [...prev, userId];
    });
  };

  const handleSaveAssignees = async () => {
    if (!taskInfo) return;
    if (draftAssignees.length < 1) {
      alert('최소 1명 이상의 담당자가 지정되어야 합니다.');
      return;
    }

    setIsSavingAssignees(true);
    try {
      await api.updateTaskAssignees(taskInfo.id, draftAssignees);
      setSelectedAssignees(draftAssignees);
      setTaskInfo((prev: any) => prev ? { ...prev, assignee_count: draftAssignees.length } : prev);
      setShowAssigneeEditor(false);
      alert('Task 담당자가 변경되었습니다.');
    } catch (e: any) {
      alert(e.message || 'Task 담당자 변경에 실패했습니다.');
    } finally {
      setIsSavingAssignees(false);
    }
  };

  const handleApproveTask = async () => {
    if (!taskInfo || !currentUser || !canReviewCurrentTask) return;
    try {
      await mergeRemoteDraftsIntoContent();
      const updatedTask = await api.approveTask(taskInfo.id, currentUser.id);
      setTaskInfo({ ...updatedTask });
      setTaskStatus('DONE');
      alert('Task가 승인 완료되었습니다.');
    } catch (e: any) {
      alert(e.message || 'Task 승인에 실패했습니다.');
    }
  };

  const handleRejectTask = async () => {
    if (!taskInfo || !currentUser || !canReviewCurrentTask) return;
    const reason = window.prompt('반려 사유를 입력하세요.', '반려');
    if (reason === null) return;
    try {
      const updatedTask = await api.rejectTask(taskInfo.id, currentUser.id, reason);
      setTaskInfo({ ...updatedTask });
      setTaskStatus('DOING');
      setEditContent(updatedTask.content || '');
      window.requestAnimationFrame(() => {
        if (contentRef.current) contentRef.current.value = updatedTask.content || '';
      });
      alert('Task가 반려되어 진행 중 상태로 돌아갔습니다.');
    } catch (e: any) {
      alert(e.message || 'Task 반려에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '18px' }}>에디터 로딩 중...</div>
      </div>
    );
  }

  if (!taskInfo || !documentInfo) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        에디터 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const isEditable = canEditTask({
    documentStatus: documentInfo.status,
    taskStatus,
    currentUserId: currentUser?.id,
    assigneeIds: selectedAssignees,
    departmentRole: myDeptRole,
    isOffline,
  });
  const isReadOnly = !isEditable;
  const canReviewCurrentTask = canReviewTask({
    documentStatus: documentInfo.status,
    departmentRole: myDeptRole,
  });
  const canRequestCurrentTaskApproval = isEditable && !canReviewCurrentTask && taskStatus === 'DOING';
  const canApproveCurrentTask = canReviewCurrentTask && taskStatus === 'DONE' && taskInfo.review_status !== 'APPROVED';
  const canRejectCurrentTask = canReviewCurrentTask && taskStatus === 'DONE' && taskInfo.review_status !== 'APPROVED';
  const canManageCurrentAssignees = canReviewCurrentTask && taskStatus !== 'DONE';
  const isReviewMode = canReviewCurrentTask && isReadOnly;
  const isAssignee = currentUser ? selectedAssignees.includes(currentUser.id) : false;
  const lockReason = (() => {
    if (documentInfo.status === 'PENDING') {
      return '문서가 결재 대기 중이라 수정할 수 없습니다. 결재가 반려되면 다시 작업할 수 있습니다.';
    }
    if (documentInfo.status === 'APPROVED') {
      return '최종 결재가 완료된 문서입니다. 승인 완료 문서는 수정할 수 없습니다.';
    }
    if (taskStatus === 'DONE' && isAssignee) {
      return taskInfo.review_status === 'APPROVED'
        ? '부서장 승인이 완료된 Task입니다. 수정이 필요하면 부서장에게 문의하십시오.'
        : '승인 요청 중인 Task입니다. 수정이 필요하면 부서장에게 반려를 요청하십시오.';
    }
    if (!isAssignee && !canReviewCurrentTask) {
      return '이 Task의 담당자가 아니므로 보기만 가능합니다. 수정은 배정 담당자만 할 수 있습니다.';
    }
    if (canReviewCurrentTask && taskStatus !== 'DONE') {
      return '부서장은 진행 중인 Task를 검토할 수 있지만 직접 수정하지 않습니다. 담당자가 승인 요청하면 승인/반려할 수 있습니다.';
    }
    return '읽기 전용 상태입니다. 수정이 필요하면 부서장에게 문의하십시오.';
  })();
  const reviewGuide = (() => {
    if (!isReviewMode) return null;
    if (taskStatus === 'DONE' && taskInfo.review_status !== 'APPROVED') {
      return '승인 요청된 Task입니다. 내용을 검토한 뒤 승인 또는 반려를 선택하세요.';
    }
    if (taskStatus === 'DONE' && taskInfo.review_status === 'APPROVED') {
      return '부서장 승인이 완료된 Task입니다. 내용은 읽기 전용으로 확인할 수 있습니다.';
    }
    return '담당자가 아직 승인 요청을 보내지 않았습니다. 내용 확인은 가능하지만 승인/반려는 요청 후 처리할 수 있습니다.';
  })();
  const saveLabel = saveStatus === 'saved'
    ? isOffline ? '로컬 IndexedDB 저장 완료' : '동기화 완료'
    : saveStatus === 'saving'
      ? isOffline ? 'IndexedDB 저장 중...' : '저장 중...'
      : '오류';
  const saveColor = saveStatus === 'error' ? '#ef4444' : isOffline ? '#b45309' : '#10b981';
  const saveBackground = saveStatus === 'error' ? '#fee2e2' : isOffline ? '#fef3c7' : '#dcfce7';
  const displayedContent = editContent || taskInfo.content || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '20px', position: 'relative' }}>
      
      {/* 1. Header Toolbar Back Navigation & Integration Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-card)', 
        padding: '16px 24px', 
        borderRadius: '12px', 
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={() => navigate('/tasks')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '18px', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← <span>태스크 보드로</span>
          </button>
          
          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}> 상위 문서: {documentInfo.title}</span>
            <span className={`doc-status ${documentInfo.status}`}>
              {documentInfo.status === 'WORKING' ? '작성 중' : documentInfo.status === 'PENDING' ? '결재 대기' : '승인됨'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canRequestCurrentTaskApproval && (
            <ApiHint hint={apiHints.updateTaskStatus}>
              <button
                type="button"
                onClick={handleRequestTaskApproval}
                className="btn-primary"
                style={{ padding: '8px 14px', minHeight: 0, fontSize: '13px' }}
              >
                승인 요청
              </button>
            </ApiHint>
          )}
          {taskStatus === 'DONE' && taskInfo.review_status === 'REQUESTED' && (
            <span className="task-review-badge requested">승인 요청 중</span>
          )}
          {taskStatus === 'DONE' && taskInfo.review_status === 'APPROVED' && (
            <span className="task-review-badge approved">승인 완료</span>
          )}
          {canApproveCurrentTask && (
            <ApiHint hint={apiHints.approveTask}>
              <button
                type="button"
                onClick={handleApproveTask}
                className="btn-primary"
                style={{ padding: '8px 14px', minHeight: 0, fontSize: '13px' }}
              >
                승인
              </button>
            </ApiHint>
          )}
          {canRejectCurrentTask && (
            <ApiHint hint={apiHints.rejectTask}>
              <button
                type="button"
                onClick={handleRejectTask}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
              >
                반려
              </button>
            </ApiHint>
          )}
        </div>
      </div>

      {/* 2. Text Editor Canvas */}
      <div style={{ 
        flexGrow: 1, 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '12px', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Read Only Gray Lock Filter */}
        {isReadOnly && !isReviewMode && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(240, 240, 240, 0.75)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <div style={{
              background: 'white',
              padding: '28px 44px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              textAlign: 'center',
              border: '2px solid #f59e0b'
            }}>
              <h2 style={{ color: '#f59e0b', fontSize: '20px', marginBottom: '8px' }}>[읽기 전용]</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{lockReason}</p>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="editor-toolbar" style={{ pointerEvents: 'auto', opacity: 1, padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="toolbar-group" style={{ opacity: isReadOnly ? 0.6 : 1 }}>
            <span style={{ 
              fontSize: '12px', 
              color: saveColor, 
              fontWeight: '600', 
              padding: '4px 8px', 
              background: saveBackground, 
              borderRadius: '4px' 
            }}>
              {saveLabel}
            </span>
          </div>
          
          <div className="toolbar-group" style={{ opacity: isReadOnly ? 0.45 : 1 }}>
            <button
              type="button"
              className="toolbar-btn"
              title="굵게"
              disabled={isReadOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyInlineFormat('bold')}
              style={{ fontWeight: 800, cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
            >
              B
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="기울임"
              disabled={isReadOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyInlineFormat('italic')}
              style={{ fontStyle: 'italic', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
            >
              I
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="밑줄"
              disabled={isReadOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyInlineFormat('underline')}
              style={{ textDecoration: 'underline', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
            >
              U
            </button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Read-only Assignees Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}> 배정 담당자:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {selectedAssignees.map((uid) => {
                  const member = deptMembers.find(m => m.id === uid);
                  return (
                    <div 
                      key={uid} 
                      className="avatar" 
                      style={{ width: 22, height: 22, fontSize: 9 }}
                      title={member ? `${member.name} (${member.role === 'LEADER' || member.role === 'TASK_MANAGER' ? '부서장' : '부서원'})` : ''}
                    >
                      {member ? member.name.charAt(0) : ''}
                    </div>
                  );
                })}
              </div>
              {canManageCurrentAssignees && (
                <button
                  type="button"
                  onClick={openAssigneeEditor}
                  title="Task 담당자를 변경합니다"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--primary)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: 1,
                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.12)'
                  }}
                >
                  담당자 변경
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px 4px 10px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-app)' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1, whiteSpace: 'nowrap' }}>상태</span>
              <ApiHint hint={apiHints.updateTaskStatus} align="left">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px', border: '1px solid #dbe3ee', borderRadius: '8px', background: 'white' }}>
                  {taskStatusOptions.map((status) => {
                    const active = taskStatus === status;
                    const colors = taskStatusColors[status];
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(status)}
                        disabled={isReadOnly && taskStatus === 'DONE'}
                        style={{
                          minWidth: '72px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${active ? colors.border : 'transparent'}`,
                          background: active ? colors.background : 'transparent',
                          color: active ? colors.color : 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: active ? 800 : 700,
                          cursor: isReadOnly ? 'not-allowed' : 'pointer',
                          opacity: isReadOnly && !active ? 0.45 : 1,
                        }}
                      >
                        {getTaskStatusLabel(status)}
                      </button>
                    );
                  })}
                </div>
              </ApiHint>
            </div>
          </div>
        </div>

        {/* Workspace Body Area */}
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', minHeight: 0, pointerEvents: isReadOnly && !isReviewMode ? 'none' : 'auto' }}>
          
          {/* Left Main: Editor Canvas */}
          <div className="editor-canvas" style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {reviewGuide && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '13px', fontWeight: 800 }}>
                {reviewGuide}
              </div>
            )}
            {isOffline && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #facc15', color: '#92400e', fontSize: '13px', fontWeight: 700 }}>
                서버 연결이 끊겨 변경사항을 로컬 IndexedDB에 임시 저장합니다. 네트워크 복구 후 reconnect-sync가 실행됩니다.
              </div>
            )}
            {taskInfo.rejection_reason && taskStatus === 'DOING' && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', fontWeight: 800 }}>
                반려 사유: {taskInfo.rejection_reason}
              </div>
            )}
            {/* Editable Task Title Input */}
            <ApiHint hint={apiHints.editTaskRealtime} align="left" fullWidth>
              <input
                type="text"
                className="doc-title-input"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  handleContentSave(e.target.value, editContent);
                }}
                placeholder="태스크 제목을 입력하세요"
                readOnly={isReadOnly}
                style={{ width: '100%', fontSize: '24px', fontWeight: '700', border: 'none', outline: 'none', marginBottom: '20px', color: 'var(--text-primary)', backgroundColor: 'transparent' }}
              />
            </ApiHint>

            {!isReadOnly && collaboratorCursors?.length ? (
              <div className="remote-draft-stack" aria-label="다른 담당자 작성 중">
                {collaboratorCursors.map((member: any, index: number) => {
                  const color = cursorColors[index % cursorColors.length];
                  const snapshot = cursorSnapshots[member.id] ?? {
                    top: 0,
                    left: 0,
                    activity: '문장 입력 중',
                    step: 0,
                    draft: peerDraftSentences[index % peerDraftSentences.length].slice(0, 6),
                  };
                  return (
                    <p key={member.id} className="remote-draft-line">
                      <span>{snapshot.draft}</span>
                      <span className="remote-caret" style={{ backgroundColor: color }}></span>
                      <span className="remote-inline-label" style={{ backgroundColor: color }}>
                        {member.name} · {snapshot.activity}
                      </span>
                    </p>
                  );
                })}
              </div>
            ) : null}

            {isReadOnly ? (
              <div
                className="rich-task-editor readonly-task-content"
                style={{
                  width: '100%',
                  minHeight: 'calc(100% - 100px)',
                  flexGrow: 1,
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  backgroundColor: 'transparent',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  cursor: 'default',
                }}
              >
                <RichTextContent
                  content={displayedContent}
                  emptyText="작성된 Task 내용이 없습니다."
                  emptyStyle={{ color: 'var(--text-muted)' }}
                />
              </div>
            ) : (
              <textarea
                ref={contentRef}
                aria-multiline="true"
                className="rich-task-editor"
                value={editContent}
                onChange={(event) => {
                  const nextContent = event.target.value;
                  setEditContent(nextContent);
                  if (taskInfo) writeTaskDraftBackup(taskInfo.id, nextContent);
                  handleContentSave(editTitle, nextContent);
                }}
                onBlur={syncEditorContent}
                placeholder="업무에 대한 상세 내용이나 보고서를 작성하세요. 실시간으로 부서원들과 공유됩니다..."
                style={{
                  width: '100%',
                  minHeight: 'calc(100% - 100px)',
                  flexGrow: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  backgroundColor: 'transparent',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  cursor: 'text',
                  resize: 'none',
                }}
              />
            )}

            {/* Peer input simulation */}
            {!isReadOnly && peerCursorMember && simulatedTyping && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#ec4899', fontStyle: 'italic' }}>
                {simulatedTyping} <span className="typing-indicator">|</span>
              </div>
            )}
          </div>


          
        </div>
      </div>

      {showAssigneeEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '460px', maxWidth: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.22)', padding: '24px' }}>
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Task 담당자 변경</h3>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                부서장은 진행 중인 Task의 담당자를 1명 이상, 최대 5명까지 재배정할 수 있습니다.
              </p>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
              {deptMembers.map((member: any) => {
                const checked = draftAssignees.includes(member.id);
                return (
                  <label
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      background: checked ? 'var(--primary-light)' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleDraftAssignee(member.id)}
                    />
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{member.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {member.email} · {member.role === 'LEADER' || member.role === 'TASK_MANAGER' ? '부서장' : '부서원'}
                      </div>
                    </div>
                  </label>
                );
              })}
              {deptMembers.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  배정 가능한 부서원이 없습니다.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                선택 {draftAssignees.length}명
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssigneeEditor(false)}
                  disabled={isSavingAssignees}
                  style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: isSavingAssignees ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                >
                  취소
                </button>
                <ApiHint hint={apiHints.assignTaskAssignee}>
                  <button
                    type="button"
                    onClick={handleSaveAssignees}
                    disabled={isSavingAssignees || draftAssignees.length < 1}
                    className="btn-primary"
                    style={{ padding: '9px 14px', minHeight: 0, fontSize: '13px' }}
                  >
                    {isSavingAssignees ? '저장 중...' : '담당자 저장'}
                  </button>
                </ApiHint>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
