import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getTaskStatusLabel } from '../utils/permissions';

const columns = ['TODO', 'DOING', 'DONE'] as const;

const getTaskReviewLabel = (task: any) => {
  if (task.status !== 'DONE') return null;
  if (task.review_status === 'APPROVED') return '승인 완료';
  return '승인 요청 중';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentCompany, currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentCompany || !currentUser) {
        setData(null);
        setLoading(false);
        return;
      }
      try {
        const result = await api.getDashboardData(currentCompany.id, currentUser.id);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentCompany, currentUser]);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="typing-indicator" style={{fontSize: '24px'}}>데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (!data) return null;

  const activeTasks = data.tasks.filter((task: any) => {
    const doc = data.documents.find((item: any) => item.id === task.document_id);
    return doc?.status !== 'APPROVED';
  });

  const getDueLabel = (task: any) => (
    task.status === 'DONE'
      ? '마감됨'
      : new Date(task.due_date).toLocaleDateString('ko-KR')
  );

  const renderTaskCard = (task: any) => {
    const doc = data.documents.find((item: any) => item.id === task.document_id);
    const reviewLabel = getTaskReviewLabel(task);

    return (
      <div key={task.id} className="task-card" onClick={() => navigate('/tasks')}>
        <div className="task-title">{task.title}</div>
        <div className="task-doc-title">{doc?.title}</div>
        {reviewLabel && (
          <span className={`task-review-badge ${task.review_status === 'APPROVED' ? 'approved' : 'requested'}`}>
            {reviewLabel}
          </span>
        )}
        <div className="task-footer">
          <span className="due-date">{getDueLabel(task)}</span>
          <div className="assignees">
            {data.task_assignees.filter((a: any) => a.task_id === task.id).map((assignee: any) => {
              const user = data.users.find((u: any) => u.id === assignee.user_id);
              return user ? <div key={user.id} className="assignee-avatar" title={user.name}>{user.name.charAt(0)}</div> : null;
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-grid">
      {/* Kanban Board */}
      <div className="card kanban-section">
        <div className="card-header">
          <span>내 TASK 현황</span>
        </div>
        <div className="kanban-board">
          {columns.map((status) => {
            const tasks = activeTasks.filter((task: any) => task.status === status);
            return (
              <div key={status} className={`kanban-column task-column-${status}`}>
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Widgets Sidebar */}
      <div className="widgets-column">
        {/* Updates */}
        <div className="card">
          <div className="card-header">
            <span>최근 업데이트</span>
          </div>
          <div className="updates-list">
            {data.notifications.map((notif: any) => (
              <div key={notif.id} className="update-item">
                <div className="update-icon"></div>
                <div className="update-content">
                  <div className="update-message">{notif.message}</div>
                  <div className="update-time">{new Date(notif.created_at).toLocaleString('ko-KR')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members */}
        <div className="card">
        <div className="card-header">
          <span>{data.departments[0]?.name ? `${data.departments[0].name} 부서원` : '부서원'}</span>
        </div>
        <div className="members-list">
            {data.department_members.map((dm: any) => {
              const user = data.users.find((u: any) => u.id === dm.user_id);
              if (!user) return null;
              return (
                <div key={user.id} className="member-item">
                  <div className="avatar">{user.name.charAt(0)}</div>
                  <div className="member-info">
                    <div className="member-name">{user.name}</div>
                    <div className="member-role">{dm.role === 'LEADER' ? '부서장' : '부서원'}</div>
                  </div>
                  <div className={`status-dot ${dm.role === 'LEADER' ? 'online' : (user.id % 2 === 0 ? 'online' : 'offline')}`}></div>
                </div>
              );
            })}
            {data.department_members.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                아직 생성된 부서나 배치된 부서원이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
