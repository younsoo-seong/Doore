import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { canManageTasks, canReviewTask, getTaskStatusLabel } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

const columns = ['TODO', 'DOING', 'DONE'] as const;

const getTaskReviewLabel = (task: any) => {
  if (task.status !== 'DONE') return null;
  if (task.review_status === 'APPROVED') return '승인 완료';
  return '승인 요청 중';
};

const getPendingReviewLabel = (task: any, canReview: boolean) => {
  if (!canReview || task.status !== 'DOING') return null;
  return '담당자 승인 요청 전';
};

export default function Tasks() {
  const navigate = useNavigate();
  const { currentUser, currentCompany } = useAuth();
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [scope, setScope] = useState('MY');
  const [didSetDefaultScope, setDidSetDefaultScope] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<number | null>(null);

  const loadBoardData = useCallback(async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const depts = await api.getDepartments(currentCompany.id);
      const result = await api.getTasksData();
      setDepartments(depts);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  useEffect(() => {
    setScope('MY');
    setDidSetDefaultScope(false);
  }, [currentUser?.id, currentCompany?.id]);

  const getDepartmentRole = useCallback((departmentId?: number) => {
    if (!departmentId || !currentUser || !data?.department_members) return null;
    return data.department_members.find((member: any) => (
      member.department_id === departmentId &&
      member.user_id === currentUser.id
    ))?.role ?? null;
  }, [currentUser, data]);

  const managedDepartmentIds = useMemo(() => {
    if (!currentUser || !data?.department_members) return [];
    const companyDeptIds = new Set(departments.map((dept) => dept.id));
    return data.department_members
      .filter((member: any) => (
        member.user_id === currentUser.id &&
        companyDeptIds.has(member.department_id) &&
        canManageTasks(member.role)
      ))
      .map((member: any) => member.department_id);
  }, [currentUser, data, departments]);

  useEffect(() => {
    if (didSetDefaultScope || loading) return;
    if (managedDepartmentIds.length > 0) {
      setScope('MANAGED');
    }
    setDidSetDefaultScope(true);
  }, [didSetDefaultScope, loading, managedDepartmentIds]);

  const filteredTasks = useMemo(() => {
    if (!data || !currentCompany) return [];
    const companyDeptIds = departments.map((dept) => dept.id);
    const companyDocIds = data.documents
      .filter((doc: any) => companyDeptIds.includes(doc.department_id) && doc.status !== 'APPROVED')
      .map((doc: any) => doc.id);
    let tasks = data.tasks.filter((task: any) => companyDocIds.includes(task.document_id));

    if (scope === 'MY' && currentUser) {
      const myTaskIds = data.task_assignees
        .filter((assignee: any) => assignee.user_id === currentUser.id)
        .map((assignee: any) => assignee.task_id);
      tasks = tasks.filter((task: any) => myTaskIds.includes(task.id));
    } else if (scope === 'MANAGED') {
      const managedDocIds = data.documents
        .filter((doc: any) => managedDepartmentIds.includes(doc.department_id))
        .map((doc: any) => doc.id);
      tasks = tasks.filter((task: any) => managedDocIds.includes(task.document_id));
    } else if (scope !== 'ALL') {
      const deptId = Number(scope);
      const deptDocIds = data.documents
        .filter((doc: any) => doc.department_id === deptId)
        .map((doc: any) => doc.id);
      tasks = tasks.filter((task: any) => deptDocIds.includes(task.document_id));
    }

    return tasks;
  }, [currentCompany, currentUser, data, departments, managedDepartmentIds, scope]);

  const calendarTasks = [...filteredTasks].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const handleApproveTask = async (event: MouseEvent, task: any) => {
    event.stopPropagation();
    if (!currentUser) return;

    setProcessingTaskId(task.id);
    try {
      await api.approveTask(task.id, currentUser.id);
      await loadBoardData();
    } catch (e: any) {
      alert(e.message || 'Task 승인에 실패했습니다.');
    } finally {
      setProcessingTaskId(null);
    }
  };

  const handleRejectTask = async (event: MouseEvent, task: any) => {
    event.stopPropagation();
    if (!currentUser) return;

    const reason = window.prompt('반려 사유를 입력하세요.', '반려');
    if (reason === null) return;

    setProcessingTaskId(task.id);
    try {
      await api.rejectTask(task.id, currentUser.id, reason);
      await loadBoardData();
    } catch (e: any) {
      alert(e.message || 'Task 반려에 실패했습니다.');
    } finally {
      setProcessingTaskId(null);
    }
  };

  const handleRequestTaskApproval = async (event: MouseEvent, task: any) => {
    event.stopPropagation();

    setProcessingTaskId(task.id);
    try {
      await api.updateTaskStatus(task.id, 'DONE');
      await loadBoardData();
    } catch (e: any) {
      alert(e.message || '승인 요청에 실패했습니다.');
    } finally {
      setProcessingTaskId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>업무 보드를 불러오는 중...</div>;
  }

  if (!data || !currentCompany) {
    return <div className="empty-state">회사 또는 업무 데이터를 불러올 수 없습니다.</div>;
  }

  const renderTaskCard = (task: any) => {
    const doc = data.documents.find((item: any) => item.id === task.document_id);
    const dept = departments.find((item) => item.id === doc?.department_id);
    const departmentRole = getDepartmentRole(doc?.department_id);
    const assigneeIds = data.task_assignees
      .filter((assignee: any) => assignee.task_id === task.id)
      .map((assignee: any) => assignee.user_id);
    const isAssignee = currentUser ? assigneeIds.includes(currentUser.id) : false;
    const canReview = canReviewTask({
      documentStatus: doc?.status,
      departmentRole,
    });
    const canRequestApproval = isAssignee && !canReview && task.status === 'DOING' && doc?.status === 'WORKING';
    const canApprove = canReview && task.status === 'DONE' && task.review_status !== 'APPROVED';
    const canReject = canReview && task.status === 'DONE' && task.review_status !== 'APPROVED';
    const locked = task.status === 'DONE' || doc?.status === 'PENDING' || doc?.status === 'APPROVED';
    const busy = processingTaskId === task.id;
    const reviewLabel = getTaskReviewLabel(task);
    const pendingReviewLabel = getPendingReviewLabel(task, canReview);

    return (
      <div
        key={task.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/edit-task/${task.id}`)}
        onKeyDown={(event) => {
          if (event.currentTarget !== event.target) return;
          if (event.key === 'Enter' || event.key === ' ') navigate(`/edit-task/${task.id}`);
        }}
        className="task-card"
        style={{
          textAlign: 'left',
          borderColor: locked ? '#cbd5e1' : 'var(--border-color)',
          opacity: locked ? 0.86 : 1,
          minHeight: '148px'
        }}
        title={locked ? '잠금된 Task입니다. 클릭하면 읽기 전용으로 확인합니다.' : 'Task 편집 화면으로 이동합니다.'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>{dept?.name ?? '부서 없음'}</span>
          {locked && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>잠금</span>}
        </div>
        <div className="task-title">{task.title}</div>
        <div className="task-doc-title">{doc?.title}</div>
        {task.rejection_reason && task.status === 'DOING' && (
          <div className="task-reject-reason">
            반려 사유: {task.rejection_reason}
          </div>
        )}
        {reviewLabel && (
          <span className={`task-review-badge ${task.review_status === 'APPROVED' ? 'approved' : 'requested'}`}>
            {reviewLabel}
          </span>
        )}
        {pendingReviewLabel && (
          <span className="task-review-badge waiting">
            {pendingReviewLabel}
          </span>
        )}
        <div className="task-footer">
          <span className="due-date">{new Date(task.due_date).toLocaleDateString('ko-KR')}</span>
          <div className="task-actions">
            {canRequestApproval && (
              <ApiHint hint={apiHints.updateTaskStatus}>
                <button
                  type="button"
                  onClick={(event) => handleRequestTaskApproval(event, task)}
                  disabled={busy}
                  style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  승인 요청
                </button>
              </ApiHint>
            )}
            {canApprove && (
              <ApiHint hint={apiHints.approveTask}>
                <button
                  type="button"
                  onClick={(event) => handleApproveTask(event, task)}
                  disabled={busy}
                  style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #16a34a', background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  승인
                </button>
              </ApiHint>
            )}
            {canReject && (
              <ApiHint hint={apiHints.rejectTask}>
                <button
                  type="button"
                  onClick={(event) => handleRejectTask(event, task)}
                  disabled={busy}
                  style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: '11px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  반려
                </button>
              </ApiHint>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '18px', padding: '20px', height: '100%', minWidth: 0, overflow: 'hidden' }}>
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Task 칸반 보드</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            부서장은 관리 중인 부서 Task를 검토하고, 개인 담당 업무는 별도로 확인할 수 있습니다.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
          {managedDepartmentIds.length > 0 && (
            <button
              type="button"
              onClick={() => setScope('MANAGED')}
              className={scope === 'MANAGED' ? 'btn-primary' : ''}
              style={{ padding: '8px 12px', borderRadius: '8px', border: scope === 'MANAGED' ? 'none' : '1px solid var(--border-color)', background: scope === 'MANAGED' ? undefined : 'var(--bg-card)', fontWeight: 700 }}
            >
              관리 Task
            </button>
          )}
          <button
            type="button"
            onClick={() => setScope('MY')}
            className={scope === 'MY' ? 'btn-primary' : ''}
            style={{ padding: '8px 12px', borderRadius: '8px', border: scope === 'MY' ? 'none' : '1px solid var(--border-color)', background: scope === 'MY' ? undefined : 'var(--bg-card)', fontWeight: 700 }}
          >
            내 담당 Task
          </button>
          <button
            type="button"
            onClick={() => setScope('ALL')}
            className={scope === 'ALL' ? 'btn-primary' : ''}
            style={{ padding: '8px 12px', borderRadius: '8px', border: scope === 'ALL' ? 'none' : '1px solid var(--border-color)', background: scope === 'ALL' ? undefined : 'var(--bg-card)', fontWeight: 700 }}
          >
            전체
          </button>
          <select
            value={scope === 'MY' || scope === 'ALL' || scope === 'MANAGED' ? '' : scope}
            onChange={(event) => setScope(event.target.value || 'ALL')}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 700 }}
          >
            <option value="">부서 선택</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) clamp(220px, 22vw, 300px)', gap: '18px', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          {columns.map((status) => {
            const tasks = filteredTasks.filter((task: any) => task.status === status);
            return (
              <section key={status} className={`kanban-column task-column-${status}`} style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="column-title">
                  <span>{getTaskStatusLabel(status)} ({status})</span>
                  <span className="column-count">{tasks.length}</span>
                </div>
                <div className="task-card-list">
                  {tasks.map(renderTaskCard)}
                  {tasks.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '32px 8px' }}>
                      표시할 Task가 없습니다.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="card" style={{ minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>마감 캘린더</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            {calendarTasks.map((task: any) => {
              const doc = data.documents.find((item: any) => item.id === task.document_id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/edit-task/${task.id}`)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>{new Date(task.due_date).toLocaleDateString('ko-KR')}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>{task.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflowWrap: 'anywhere', wordBreak: 'keep-all', lineHeight: 1.35 }}>{doc?.title}</div>
                </button>
              );
            })}
            {calendarTasks.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>예정된 마감이 없습니다.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
