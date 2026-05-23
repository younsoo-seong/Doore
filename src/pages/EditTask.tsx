import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { canEditTask } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

export default function EditTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isOffline } = useNetwork();
  
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

  const peerCursorMember = useMemo(() => {
    if (!currentUser) return null;

    return (
      deptMembers.find((member: any) => selectedAssignees.includes(member.id) && member.id !== currentUser.id) ||
      deptMembers.find((member: any) => member.id !== currentUser.id && (member.role === 'LEADER' || member.role === 'TASK_MANAGER')) ||
      deptMembers.find((member: any) => member.id !== currentUser.id) ||
      null
    );
  }, [currentUser, deptMembers, selectedAssignees]);

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



  // Simulated peer typing effect
  useEffect(() => {
    if (!documentInfo) return;
    if (!peerCursorMember) return;
    if (documentInfo.status === 'PENDING' || documentInfo.status === 'APPROVED') return;

    const interval = setInterval(() => {
      setSimulatedTyping(prev => 
        prev.length > 30 ? '' : prev + ` ${peerCursorMember.name}님이 입력 중...`
      );
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
  const lockReason = documentInfo.status === 'PENDING' || documentInfo.status === 'APPROVED'
      ? '결재 잠금 상태의 문서입니다.'
      : taskStatus === 'DONE'
        ? '완료된 Task는 잠금 상태입니다.'
        : '담당자 또는 부서장만 편집할 수 있습니다.';
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
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>📄 상위 문서: {documentInfo.title}</span>
            <span className={`doc-status ${documentInfo.status}`}>
              {documentInfo.status === 'WORKING' ? '작성 중' : documentInfo.status === 'PENDING' ? '결재 대기' : '승인됨'}
            </span>
          </div>
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
            <span style={{ fontSize: '13px', fontWeight: '600' }}>현재 상태:</span>
            <ApiHint hint={apiHints.updateTaskStatus} align="left">
              <select
                value={taskStatus}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                disabled={isReadOnly && taskStatus === 'DONE'}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-app)', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
              >
                <option value="TODO">할 일 (TODO)</option>
                <option value="DOING">진행 중 (DOING)</option>
                <option value="DONE">완료됨 (DONE)</option>
              </select>
            </ApiHint>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-btn">B</button>
            <button className="toolbar-btn">I</button>
            <button className="toolbar-btn">U</button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Read-only Assignees Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>👥 배정 담당자:</span>
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
            {/* Simulated collaborative peer cursor */}
            {!isReadOnly && peerCursorMember && (
              <div className="mock-cursor" style={{ top: '160px', left: '260px' }}>
                <div className="cursor-name">{peerCursorMember.name}</div>
                <div className="cursor-pointer"></div>
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

            {/* Editable Task Content Area */}
            <textarea
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value);
                handleContentSave(editTitle, e.target.value);
              }}
              placeholder="업무에 대한 상세 내용이나 보고서를 작성하세요. 실시간으로 부서원들과 공유됩니다..."
              readOnly={isReadOnly}
              style={{ 
                width: '100%', 
                height: 'calc(100% - 100px)', 
                border: 'none', 
                outline: 'none', 
                resize: 'none', 
                fontSize: '15px', 
                lineHeight: '1.6', 
                color: isReadOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontFamily: 'inherit',
                backgroundColor: 'transparent'
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
