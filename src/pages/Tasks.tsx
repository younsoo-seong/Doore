import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { canReviewTask, getTaskStatusLabel } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

const columns = ['TODO', 'DOING', 'DONE'] as const;

export default function Tasks() {
  const navigate = useNavigate();
  const { currentUser, currentCompany } = useAuth();
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [scope, setScope] = useState('MY');
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

  const getDepartmentRole = useCallback((departmentId?: number) => {
    if (!departmentId || !currentUser || !data?.department_members) return null;
    return data.department_members.find((member: any) => (
      member.department_id === departmentId &&
      member.user_id === currentUser.id
    ))?.role ?? null;
  }, [currentUser, data]);

  const filteredTasks = useMemo(() => {
    if (!data || !currentCompany) return [];
    const companyDeptIds = departments.map((dept) => dept.id);
    const companyDocIds = data.documents
      .filter((doc: any) => companyDeptIds.includes(doc.department_id))
      .map((doc: any) => doc.id);
    let tasks = data.tasks.filter((task: any) => companyDocIds.includes(task.document_id));

    if (scope === 'MY' && currentUser) {
      const myTaskIds = data.task_assignees
        .filter((assignee: any) => assignee.user_id === currentUser.id)
        .map((assignee: any) => assignee.task_id);
      tasks = tasks.filter((task: any) => myTaskIds.includes(task.id));
    } else if (scope !== 'ALL') {
      const deptId = Number(scope);
      const deptDocIds = data.documents
        .filter((doc: any) => doc.department_id === deptId)
        .map((doc: any) => doc.id);
      tasks = tasks.filter((task: any) => deptDocIds.includes(task.document_id));
    }

    return tasks;
  }, [currentCompany, currentUser, data, departments, scope]);

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

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>업무 보드를 불러오는 중...</div>;
  }

  if (!data || !currentCompany) {
    return <div className="empty-state">회사 또는 업무 데이터를 불러올 수 없습니다.</div>;
  }

  const renderTaskCard = (task: any) => {
    const doc = data.documents.find((item: any) => item.id === task.document_id);
    const dept = departments.find((item) => item.id === doc?.department_id);
    const assigneeIds = data.task_assignees.filter((item: any) => item.task_id === task.id).map((item: any) => item.user_id);
    const departmentRole = getDepartmentRole(doc?.department_id);
    const canReview = canReviewTask({
      documentStatus: doc?.status,
      currentUserId: currentUser?.id,
      assigneeIds,
      departmentRole,
    });
    const canApprove = canReview && task.status !== 'DONE';
    const canReject = canReview && task.status === 'DONE';
    const locked = task.status === 'DONE' || doc?.status === 'PENDING' || doc?.status === 'APPROVED';
    const busy = processingTaskId === task.id;

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
          minHeight: '148px',
          width: '100%'
        }}
        title={locked ? '잠금된 Task입니다. 클릭하면 읽기 전용으로 확인합니다.' : 'Task 편집 화면으로 이동합니다.'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>{dept?.name ?? '부서 없음'}</span>
          {locked && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>잠금</span>}
        </div>
        <div className="task-title">{task.title}</div>
        <div className="task-doc-title">{doc?.title}</div>
        <div className="task-footer" style={{ alignItems: 'flex-end', gap: '8px' }}>
          <span className="due-date">{new Date(task.due_date).toLocaleDateString('ko-KR')}</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '18px', padding: '20px', height: '100%' }}>
      <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Task 칸반 보드</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            내 Task 카드에서 바로 승인하거나, 완료된 Task를 반려해 진행 중으로 되돌릴 수 있습니다.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setScope('MY')}
            className={scope === 'MY' ? 'btn-primary' : ''}
            style={{ padding: '8px 12px', borderRadius: '8px', border: scope === 'MY' ? 'none' : '1px solid var(--border-color)', background: scope === 'MY' ? undefined : 'var(--bg-card)', fontWeight: 700 }}
          >
            내 Task
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
            value={scope === 'MY' || scope === 'ALL' ? '' : scope}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '18px', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: '16px', minHeight: 0 }}>
          {columns.map((status) => {
            const tasks = filteredTasks.filter((task: any) => task.status === status);
            return (
              <section key={status} className="kanban-column" style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="column-title">
                  <span>{getTaskStatusLabel(status)} ({status})</span>
                  <span className="column-count">{tasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '2px' }}>
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

        <aside className="card" style={{ minHeight: 0, overflow: 'hidden' }}>
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
