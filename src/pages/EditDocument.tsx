import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function EditDocument() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { currentUser, currentCompany } = useAuth();

  const [documentInfo, setDocumentInfo] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cover Page configuration state
  const [hasCover, setHasCover] = useState(false);
  const [coverSubtitle, setCoverSubtitle] = useState('');
  const [coverDescription, setCoverDescription] = useState('');

  // Title for synchronizing
  const [docTitle, setDocTitle] = useState('');

  // Saving indicator status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Add Task Modal State (Created inside editor)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskAssignees, setAddTaskAssignees] = useState<number[]>([]);
  const [deptMembersForSelect, setDeptMembersForSelect] = useState<any[]>([]);

  useEffect(() => {
    async function loadDocumentDetails() {
      if (!docId || !currentUser) return;
      try {
        const id = parseInt(docId, 10);
        // 1. Fetch document
        const doc = await api.getDocument(id);
        if (!doc) {
          alert('존재하지 않는 문서입니다.');
          navigate('/docs');
          return;
        }

        // 2. Fetch company departments for meta presentation
        if (currentCompany) {
          const depts = await api.getDepartments(currentCompany.id);
          setDepartments(depts);
        }

        // 3. Load cover options
        setDocumentInfo(doc);
        setDocTitle(doc.title);
        setHasCover(!!doc.has_cover_page);
        setCoverSubtitle(doc.cover_subtitle || '');
        setCoverDescription(doc.cover_description || '');

        // 4. Fetch all tasks for this document
        const { tasks: allTasks } = await api.getTasksData();
        const docTasks = allTasks.filter((t: any) => t.document_id === doc.id);
        setTasks(docTasks);

      } catch (error) {
        console.error("Failed to load document for editing", error);
        navigate('/docs');
      } finally {
        setLoading(false);
      }
    }
    loadDocumentDetails();
  }, [docId, currentUser, navigate, currentCompany]);

  // Handle saving document title changes
  const handleTitleChange = async (newTitle: string) => {
    if (!documentInfo) return;
    setDocTitle(newTitle);
    setSaveStatus('saving');
    try {
      await api.updateDocumentTitle(documentInfo.id, newTitle);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // Handle saving cover settings (subtitle & description)
  const handleCoverSave = async (active: boolean, sub: string, desc: string) => {
    if (!documentInfo) return;
    setSaveStatus('saving');
    try {
      await api.updateDocumentCover(documentInfo.id, active, sub, desc);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // Handle task content inline autosave
  const handleTaskContentSave = async (taskId: number, title: string, content: string) => {
    setSaveStatus('saving');
    try {
      await api.updateTaskContent(taskId, title, content);
      
      // Quietly update tasks state in-place
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title, content } : t));
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // Reorder task items (Move up / Move down)
  const handleMoveTask = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!documentInfo) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    // Swap tasks locally
    const reordered = [...tasks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setTasks(reordered);

    setSaveStatus('saving');
    try {
      const taskIdsOrder = reordered.map(t => t.id);
      await api.reorderTasks(documentInfo.id, taskIdsOrder);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // Add a new section/task directly within the Word Canvas
  const handleAddNewTask = async () => {
    if (!documentInfo || !currentUser) return;
    try {
      const members = await api.getDepartmentMembers(documentInfo.department_id);
      setDeptMembersForSelect(members);
      setAddTaskTitle('');
      setAddTaskAssignees([currentUser.id]);
      setShowAddTaskModal(true);
    } catch (e) {
      console.error("Failed to load department members for adding task", e);
    }
  };

  const handleAddTaskAssigneeAdd = (userId: number) => {
    if (addTaskAssignees.includes(userId)) return;
    if (addTaskAssignees.length >= 5) {
      alert('담당자는 최대 5명까지만 지정할 수 있습니다.');
      return;
    }
    setAddTaskAssignees(prev => [...prev, userId]);
  };

  const handleAddTaskAssigneeRemove = (userId: number) => {
    if (addTaskAssignees.length <= 1) {
      alert('최소 1명 이상의 담당자가 배정되어야 합니다.');
      return;
    }
    setAddTaskAssignees(prev => prev.filter(id => id !== userId));
  };

  const submitAddTask = async () => {
    if (!documentInfo || !addTaskTitle.trim()) {
      alert('단락(Task) 제목을 입력해 주세요.');
      return;
    }
    if (addTaskAssignees.length < 1) {
      alert('최소 1명 이상의 담당자를 배정하세요.');
      return;
    }
    setSaveStatus('saving');
    try {
      const newTask = await api.createTask(documentInfo.id, addTaskTitle.trim(), addTaskAssignees);
      setTasks(prev => [...prev, newTask]);
      setSaveStatus('saved');
      setShowAddTaskModal(false);

      // Auto-focus and scroll to new block
      setTimeout(() => {
        document.getElementById(`task-section-${newTask.id}`)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setSaveStatus('error');
      alert('단락 생성에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '18px' }}>워드 엔진 초기화 중...</div>
      </div>
    );
  }

  // 1. Author security guard checks
  if (documentInfo && currentUser && documentInfo.created_by !== currentUser.id) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px',
        backgroundColor: 'var(--bg-app)' 
      }}>
        <div style={{ 
          maxWidth: '500px', 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '2px solid #ef4444', 
          padding: '36px', 
          textAlign: 'center', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.05)' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', marginBottom: '12px' }}>생성자 전용 권한 가드 작동</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            죄송합니다. 현재 접속하신 문서는 다른 부서원이 생성한 문서입니다.<br/>
            이 문서의 전체 워드 편집 권한은 **원래 문서를 개설한 생성자({documentInfo.created_by}번 멤버)**에게만 주어집니다.
          </p>
          <button 
            onClick={() => navigate('/docs')} 
            className="btn-primary" 
            style={{ padding: '10px 24px', fontSize: '13px' }}
          >
            ← 문서 보관소로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const dept = departments.find(d => d.id === documentInfo?.department_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f1f5f9' }}>
      
      {/* 1. Word Formatting Float Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'white', 
        padding: '12px 24px', 
        borderBottom: '1px solid #e2e8f0',
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={() => navigate('/docs')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '15px', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← <span>문서함으로</span>
          </button>
          
          <div style={{ height: '16px', width: '1px', backgroundColor: '#cbd5e1' }}></div>
          
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0284c7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '4px' }}>
            ⚙️ 생성자 통합 편집 모드
          </span>
        </div>

        {/* Styling Shortcuts Panel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => {
              const next = !hasCover;
              setHasCover(next);
              handleCoverSave(next, coverSubtitle, coverDescription);
            }}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              border: '1px solid #cbd5e1', 
              fontSize: '12px', 
              fontWeight: '600',
              cursor: 'pointer',
              backgroundColor: hasCover ? '#e0f2fe' : 'white',
              color: hasCover ? '#0369a1' : '#334155'
            }}
          >
            📄 표지 페이지 {hasCover ? '비활성화' : '활성화'}
          </button>

          <button 
            onClick={handleAddNewTask}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              border: '1px solid #0284c7', 
              fontSize: '12px', 
              fontWeight: '600',
              cursor: 'pointer',
              backgroundColor: '#0284c7',
              color: 'white'
            }}
          >
            ➕ 새 단락(Task) 추가
          </button>
          
          <div style={{ height: '16px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 4px' }}></div>
          
          <button style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>B</button>
          <button style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontStyle: 'italic' }}>I</button>
          <button style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}>U</button>
          
          <div style={{ height: '16px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 4px' }}></div>

          <span style={{ 
            fontSize: '11px', 
            color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#b45309' : '#ef4444', 
            fontWeight: '700',
            padding: '2px 8px',
            backgroundColor: saveStatus === 'saved' ? '#dcfce7' : saveStatus === 'saving' ? '#fef3c7' : '#fee2e2',
            borderRadius: '4px'
          }}>
            {saveStatus === 'saved' ? '동기화 완료' : saveStatus === 'saving' ? '저장 중...' : '저장 오류'}
          </span>
        </div>
      </div>

      {/* 2. Workspace Body: Left Outline & Right A4 Paper */}
      <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        
        {/* Left: Interactive Outline Panel */}
        <div style={{ 
          width: '280px', 
          backgroundColor: 'white', 
          borderRight: '1px solid #e2e8f0', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>📝 문서 구조 목차</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {/* Cover Page Anchor in Sidebar */}
            <div 
              onClick={() => {
                if (hasCover) {
                  document.getElementById('doc-cover-anchor')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  alert('상단 툴바에서 표지 페이지를 먼저 활성화해주세요!');
                }
              }}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                fontSize: '13px', 
                cursor: 'pointer', 
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: hasCover ? 1 : 0.5
              }}
            >
              <span style={{ fontWeight: '600' }}>📄 제목 표지 페이지</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{hasCover ? '활성' : '비활성'}</span>
            </div>

            <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 0' }}></div>

            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              태스크 단락 단원
            </span>

            {/* List and reorder task items */}
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  padding: '8px 10px',
                  gap: '6px'
                }}
              >
                <div 
                  onClick={() => document.getElementById(`task-section-${task.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#334155', 
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={task.title}
                >
                  {index + 1}. {task.title || '제목 없음'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                  <button 
                    onClick={() => handleMoveTask(index, 'UP')}
                    disabled={index === 0}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '10px', 
                      borderRadius: '4px', 
                      border: '1px solid #cbd5e1', 
                      backgroundColor: 'white',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      opacity: index === 0 ? 0.3 : 1
                    }}
                  >
                    ▲ 위로
                  </button>
                  <button 
                    onClick={() => handleMoveTask(index, 'DOWN')}
                    disabled={index === tasks.length - 1}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '10px', 
                      borderRadius: '4px', 
                      border: '1px solid #cbd5e1', 
                      backgroundColor: 'white',
                      cursor: index === tasks.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: index === tasks.length - 1 ? 0.3 : 1
                    }}
                  >
                    ▼ 아래로
                  </button>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                이 문서에 생성된 Task 단락이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Right: MS Word Paper Canvas Desk */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          
          {/* A4 Proportion Paper Document Layout */}
          <div style={{ 
            width: '100%',
            maxWidth: '820px',
            minHeight: '1160px',
            backgroundColor: 'white',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #d1d5db',
            padding: '70px 80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px'
          }}>
            
            {/* Title / Cover Page Section */}
            {hasCover && (
              <div 
                id="doc-cover-anchor"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center',
                  minHeight: '620px',
                  borderBottom: '2px dashed #cbd5e1',
                  paddingBottom: '60px',
                  marginBottom: '40px',
                  position: 'relative'
                }}
              >
                {/* Visual Cover Accent */}
                <div style={{ width: '80px', height: '6px', backgroundColor: '#0284c7', marginBottom: '40px' }}></div>

                {/* Cover Main Title Input */}
                <input 
                  type="text"
                  value={docTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="대문서 통합 기획 제목을 입력하세요"
                  style={{ 
                    fontSize: '36px', 
                    fontWeight: '800', 
                    color: '#1e293b', 
                    border: 'none', 
                    outline: 'none', 
                    width: '100%',
                    marginBottom: '16px',
                    fontFamily: 'inherit'
                  }}
                />

                {/* Cover Subtitle Input */}
                <input 
                  type="text"
                  value={coverSubtitle}
                  onChange={(e) => {
                    setCoverSubtitle(e.target.value);
                    handleCoverSave(hasCover, e.target.value, coverDescription);
                  }}
                  placeholder="문서의 서브 타이틀이나 슬로건을 입력해 보세요..."
                  style={{ 
                    fontSize: '18px', 
                    fontWeight: '500', 
                    color: '#64748b', 
                    border: 'none', 
                    outline: 'none', 
                    width: '100%',
                    marginBottom: '48px',
                    fontFamily: 'inherit'
                  }}
                />

                {/* Cover Description Area */}
                <textarea
                  value={coverDescription}
                  onChange={(e) => {
                    setCoverDescription(e.target.value);
                    handleCoverSave(hasCover, coverSubtitle, e.target.value);
                  }}
                  placeholder="본 문서의 총괄 취지 및 요약 정보를 개괄식으로 설명 기입하세요..."
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.7', 
                    color: '#475569', 
                    border: 'none', 
                    outline: 'none', 
                    resize: 'none',
                    minHeight: '100px',
                    width: '100%',
                    fontFamily: 'inherit',
                    backgroundColor: 'transparent',
                    marginBottom: '60px'
                  }}
                />

                {/* Cover Meta Column */}
                <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>소속 부서</span>
                    <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{dept ? dept.name : '본사 기본 부서'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>총괄 작성자</span>
                    <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>생성자 관리 번호 {documentInfo.created_by}</span>
                  </div>
                </div>

                {/* Virtual Page Break Badge */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: '-12px', 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 10px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1'
                }}>
                  페이지 구분선 (PAGE BREAK)
                </div>
              </div>
            )}

            {/* Continuous Inline Word Tasks Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  id={`task-section-${task.id}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  
                  {/* Task Heading (Editable inline) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{index + 1}.</span>
                    <input 
                      type="text"
                      value={task.title}
                      onChange={(e) => handleTaskContentSave(task.id, e.target.value, task.content)}
                      placeholder="단락 제목을 입력하세요"
                      style={{ 
                        fontSize: '18px', 
                        fontWeight: '700', 
                        color: '#0f172a', 
                        border: 'none', 
                        outline: 'none', 
                        flexGrow: 1,
                        fontFamily: 'inherit'
                      }}
                    />
                    
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      fontWeight: '700',
                      background: task.status === 'DONE' ? '#dcfce7' : '#f1f5f9',
                      color: task.status === 'DONE' ? '#15803d' : '#475569'
                    }}>
                      {task.status === 'DONE' ? 'DONE' : task.status}
                    </span>
                  </div>

                  {/* Task Body Textarea (Editable inline) */}
                  <textarea
                    value={task.content}
                    onChange={(e) => handleTaskContentSave(task.id, task.title, e.target.value)}
                    placeholder="단락의 세부 내용을 Word 파일처럼 자유롭게 이곳에 서술형으로 채우세요. 입력 즉시 자동 영속화됩니다..."
                    style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.7', 
                      color: '#334155', 
                      border: 'none', 
                      outline: 'none', 
                      resize: 'none',
                      minHeight: '140px',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: 'transparent',
                      padding: '4px 0'
                    }}
                  />

                </div>
              ))}

              {tasks.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
                  <button 
                    onClick={handleAddNewTask}
                    style={{ 
                      padding: '8px 24px', 
                      borderRadius: '8px', 
                      border: '1.5px dashed #0284c7', 
                      backgroundColor: 'transparent',
                      color: '#0284c7',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ➕ 본문 다음 단락(Task) 추가하기
                  </button>
                </div>
              )}

              {tasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>📄</div>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>비어 있는 워드 페이퍼</h4>
                  <p style={{ fontSize: '12px', marginBottom: '20px' }}>아래 버튼을 눌러 첫 번째 단락(Task)을 즉시 생성하세요.</p>
                  <button 
                    onClick={handleAddNewTask} 
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '8px 20px' }}
                  >
                    ➕ 첫 단락(Task) 만들기
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* GORGEOUS PREMIUM ADD TASK MODAL */}
      {showAddTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '450px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>➕ 신규 Task(단락) 추가 발급</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>해당 문서에 소속될 새로운 협업 Task와 담당 기여 부서원을 다중 지정합니다.</p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>단락(Task) 제목</label>
              <input 
                type="text" 
                value={addTaskTitle}
                onChange={e => setAddTaskTitle(e.target.value)}
                placeholder="예: 3장. 시스템 상세 인터페이스 기획"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                👥 담당 기여 부서원 지정 <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(1 ~ 5명)</span>
              </label>

              {/* Assignees badges list */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '44px', alignItems: 'center', backgroundColor: 'var(--bg-app)' }}>
                {addTaskAssignees.map((uid) => {
                  const member = deptMembersForSelect.find(m => m.id === uid);
                  return (
                    <div 
                      key={uid}
                      onClick={() => handleAddTaskAssigneeRemove(uid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        border: '1px solid #bae6fd'
                      }}
                      title="클릭하여 삭제"
                    >
                      <span>{member?.name}</span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>×</span>
                    </div>
                  );
                })}
                {addTaskAssignees.length === 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>아래 드롭다운에서 담당자를 추가해 주세요.</span>
                )}
              </div>

              {/* Assignee select dropdown */}
              {addTaskAssignees.length < 5 && (
                <div style={{ marginTop: '8px' }}>
                  <select
                    value={0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val > 0) handleAddTaskAssigneeAdd(val);
                    }}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value={0}>+ 담당 부서원 배정 추가</option>
                    {deptMembersForSelect
                      .filter(m => !addTaskAssignees.includes(m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role === 'LEADER' ? '부서장' : '부서원'})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setShowAddTaskModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                취소
              </button>
              <button 
                onClick={submitAddTask}
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px' }}
              >
                발급 완료 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
