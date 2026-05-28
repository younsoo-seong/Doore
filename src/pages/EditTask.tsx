import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { canEditTask, canReviewTask, getTaskStatusLabel } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import { formatRichTextHtml } from '../components/RichTextContent';

const cursorColors = ['#ec4899', '#2563eb', '#16a34a'];
const cursorPath = [
  { left: 0, top: 0 },
  { left: 78, top: 8 },
  { left: 152, top: 24 },
  { left: 96, top: 58 },
  { left: 214, top: 76 },
  { left: 164, top: 112 },
];
const cursorActivities = ['문장 정리 중', '단락 수정 중', '내용 검토 중', '표현 다듬는 중'];
const taskStatusOptions = ['TODO', 'DOING', 'DONE'] as const;
const taskStatusColors = {
  TODO: { background: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  DOING: { background: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
  DONE: { background: '#dcfce7', color: '#15803d', border: '#86efac' },
};
type CursorSnapshot = { top: number; left: number; activity: string; step: number };
type InlineFormatCommand = 'bold' | 'italic' | 'underline';

export default function EditTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isOffline } = useNetwork();
  const contentRef = useRef<HTMLDivElement | null>(null);
  
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
      !selectedAssignees.includes(member.id) &&
      (member.role === 'LEADER' || member.role === 'TASK_MANAGER')
    ));
    return [...selectedMembers, ...managers].slice(0, 3);
  }, [currentUser, deptMembers, selectedAssignees]);
  const peerCursorMember = collaboratorCursors?.[0] ?? null;

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
        setDeptMembers(members);
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
  }, [taskId, navigate, currentUser]);


  useEffect(() => {
    const editor = contentRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;

    const nextHtml = formatRichTextHtml(editContent);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [editContent, taskInfo?.id]);

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
          next[member.id] = {
            top: 104 + index * 44 + path.top,
            left: 148 + index * 34 + path.left,
            activity: cursorActivities[(step + index) % cursorActivities.length],
            step,
          };
        });
        return next;
      });
    };

    moveCursors();
    const interval = window.setInterval(moveCursors, 1300);
    return () => window.clearInterval(interval);
  }, [documentInfo, collaboratorCursors]);


  // Simulated peer typing effect
  useEffect(() => {
    if (!documentInfo) return;
    if (!peerCursorMember) return;
    if (documentInfo.status === 'PENDING' || documentInfo.status === 'APPROVED') return;

    const interval = setInterval(() => {
      const activity = cursorActivities[Math.floor(Math.random() * cursorActivities.length)];
      setSimulatedTyping(`${peerCursorMember.name}님이 ${activity}`);
    }, 4000);
    return () => clearInterval(interval);
  }, [documentInfo, peerCursorMember]);

  // Handle content auto-saving
  const handleContentSave = async (title: string, content: string) => {
    if (!taskInfo) return;
    if (!isEditable) return;
    setSaveStatus('saving');
    try {
      await api.updateTaskContent(taskInfo.id, title, content);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const syncEditorContent = () => {
    const editor = contentRef.current;
    if (!editor) return;
    const nextContent = editor.innerHTML === '<br>' ? '' : editor.innerHTML;
    setEditContent(nextContent);
    handleContentSave(editTitle, nextContent);
  };

  const applyInlineFormat = (command: InlineFormatCommand) => {
    if (isReadOnly) return;
    contentRef.current?.focus();
    document.execCommand(command, false);
    syncEditorContent();
  };

  const handleStatusChange = async (newStatus: 'TODO' | 'DOING' | 'DONE') => {
    if (!taskInfo) return;
    if (!isEditable && taskStatus !== newStatus) {
      alert('잠금 상태에서는 진행 상태를 변경할 수 없습니다.');
      return;
    }
    try {
      await api.updateTaskStatus(taskInfo.id, newStatus);
      setTaskStatus(newStatus);
      

    } catch (e) {
      alert('진행상태 변경에 실패했습니다.');
    }
  };

  const handleApproveTask = async () => {
    if (!taskInfo || !currentUser || !canReviewCurrentTask) return;
    try {
      const updatedTask = await api.approveTask(taskInfo.id, currentUser.id);
      setTaskInfo({ ...updatedTask });
      setTaskStatus('DONE');
      alert('Task가 승인되어 완료 처리되었습니다.');
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
        if (contentRef.current) contentRef.current.innerHTML = formatRichTextHtml(updatedTask.content || '');
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
    currentUserId: currentUser?.id,
    assigneeIds: selectedAssignees,
    departmentRole: myDeptRole,
  });
  const canApproveCurrentTask = canReviewCurrentTask && taskStatus !== 'DONE';
  const canRejectCurrentTask = canReviewCurrentTask && taskStatus === 'DONE';
  const lockReason = '현재 상태에서는 편집 권한이 없습니다. 담당자 또는 관리자에게 권한을 요청해 주세요.';
  const saveLabel = saveStatus === 'saved'
    ? isOffline ? '로컬 IndexedDB 저장 완료' : '동기화 완료'
    : saveStatus === 'saving'
      ? isOffline ? 'IndexedDB 저장 중...' : '저장 중...'
      : '오류';
  const saveColor = saveStatus === 'error' ? '#ef4444' : isOffline ? '#b45309' : '#10b981';
  const saveBackground = saveStatus === 'error' ? '#fee2e2' : isOffline ? '#fef3c7' : '#dcfce7';

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
        {isReadOnly && (
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
        <div className="editor-toolbar" style={{ pointerEvents: isReadOnly ? 'none' : 'auto', opacity: isReadOnly ? 0.6 : 1, padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="toolbar-group">
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
          
          <div className="toolbar-group">
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
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', minHeight: 0, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
          
          {/* Left Main: Editor Canvas */}
          <div className="editor-canvas" style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {isOffline && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #facc15', color: '#92400e', fontSize: '13px', fontWeight: 700 }}>
                서버 연결이 끊겨 변경사항을 로컬 IndexedDB에 임시 저장합니다. 네트워크 복구 후 reconnect-sync가 실행됩니다.
              </div>
            )}
            {/* Simulated collaborative peer cursors */}
            {!isReadOnly && collaboratorCursors?.map((member: any, index: number) => {
              const color = cursorColors[index % cursorColors.length];
              const snapshot = cursorSnapshots[member.id] ?? {
                top: 116 + index * 46,
                left: 168 + index * 70,
                activity: '편집 중',
                step: 0,
              };
              return (
                <div
                  key={member.id}
                  className="mock-cursor"
                  style={{
                    top: `${snapshot.top}px`,
                    left: `${snapshot.left}px`,
                    animation: 'none',
                    transition: 'top 900ms cubic-bezier(0.22, 1, 0.36, 1), left 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="cursor-name" style={{ backgroundColor: color }}>{member.name} · {snapshot.activity}</div>
                  <div className="cursor-pointer" style={{ backgroundColor: color }}></div>
                  <div className="cursor-ghost-text" style={{ color }}>{snapshot.activity}</div>
                </div>
              );
            })}

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

            {/* Editable Task Content Area */}
            <div
              ref={contentRef}
              contentEditable={!isReadOnly}
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              data-placeholder="업무에 대한 상세 내용이나 보고서를 작성하세요. 실시간으로 부서원들과 공유됩니다..."
              className="rich-task-editor"
              onInput={syncEditorContent}
              onBlur={syncEditorContent}
              style={{ 
                width: '100%', 
                minHeight: 'calc(100% - 100px)',
                flexGrow: 1,
                border: 'none', 
                outline: 'none', 
                fontSize: '15px', 
                lineHeight: '1.6', 
                color: isReadOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontFamily: 'inherit',
                backgroundColor: 'transparent',
                whiteSpace: 'pre-wrap',
                overflowY: 'auto',
                cursor: isReadOnly ? 'default' : 'text',
              }}
            />

            {/* Peer input simulation */}
            {!isReadOnly && peerCursorMember && simulatedTyping && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#ec4899', fontStyle: 'italic' }}>
                {simulatedTyping} <span className="typing-indicator">|</span>
              </div>
            )}
          </div>


          
        </div>
      </div>


    </div>
  );
}
