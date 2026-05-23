import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await api.getDashboardData();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="typing-indicator" style={{fontSize: '24px'}}>데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="dashboard-grid">
      {/* Kanban Board */}
      <div className="card kanban-section">
        <div className="card-header">
          <span>내 TASK 현황</span>
        </div>
        <div className="kanban-board">
          {/* TODO Column */}
          <div className="kanban-column">
            <div className="column-title">
              <span>TODO</span>
              <span className="column-count">{data.tasks.filter((t: any) => t.status === 'TODO').length}</span>
            </div>
            {data.tasks.filter((t: any) => t.status === 'TODO').map((task: any) => (
              <div key={task.id} className="task-card" onClick={() => navigate('/tasks')}>
                <div className="task-title">{task.title}</div>
                <div className="task-doc-title">{data.documents.find((d: any) => d.id === task.document_id)?.title}</div>
                <div className="task-footer">
                  <span className="due-date">D-3</span>
                  <div className="assignees">
                    {data.task_assignees.filter((a: any) => a.task_id === task.id).map((assignee: any) => {
                      const user = data.users.find((u: any) => u.id === assignee.user_id);
                      return user ? <div key={user.id} className="assignee-avatar" title={user.name}>{user.name.charAt(0)}</div> : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DOING Column */}
          <div className="kanban-column">
            <div className="column-title">
              <span>DOING</span>
              <span className="column-count">{data.tasks.filter((t: any) => t.status === 'DOING').length}</span>
            </div>
            {data.tasks.filter((t: any) => t.status === 'DOING').map((task: any) => (
              <div key={task.id} className="task-card" onClick={() => navigate('/tasks')}>
                <div className="task-title">{task.title}</div>
                <div className="task-doc-title">{data.documents.find((d: any) => d.id === task.document_id)?.title}</div>
                <div className="task-footer">
                  <span className="due-date">D-6</span>
                  <div className="assignees">
                    {data.task_assignees.filter((a: any) => a.task_id === task.id).map((assignee: any) => {
                      const user = data.users.find((u: any) => u.id === assignee.user_id);
                      return user ? <div key={user.id} className="assignee-avatar" title={user.name}>{user.name.charAt(0)}</div> : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DONE Column */}
          <div className="kanban-column">
            <div className="column-title">
              <span>DONE</span>
              <span className="column-count">{data.tasks.filter((t: any) => t.status === 'DONE').length}</span>
            </div>
            {data.tasks.filter((t: any) => t.status === 'DONE').map((task: any) => (
              <div key={task.id} className="task-card" onClick={() => navigate('/tasks')}>
                <div className="task-title">{task.title}</div>
                <div className="task-doc-title">{data.documents.find((d: any) => d.id === task.document_id)?.title}</div>
                <div className="task-footer">
                  <span className="due-date">마감됨</span>
                  <div className="assignees">
                    {data.task_assignees.filter((a: any) => a.task_id === task.id).map((assignee: any) => {
                      const user = data.users.find((u: any) => u.id === assignee.user_id);
                      return user ? <div key={user.id} className="assignee-avatar" title={user.name}>{user.name.charAt(0)}</div> : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            <span>개발 팀 부서원</span>
          </div>
          <div className="members-list">
            {data.department_members.filter((dm: any) => dm.department_id === 101).map((dm: any) => {
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
          </div>
        </div>
      </div>
    </div>
  );
}
