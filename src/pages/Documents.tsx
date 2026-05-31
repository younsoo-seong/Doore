import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import MemberSelector from '../components/MemberSelector';
import { canManageTasks } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import RichTextContent from '../components/RichTextContent';

const allDepartmentsOption = { id: 'ALL', name: '전체' };

const sortTasksByOrder = (tasks: any[]) => [...tasks].sort((a: any, b: any) => {
  const orderA = a.block_order ?? a.insertion_index ?? 0;
  const orderB = b.block_order ?? b.insertion_index ?? 0;
  return orderA - orderB || a.id - b.id;
});

const getTaskReviewLabel = (task: any) => {
  if (task.status !== 'DONE') return null;
  if (task.review_status === 'APPROVED') return '승인 완료';
  return '승인 요청 중';
};

export default function Documents() {
  const navigate = useNavigate();
  const { currentUser, currentCompany } = useAuth();
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [activeDept, setActiveDept] = useState<any>(null);
  const [docsData, setDocsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentDeptRole, setCurrentDeptRole] = useState<string | null>(null);
  const [currentCompanyRole, setCurrentCompanyRole] = useState<string | null>(null);
  const [departmentRoleMap, setDepartmentRoleMap] = useState<Record<number, string | null>>({});

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptMembers, setDeptMembers] = useState<any[]>([]);
  
  // Department member invite selection state
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState<number[]>([]);
  const [inviteRoles, setInviteRoles] = useState<Record<number, 'LEADER' | 'TASK_MANAGER' | 'MEMBER'>>({});
  const [isInviting, setIsInviting] = useState(false);

  // Integrated Document View Modal State
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [viewingDocTasks, setViewingDocTasks] = useState<any[]>([]);
  const [loadingDocView, setLoadingDocView] = useState(false);

  // New Document & Task/Assignee Creation Modal State
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [initialTasks, setInitialTasks] = useState<any[]>([]);
  const [deptMembersForSelect, setDeptMembersForSelect] = useState<any[]>([]);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  // Add Task Modal State (Created after doc creation)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskAssignees, setAddTaskAssignees] = useState<number[]>([]);
  const [addTaskDocId, setAddTaskDocId] = useState<number | null>(null);
  const [showTaskAssigneeModal, setShowTaskAssigneeModal] = useState(false);
  const [editingAssigneeTask, setEditingAssigneeTask] = useState<any>(null);
  const [taskAssigneeOptions, setTaskAssigneeOptions] = useState<any[]>([]);
  const [draftTaskAssignees, setDraftTaskAssignees] = useState<number[]>([]);
  const [isSavingTaskAssignees, setIsSavingTaskAssignees] = useState(false);

  const isAllDepartments = activeDept?.id === 'ALL';

  const loadAssignableDepartmentMembers = async (departmentId: number) => {
    if (!currentCompany) return [];

    const [members, companyMemberList] = await Promise.all([
      api.getDepartmentMembers(departmentId),
      api.getCompanyMembers(currentCompany.id),
    ]);
    const ownerIds = new Set(
      companyMemberList
        .filter((member: any) => member.role === 'OWNER')
        .map((member: any) => member.id)
    );

    return members.filter((member: any) => !ownerIds.has(member.id));
  };

  const getDefaultAssigneeIds = (members: any[]) => {
    if (currentUser && members.some((member: any) => member.id === currentUser.id)) {
      return [currentUser.id];
    }
    return members[0] ? [members[0].id] : [];
  };

  useEffect(() => {
    async function loadDepts() {
      if (currentCompany) {
        const depts = await api.getDepartments(currentCompany.id);
        setDepartments(depts);
        setActiveDept(allDepartmentsOption);
      } else {
        setDepartments([]);
        setActiveDept(null);
      }
      setLoading(false);
    }
    loadDepts();
  }, [currentCompany]);

  useEffect(() => {
    async function loadDocs() {
      if (activeDept && currentCompany) {
        setLoading(true);
        const data = activeDept.id === 'ALL'
          ? await api.getDocuments()
          : await api.getDocuments(Number(activeDept.id));
        if (activeDept.id === 'ALL') {
          const companyDeptIds = departments.map((dept) => dept.id);
          setDocsData({
            ...data,
            documents: data.documents.filter((doc: any) => companyDeptIds.includes(doc.department_id)),
          });
        } else {
          setDocsData(data);
        }
        setLoading(false);
      } else {
        setDocsData(null);
      }
    }
    loadDocs();
  }, [activeDept, currentCompany, departments]);

  useEffect(() => {
    async function loadMyDepartmentRole() {
      if (!activeDept || activeDept.id === 'ALL' || !currentUser) {
        setCurrentDeptRole(null);
        return;
      }

      const members = await api.getDepartmentMembers(Number(activeDept.id));
      const me = members.find((member: any) => member.id === currentUser.id);
      setCurrentDeptRole(me?.role ?? null);
    }

    loadMyDepartmentRole();
  }, [activeDept, currentUser]);

  useEffect(() => {
    async function loadMyCompanyRole() {
      if (!currentCompany || !currentUser) {
        setCurrentCompanyRole(null);
        return;
      }
      const members = await api.getCompanyMembers(currentCompany.id);
      const me = members.find((member: any) => member.id === currentUser.id);
      setCurrentCompanyRole(me?.role ?? null);
    }

    loadMyCompanyRole();
  }, [currentCompany, currentUser]);

  useEffect(() => {
    async function loadDepartmentRoles() {
      if (!currentCompany || !currentUser) {
        setDepartmentRoleMap({});
        return;
      }

      const depts = await api.getDepartments(currentCompany.id);
      const entries = await Promise.all(depts.map(async (dept: any) => {
        const members = await api.getDepartmentMembers(dept.id);
        const me = members.find((member: any) => member.id === currentUser.id);
        return [dept.id, me?.role ?? null] as const;
      }));
      setDepartmentRoleMap(Object.fromEntries(entries));
    }

    loadDepartmentRoles();
  }, [currentCompany, currentUser]);

  const getDepartmentRole = (departmentId?: number) => departmentId ? departmentRoleMap[departmentId] ?? null : null;
  const canManageActiveDept = !isAllDepartments && canManageTasks(currentDeptRole);
  const canCreateDepartment = currentCompanyRole === 'OWNER';
  const canManageDepartment = !isAllDepartments && (canCreateDepartment || canManageActiveDept);
  const canManageViewingDoc = viewingDoc ? canManageTasks(getDepartmentRole(viewingDoc.department_id)) : false;

  const openSettings = async () => {
    if (!activeDept || !currentCompany) return;
    if (!canManageDepartment) {
      alert('부서 배치와 권한 관리는 조직장 또는 부서장 권한이 필요합니다.');
      return;
    }
    setDeptName(activeDept.name);
    
    // 1. Fetch current department members
    const members = await api.getDepartmentMembers(Number(activeDept.id));
    setDeptMembers(members);
    
    // 2. Fetch all company members to find invite candidates
    const allCompanyMembers = await api.getCompanyMembers(currentCompany.id);
    const currentMemberIds = members.map((m: any) => m.id);
    const candidates = allCompanyMembers.filter((m: any) => (
      !currentMemberIds.includes(m.id) &&
      m.role !== 'OWNER'
    ));
    setCompanyMembers(candidates);
    
    setSelectedInviteIds([]);
    setInviteRoles({});
    setShowSettings(true);
  };

  // Open the New Document & Tasks Creation Modal
  const openCreateDocModal = async () => {
    if (!activeDept || isAllDepartments) {
      alert('문서를 생성할 부서를 먼저 선택해 주세요.');
      return;
    }
    if (!canManageActiveDept) {
      alert('문서 생성과 Task 분할은 부서장만 가능합니다.');
      return;
    }
    try {
      const members = await loadAssignableDepartmentMembers(Number(activeDept.id));
      setDeptMembersForSelect(members);
      setNewDocTitle('');
      const defaultAssigneeIds = getDefaultAssigneeIds(members);
      setInitialTasks([
        { id: Date.now(), title: '', assigneeIds: defaultAssigneeIds }
      ]);
      setShowCreateDocModal(true);
    } catch (e) {
      console.error("Failed to load department members for doc creation", e);
    }
  };

  const handleAddTaskRow = () => {
    setInitialTasks(prev => [
      ...prev,
      { id: Date.now() + Math.random(), title: '', assigneeIds: getDefaultAssigneeIds(deptMembersForSelect) }
    ]);
  };

  const handleRemoveTaskRow = (rowId: number) => {
    if (initialTasks.length <= 1) return;
    setInitialTasks(prev => prev.filter(t => t.id !== rowId));
  };

  const handleTaskRowTitleChange = (rowId: number, val: string) => {
    setInitialTasks(prev => prev.map(t => t.id === rowId ? { ...t, title: val } : t));
  };

  const handleTaskRowAddAssignee = (rowId: number, userId: number) => {
    setInitialTasks(prev => prev.map(t => {
      if (t.id !== rowId) return t;
      if (t.assigneeIds.includes(userId)) return t;
      if (t.assigneeIds.length >= 5) {
        alert('한 업무당 담당자는 최대 5명까지만 지정할 수 있습니다.');
        return t;
      }
      return { ...t, assigneeIds: [...t.assigneeIds, userId] };
    }));
  };

  const handleTaskRowRemoveAssignee = (rowId: number, userId: number) => {
    setInitialTasks(prev => prev.map(t => {
      if (t.id !== rowId) return t;
      if (t.assigneeIds.length <= 1) {
        alert('최소 1명 이상의 담당자가 지정되어 있어야 합니다.');
        return t;
      }
      return { ...t, assigneeIds: t.assigneeIds.filter((uid: number) => uid !== userId) };
    }));
  };

  const submitCreateDocument = async () => {
    if (!activeDept || !currentUser) return;
    if (!newDocTitle.trim()) {
      alert('문서 제목을 입력해 주세요.');
      return;
    }

    const validTasks = initialTasks.filter(t => t.title.trim() !== '');
    if (validTasks.length === 0) {
      alert('최소 1개 이상의 유효한 Task 제목을 기입해 주세요.');
      return;
    }

    setIsCreatingDoc(true);
    try {
      // 1. Create document
      const newDoc = await api.createDocument(Number(activeDept.id), newDocTitle, currentUser.id);

      // 2. Create tasks with their assigned userIds array
      for (const taskRow of validTasks) {
        await api.createTask(newDoc.id, taskRow.title, taskRow.assigneeIds);
      }

      alert('성공적으로 문서 개설 및 Task 복수 담당자 지정 배정이 완료되었습니다.');
      setShowCreateDocModal(false);

      // Reload
      const data = await api.getDocuments(Number(activeDept.id));
      setDocsData(data);
    } catch (e) {
      console.error(e);
      alert('문서 개설 과정 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const openAddTaskModal = async (docId: number) => {
    const targetDoc = viewingDoc?.id === docId
      ? viewingDoc
      : docsData?.documents.find((doc: any) => doc.id === docId);
    if (!targetDoc) return;

    const targetDeptRole = getDepartmentRole(targetDoc.department_id);
    if (!canManageTasks(targetDeptRole)) {
      alert('Task 추가 생성은 부서장만 가능합니다.');
      return;
    }
    try {
      const members = await loadAssignableDepartmentMembers(targetDoc.department_id);
      setDeptMembersForSelect(members);
      setAddTaskDocId(docId);
      setAddTaskTitle('');
      setAddTaskAssignees(getDefaultAssigneeIds(members));
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
    if (!addTaskDocId || !addTaskTitle.trim()) {
      alert('Task 제목을 입력하세요.');
      return;
    }
    if (addTaskAssignees.length < 1) {
      alert('최소 1명 이상의 담당자를 배정하세요.');
      return;
    }
    try {
      await api.createTask(addTaskDocId, addTaskTitle.trim(), addTaskAssignees);
      alert('Task가 성공적으로 추가 생성되었습니다.');
      setShowAddTaskModal(false);
      
      // If currently viewing doc details modal, refresh the tasks list immediately
      if (viewingDoc && viewingDoc.id === addTaskDocId) {
        await refreshViewingDocTasks(viewingDoc.id);
      }
      await refreshActiveDepartmentDocs();
    } catch (e) {
      console.error(e);
      alert('Task 추가 과정 중 오류가 발생했습니다.');
    }
  };

  const openTaskAssigneeModal = async (task: any) => {
    if (!viewingDoc) return;
    try {
      const [members, taskDetail] = await Promise.all([
        loadAssignableDepartmentMembers(viewingDoc.department_id),
        api.getTaskById(task.id),
      ]);
      setTaskAssigneeOptions(members);
      setEditingAssigneeTask(task);
      setDraftTaskAssignees(taskDetail.assignees || []);
      setShowTaskAssigneeModal(true);
    } catch (e: any) {
      alert(e.message || 'Task 담당자 정보를 불러오지 못했습니다.');
    }
  };

  const toggleDraftTaskAssignee = (userId: number) => {
    setDraftTaskAssignees((prev) => {
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

  const saveTaskAssignees = async () => {
    if (!editingAssigneeTask || !viewingDoc) return;
    if (draftTaskAssignees.length < 1) {
      alert('최소 1명 이상의 담당자를 지정하세요.');
      return;
    }

    setIsSavingTaskAssignees(true);
    try {
      await api.updateTaskAssignees(editingAssigneeTask.id, draftTaskAssignees);
      setShowTaskAssigneeModal(false);
      setEditingAssigneeTask(null);
      await refreshViewingDocTasks(viewingDoc.id);
      alert('Task 담당자가 변경되었습니다.');
    } catch (e: any) {
      alert(e.message || 'Task 담당자 변경에 실패했습니다.');
    } finally {
      setIsSavingTaskAssignees(false);
    }
  };

  const handleRequestDocApproval = async () => {
    if (!viewingDoc) return;
    
    const notApprovedTasks = viewingDocTasks.filter((t: any) => t.status !== 'DONE' || t.review_status !== 'APPROVED');
    if (notApprovedTasks.length > 0) {
      alert(`아직 부서장 승인 완료되지 않은 Task가 ${notApprovedTasks.length}개 있습니다. 모든 Task가 승인 완료되어야 결재 요청이 가능합니다.\n\n[미승인 Task]:\n${notApprovedTasks.map(t => `• ${t.title}`).join('\n')}`);
      return;
    }

    const ok = window.confirm('조직장에게 결재를 요청하시겠습니까?\n요청 후 문서를 더 이상 수정할 수 없습니다.');
    if (!ok) return;

    try {
      const updatedDoc = await api.requestDocumentApproval(viewingDoc.id);
      setViewingDoc(updatedDoc);
      alert('결재 요청이 완료되었습니다.');
      
      // Reload document list
      await refreshActiveDepartmentDocs();
    } catch (e: any) {
      alert(e.message || '승인 요청에 실패했습니다.');
    }
  };

  const refreshViewingDocTasks = async (documentId: number) => {
    const data = await api.getTasksData();
    const docTasks = data.tasks.filter((t: any) => t.document_id === documentId);
    setViewingDocTasks(sortTasksByOrder(docTasks));
  };

  const refreshActiveDepartmentDocs = async () => {
    if (!activeDept || !currentCompany) return;
    const data = activeDept.id === 'ALL'
      ? await api.getDocuments()
      : await api.getDocuments(Number(activeDept.id));
    if (activeDept.id === 'ALL') {
      const companyDeptIds = departments.map((dept) => dept.id);
      setDocsData({
        ...data,
        documents: data.documents.filter((doc: any) => companyDeptIds.includes(doc.department_id)),
      });
    } else {
      setDocsData(data);
    }
  };

  const handleMoveViewingTask = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!viewingDoc) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= viewingDocTasks.length) return;

    const reordered = [...viewingDocTasks];
    const current = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = current;
    setViewingDocTasks(reordered);

    try {
      await api.reorderTasks(viewingDoc.id, reordered.map((task: any) => task.id));
      await refreshViewingDocTasks(viewingDoc.id);
    } catch (e) {
      console.error(e);
      alert('Task 순서 변경에 실패했습니다.');
      await refreshViewingDocTasks(viewingDoc.id);
    }
  };

  const handleOpenTaskBoard = async (task: any, reopenForEdit = false) => {
    if (!viewingDoc) return;

    if (reopenForEdit && task.status === 'DONE' && viewingDoc.status === 'WORKING' && currentUser) {
      try {
        await api.reopenTaskForEdit(task.id, currentUser.id);
      } catch (e: any) {
        alert(e.message || 'Task를 수정 가능 상태로 전환하지 못했습니다.');
        return;
      }
    }

    setViewingDoc(null);
    navigate(`/edit-task/${task.id}`);
  };

  const handleInviteMembers = async () => {
    if (!activeDept || selectedInviteIds.length === 0) return;
    setIsInviting(true);
    try {
      for (const userId of selectedInviteIds) {
        const role = inviteRoles[userId] || 'MEMBER';
        await api.addDepartmentMember(Number(activeDept.id), userId, role);
      }
      alert(`${selectedInviteIds.length}명의 부서원을 정상적으로 추가했습니다.`);
      
      // Refresh modal data
      const updatedMembers = await api.getDepartmentMembers(Number(activeDept.id));
      setDeptMembers(updatedMembers);
      
      if (currentCompany) {
        const allCompanyMembers = await api.getCompanyMembers(currentCompany.id);
        const currentMemberIds = updatedMembers.map((m: any) => m.id);
        setCompanyMembers(allCompanyMembers.filter((m: any) => !currentMemberIds.includes(m.id)));
      }
      setSelectedInviteIds([]);
      setInviteRoles({});
    } catch (e: any) {
      alert(e.message || '초대 오류 발생');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateDeptMemberRole = async (userId: number, newRole: 'LEADER' | 'TASK_MANAGER' | 'MEMBER') => {
    if (!activeDept) return;
    try {
      await api.updateDepartmentMemberRole(Number(activeDept.id), userId, newRole);
      // Refresh
      const updated = await api.getDepartmentMembers(Number(activeDept.id));
      setDeptMembers(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Open Integrated Document View Modal
  const handleOpenDocView = async (doc: any) => {
    setLoadingDocView(true);
    setViewingDoc(doc);
    try {
      const data = await api.getTasksData();
      const docTasks = data.tasks.filter((t: any) => t.document_id === doc.id);
      setViewingDocTasks(sortTasksByOrder(docTasks));
    } catch (e) {
      console.error("Failed to load integrated document view", e);
    } finally {
      setLoadingDocView(false);
    }
  };

  if (loading && !departments.length) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>부서 정보를 불러오는 중입니다...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: '24px', padding: '20px' }}>
      
      {/* Left Panel: Departments */}
      <div style={{ width: '250px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>
           부서 목록
        </div>
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px 0' }}>
          <div
            onClick={() => setActiveDept(allDepartmentsOption)}
            style={{ padding: '12px 16px', cursor: 'pointer', backgroundColor: isAllDepartments ? 'var(--primary-light)' : 'transparent', borderLeft: isAllDepartments ? '3px solid var(--primary)' : '3px solid transparent', fontWeight: isAllDepartments ? '600' : '400' }}
          >
            전체
          </div>
          {departments.map(dept => (
            <div 
              key={dept.id} 
              onClick={() => setActiveDept(dept)}
              style={{ padding: '12px 16px', cursor: 'pointer', backgroundColor: activeDept?.id === dept.id ? 'var(--primary-light)' : 'transparent', borderLeft: activeDept?.id === dept.id ? '3px solid var(--primary)' : '3px solid transparent', fontWeight: activeDept?.id === dept.id ? '600' : '400' }}
            >
              {dept.name}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <ApiHint hint={apiHints.createDepartment} align="left" fullWidth>
            <button
              onClick={() => canCreateDepartment ? navigate('/create-department') : alert('하위 부서 생성은 조직장 권한이 필요합니다.')}
              disabled={!canCreateDepartment}
              title={canCreateDepartment ? '조직 내 하위 부서를 생성합니다.' : '조직장 권한이 필요합니다.'}
              style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', border: '1px dashed var(--primary)', color: 'var(--primary)', borderRadius: '8px', cursor: canCreateDepartment ? 'pointer' : 'not-allowed', fontWeight: '600', opacity: canCreateDepartment ? 1 : 0.45 }}
            >
              + 새 부서 생성
            </button>
          </ApiHint>
        </div>
      </div>

      {/* Right Panel: Documents */}
      <div style={{ flexGrow: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
        {activeDept ? (
          <>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{activeDept.name} 문서함</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={openSettings} 
                  disabled={!canManageDepartment}
                  style={{ 
                    padding: '10px 16px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)', 
                    backgroundColor: 'var(--bg-card)', 
                    color: 'var(--text-primary)', 
                    cursor: canManageDepartment ? 'pointer' : 'not-allowed',
                    opacity: canManageDepartment ? 1 : 0.45,
                    fontWeight: '600', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    fontSize: '13px'
                  }}
                >
                   부서 관리
                </button>
                <ApiHint hint={apiHints.createDocument}>
                  <button
                    onClick={openCreateDocModal}
                    className="btn-primary"
                    disabled={!canManageActiveDept}
                    title={canManageActiveDept ? '문서를 만들고 Task를 분할합니다.' : '부서장 권한이 필요합니다.'}
                  >
                    + 새 문서 생성
                  </button>
                </ApiHint>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>문서 제목</th>
                    <th>상태</th>
                    <th>작성자</th>
                    <th>최종 수정일</th>
                    <th style={{ textAlign: 'right' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {docsData?.documents.map((doc: any) => {
                    const author = docsData.users.find((u: any) => u.id === doc.created_by);
                    const docDept = departments.find((dept) => dept.id === doc.department_id);
                    const canManageDocTasks = canManageTasks(getDepartmentRole(doc.department_id));
                    return (
                      <tr key={doc.id} onClick={() => handleOpenDocView(doc)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{doc.title}</div>
                          {isAllDepartments && (
                            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{docDept?.name ?? '부서 없음'}</div>
                          )}
                        </td>
                        <td>
                          <span className={`doc-status ${doc.status}`}>
                            {doc.status === 'WORKING' ? '작성 중' : doc.status === 'PENDING' ? '결재 대기' : doc.status === 'APPROVED' ? '승인됨' : '반려됨'}
                          </span>
                        </td>
                        <td>
                          <div className="doc-author-cell">
                            <div className="avatar" style={{width: 24, height: 24, fontSize: 10}}>{author?.name.charAt(0)}</div>
                            <span>{author?.name}</span>
                          </div>
                        </td>
                        <td>{new Date(doc.updated_at).toLocaleDateString('ko-KR')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <ApiHint hint={apiHints.createTask}>
                              <button
                                onClick={(e) => { e.stopPropagation(); openAddTaskModal(doc.id); }}
                                disabled={!canManageDocTasks || doc.status !== 'WORKING'}
                                style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: canManageDocTasks && doc.status === 'WORKING' ? 'pointer' : 'not-allowed', opacity: canManageDocTasks && doc.status === 'WORKING' ? 1 : 0.45 }}
                              >
                              + Task 생성
                            </button>
                          </ApiHint>
                        </td>
                      </tr>
                    );
                  })}
                  {docsData?.documents.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        생성된 문서가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            선택된 부서가 없습니다. 좌측에서 부서를 선택하거나 생성하세요.
          </div>
        )}
      </div>

      {/* Integrated Document View Modal */}
      {viewingDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '1000px', maxWidth: '90vw', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   {activeDept?.name} 문서 자료실
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: '700', marginTop: '4px', color: 'var(--text-primary)' }}>
                   {viewingDoc.title}
                </h3>
              </div>
              <span className={`doc-status ${viewingDoc.status}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
                {viewingDoc.status === 'WORKING' ? '작성 중' : viewingDoc.status === 'PENDING' ? '결재 대기' : viewingDoc.status === 'APPROVED' ? '승인됨' : '반려됨'}
              </span>
            </div>

            {/* Content Body */}
            {loadingDocView ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>통합 보고서 조립 중...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flexGrow: 1 }}>
                
                {/* Integration Info Banner */}
                <div style={{ 
                  backgroundColor: 'var(--bg-app)', 
                  border: '1px solid var(--border-color)', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)', 
                  lineHeight: '1.5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ flex: '1 1 300px' }}>
                     본 문서는 소속 부서원들의 실시간 Task 기여분을 통합 및 병합한 최종 보고서입니다.
                  </div>
                  {viewingDoc.status === 'WORKING' && canManageViewingDoc && (
                    <ApiHint hint={apiHints.createTask}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddTaskModal(viewingDoc.id);
                        }}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
                      >
                         Task 추가 생성
                      </button>
                    </ApiHint>
                  )}
                </div>

                {/* Sub-tasks Loop (The Integrated Document View) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '10px' }}>
                  {viewingDocTasks.map((task: any, index: number) => (
                    <div key={task.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', background: 'white' }}>
                      {/* Task Title Header */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '14px', alignItems: 'start', marginBottom: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Task {index + 1}</span>
                            <span style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontWeight: '800',
                              background: task.review_status === 'APPROVED' ? '#dcfce7' : task.status === 'DONE' ? '#dbeafe' : task.status === 'DOING' ? '#fef3c7' : '#e2e8f0',
                              color: task.review_status === 'APPROVED' ? '#15803d' : task.status === 'DONE' ? '#1d4ed8' : task.status === 'DOING' ? '#b45309' : '#475569'
                            }}>
                              {getTaskReviewLabel(task) || (task.status === 'DOING' ? '진행 중' : '할 일')}
                            </span>
                          </div>
                          <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                            {task.title}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          {viewingDoc.status === 'WORKING' && canManageViewingDoc && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-app)' }} title="Task 순서 변경">
                              <button
                                type="button"
                                aria-label={`${task.title} 위로 이동`}
                                title="위로 이동"
                                onClick={() => handleMoveViewingTask(index, 'UP')}
                                disabled={index === 0}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 900, cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.28 : 1, lineHeight: 1 }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label={`${task.title} 아래로 이동`}
                                title="아래로 이동"
                                onClick={() => handleMoveViewingTask(index, 'DOWN')}
                                disabled={index === viewingDocTasks.length - 1}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 900, cursor: index === viewingDocTasks.length - 1 ? 'not-allowed' : 'pointer', opacity: index === viewingDocTasks.length - 1 ? 0.28 : 1, lineHeight: 1 }}
                              >
                                ↓
                              </button>
                            </div>
                          )}
                          {viewingDoc.status === 'WORKING' && canManageViewingDoc && task.status !== 'DONE' && (
                            <ApiHint hint={apiHints.assignTaskAssignee}>
                              <button
                                type="button"
                                onClick={() => openTaskAssigneeModal(task)}
                                style={{ padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                담당자 변경
                              </button>
                            </ApiHint>
                          )}
                          <ApiHint hint={task.status === 'DONE' ? apiHints.reopenTask : apiHints.editTaskRealtime}>
                            <button
                              type="button"
                              onClick={() => handleOpenTaskBoard(task)}
                              style={{ padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'white', color: 'var(--primary)', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              업무 보드로 이동
                            </button>
                          </ApiHint>
                          {viewingDoc.status === 'WORKING' && canManageViewingDoc && task.status === 'DONE' && task.review_status !== 'APPROVED' && (
                            <ApiHint hint={apiHints.reopenTask}>
                              <button
                                type="button"
                                onClick={() => handleOpenTaskBoard(task, true)}
                                style={{ padding: '7px 11px', borderRadius: '8px', border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                재작업
                              </button>
                            </ApiHint>
                          )}
                        </div>
                      </div>

                        {/* Task Content Box */}
                        <div style={{ 
                          backgroundColor: 'var(--bg-app)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          fontSize: '14px', 
                          lineHeight: '1.6', 
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          minHeight: '60px'
                        }}>
                          {task.rejection_reason && task.status === 'DOING' && (
                            <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', fontWeight: 800 }}>
                              반려 사유: {task.rejection_reason}
                            </div>
                          )}
                          <RichTextContent
                            content={task.content}
                            emptyStyle={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
                          />
                        </div>

                      </div>
                  ))}

                  {viewingDocTasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
                      연결된 하위 Task가 없습니다. 우측의 [+ Task 생성] 버튼을 통해 업무를 생성하세요.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                onClick={() => {
                  setViewingDoc(null);
                }} 
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                닫기
              </button>

              {/* Approval request request button */}
              {viewingDoc.status === 'WORKING' && canManageViewingDoc && (
                <ApiHint hint={apiHints.requestApproval}>
                  <button
                    onClick={handleRequestDocApproval}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                     결재 요청
                  </button>
                </ApiHint>
              )}
              {viewingDoc.status === 'PENDING' && canManageViewingDoc && (
                <span className="doc-status PENDING" style={{ padding: '10px 14px' }}>결재 요청 중</span>
              )}

              {/* Navigate to tasks boards if editable */}
              {viewingDoc.status === 'WORKING' && (
                <button 
                  onClick={() => {
                    setViewingDoc(null);
                    navigate('/tasks');
                  }}
                  className="btn-primary"
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                >
                  업무 보드로 이동해 편집하기 
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Department Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '560px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>부서 설정 ({activeDept?.name})</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>부서 이름 수정</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={deptName} 
                  onChange={e => setDeptName(e.target.value)} 
                  style={{ flexGrow: 1, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
                <button 
                  onClick={async () => {
                    await api.updateDepartment(Number(activeDept.id), deptName);
                    setDepartments(departments.map(d => d.id === activeDept.id ? { ...d, name: deptName } : d));
                    setActiveDept({ ...activeDept, name: deptName });
                    alert('부서 이름이 수정되었습니다.');
                  }}
                  className="btn-primary" style={{ padding: '8px 16px' }}
                >
                  저장
                </button>
              </div>
            </div>

            {/* Department Members Management */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>부서 소속원 관리 ({deptMembers.length}명)</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '16px' }}>
                {deptMembers.map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{member.name.charAt(0)}</div>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{member.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      
                      {/* Role selection dropdown inside Settings Modal */}
                      <ApiHint hint={apiHints.updateDepartmentRole}>
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateDeptMemberRole(member.id, e.target.value as 'LEADER' | 'TASK_MANAGER' | 'MEMBER')}
                          style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                        >
                          <option value="MEMBER">부서원</option>
                          <option value="LEADER">부서장</option>
                        </select>
                      </ApiHint>

                      <button 
                        onClick={async () => {
                          if (confirm(`${member.name} 님을 부서에서 제외하시겠습니까?`)) {
                            await api.removeDepartmentMember(Number(activeDept.id), member.id);
                            // Refresh list
                            const updated = deptMembers.filter(m => m.id !== member.id);
                            setDeptMembers(updated);
                            if (currentCompany) {
                              const all = await api.getCompanyMembers(currentCompany.id);
                              const updatedMemberIds = updated.map(u => u.id);
                              setCompanyMembers(all.filter((c: any) => (
                                !updatedMemberIds.includes(c.id) &&
                                c.role !== 'OWNER'
                              )));
                            }
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', marginLeft: '6px' }}
                      >
                        제외
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Standard searchable invite selector */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>부서에 추가할 멤버 선택</label>
                <MemberSelector 
                  candidates={companyMembers}
                  selectedIds={selectedInviteIds}
                  onSelect={(id) => {
                    setSelectedInviteIds(prev => [...prev, id]);
                    setInviteRoles(prev => ({ ...prev, [id]: 'MEMBER' }));
                  }}
                  onDeselect={(id) => {
                    setSelectedInviteIds(prev => prev.filter(x => x !== id));
                    setInviteRoles(prev => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                  }}
                  placeholder="부서원 추가 검색..."
                  renderExtraActions={(userId) => (
                    <select
                      value={inviteRoles[userId] || 'MEMBER'}
                      onChange={(e) => setInviteRoles(prev => ({ ...prev, [userId]: e.target.value as 'LEADER' | 'TASK_MANAGER' | 'MEMBER' }))}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        marginRight: '4px'
                      }}
                    >
                      <option value="MEMBER">부서원</option>
                      <option value="LEADER">부서장</option>
                    </select>
                  )}
                />
                <ApiHint hint={apiHints.assignDepartmentMember} align="left" fullWidth>
                  <button
                    onClick={handleInviteMembers}
                    disabled={selectedInviteIds.length === 0 || isInviting}
                    className="btn-primary"
                    style={{ width: '100%', padding: '10px', marginTop: '12px', fontSize: '13px' }}
                  >
                    {isInviting ? '부서원 추가 중...' : `선택된 ${selectedInviteIds.length}명 부서에 추가`}
                  </button>
                </ApiHint>
              </div>
            </div>

            <div style={{ textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Document & Task/Assignee Creation Modal */}
      {showCreateDocModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '600px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}> 새 문서 및 초기 Task/담당자 일괄 개설</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>부서 문서를 신규 개설함과 동시에, 하위 협업 Task 배정 및 당사자 지정을 원스톱으로 처리합니다.</p>
            </div>

            {/* Document Title input */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                1. 문서 제목 기입
              </label>
              <input 
                type="text" 
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                placeholder="예: 상반기 신제품 UI 디자인 개편 기획서"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Initial Tasks Configuration */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  2. 초기 협업 Task 추가 및 담당 부서원 지정
                </label>
                <button 
                  onClick={handleAddTaskRow}
                  style={{ padding: '4px 10px', fontSize: '11px', background: 'transparent', border: '1px dashed var(--primary)', color: 'var(--primary)', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
                >
                  + Task 추가
                </button>
              </div>

              {/* Task rows list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
                {initialTasks.map((t, idx) => (
                  <div key={t.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', width: '20px' }}>{idx + 1}</span>
                    
                    {/* Task Title input */}
                    <input 
                      type="text" 
                      value={t.title}
                      onChange={e => handleTaskRowTitleChange(t.id, e.target.value)}
                      placeholder="Task 제목 (예: 피그마 초안)"
                      style={{ flexGrow: 1, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                    />

                    {/* Assignees Avatars & Multi-selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '160px', flexWrap: 'wrap' }}>
                      {t.assigneeIds.map((uid: number) => {
                        const member = deptMembersForSelect.find(m => m.id === uid);
                        return (
                          <div 
                            key={uid}
                            onClick={() => handleTaskRowRemoveAssignee(t.id, uid)}
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
                              border: '1px solid #bae6fd',
                              position: 'relative'
                            }}
                            title={`${member?.name || '부서원'} (클릭하여 삭제)`}
                          >
                            <span>{member?.name}</span>
                            <span style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '2px' }}>×</span>
                          </div>
                        );
                      })}
                      {t.assigneeIds.length < 5 && (
                        <select
                          value={0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (val > 0) {
                              handleTaskRowAddAssignee(t.id, val);
                            }
                          }}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: '1px dashed var(--border-color)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent'
                          }}
                        >
                          <option value={0}>+ 담당자 추가</option>
                          {deptMembersForSelect
                            .filter(m => !t.assigneeIds.includes(m.id))
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>

                    {/* Delete row button */}
                    <button 
                      onClick={() => handleRemoveTaskRow(t.id)}
                      disabled={initialTasks.length <= 1}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#ef4444', 
                        cursor: initialTasks.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: '700',
                        opacity: initialTasks.length <= 1 ? 0.3 : 1
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit / Cancel Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
              <button 
                onClick={() => setShowCreateDocModal(false)}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                disabled={isCreatingDoc}
              >
                취소
              </button>
              <ApiHint hint={apiHints.createTask}>
                <button
                  onClick={submitCreateDocument}
                  className="btn-primary"
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                  disabled={isCreatingDoc}
                >
                  {isCreatingDoc ? '개설 중...' : '개설 및 배정 완료 '}
                </button>
              </ApiHint>
            </div>

          </div>
        </div>
      )}
      {showTaskAssigneeModal && editingAssigneeTask && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '460px', maxWidth: '100%', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>Task 담당자 변경</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {editingAssigneeTask.title} 담당자를 1명 이상, 최대 5명까지 지정합니다.
              </p>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
              {taskAssigneeOptions.map((member: any) => {
                const checked = draftTaskAssignees.includes(member.id);
                return (
                  <label
                    key={member.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: checked ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraftTaskAssignee(member.id)}
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
              {taskAssigneeOptions.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  배정 가능한 부서원이 없습니다.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>선택 {draftTaskAssignees.length}명</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTaskAssigneeModal(false)}
                  disabled={isSavingTaskAssignees}
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: isSavingTaskAssignees ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  취소
                </button>
                <ApiHint hint={apiHints.assignTaskAssignee}>
                  <button
                    type="button"
                    onClick={saveTaskAssignees}
                    disabled={isSavingTaskAssignees || draftTaskAssignees.length < 1}
                    className="btn-primary"
                    style={{ padding: '9px 14px', minHeight: 0, fontSize: '13px' }}
                  >
                    {isSavingTaskAssignees ? '저장 중...' : '담당자 저장'}
                  </button>
                </ApiHint>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* GORGEOUS PREMIUM ADD TASK MODAL */}
      {showAddTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '450px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}> 신규 Task 추가 생성</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>해당 문서에 소속될 새로운 협업 Task와 담당 기여 부서원을 다중 지정합니다.</p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Task 제목</label>
              <input 
                type="text" 
                value={addTaskTitle}
                onChange={e => setAddTaskTitle(e.target.value)}
                placeholder="예: API 게이트웨이 연동 명세 작성"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                 담당자 지정 <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(1 ~ 5명)</span>
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
                          {m.name} ({m.role === 'LEADER' || m.role === 'TASK_MANAGER' ? '부서장' : '부서원'})
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
              <ApiHint hint={apiHints.createTask}>
                <button
                  onClick={submitAddTask}
                  className="btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px' }}
                >
                  생성 완료 
                </button>
              </ApiHint>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
