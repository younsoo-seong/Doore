import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Tasks() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL'); // 'ALL' or department ID as string
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBoardData() {
      if (!currentCompany) return;
      try {
        // 1. Fetch departments
        const depts = await api.getDepartments(currentCompany.id);
        setDepartments(depts);
        
        // 2. Fetch tasks data
        const result = await api.getTasksData();
        setData(result);
      } catch (error) {
        console.error("Failed to load task board", error);
      } finally {
        setLoading(false);
      }
    }
    loadBoardData();
  }, [currentCompany]);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '18px' }}>업무 보드 로딩 중...</div>
      </div>
    );
  }

  if (!data || !currentCompany) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        회사가 지정되지 않았거나 작업 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  // Filter logic based on department switcher
  let filteredTasks = data.tasks;

  if (selectedDeptId !== 'ALL') {
    const targetDeptId = parseInt(selectedDeptId, 10);
    // Find documents belonging to the selected department
    const targetDocIds = data.documents
      .filter((d: any) => d.department_id === targetDeptId)
      .map((d: any) => d.id);
    
    // Filter tasks belonging to those documents
    filteredTasks = data.tasks.filter((t: any) => targetDocIds.includes(t.document_id));
  } else {
    // If 'ALL' is selected, show only tasks belonging to this company's departments
    const companyDeptIds = departments.map((d: any) => d.id);
    const targetDocIds = data.documents
      .filter((d: any) => companyDeptIds.includes(d.department_id))
      .map((d: any) => d.id);
    
    filteredTasks = data.tasks.filter((t: any) => targetDocIds.includes(t.document_id));
  }

  // Split filtered tasks into columns
  const todoTasks = filteredTasks.filter((t: any) => t.status === 'TODO');
  const doingTasks = filteredTasks.filter((t: any) => t.status === 'DOING');
  const doneTasks = filteredTasks.filter((t: any) => t.status === 'DONE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', padding: '20px' }}>
      
      {/* 1. Premium Filter Toolbar Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-card)', 
        padding: '16px 24px', 
        borderRadius: '12px', 
        border: '1px solid var(--border-color)',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>📋 업무 칸반 대시보드</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>회사의 진행 중인 모든 업무 태스크 카드를 모니터링하고 클릭하여 수정하세요.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>🏢 부서 필터:</span>
          <select 
            value={selectedDeptId} 
            onChange={(e) => setSelectedDeptId(e.target.value)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              fontSize: '13px', 
              fontWeight: '600',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">🏢 모든 부서 전체 보기</option>
            {departments.map((dept: any) => (
              <option key={dept.id} value={dept.id.toString()}>📁 {dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Three-column Kanban Board Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', flexGrow: 1, minHeight: 0 }}>
        
        {/* TODO Column */}
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '16px',
          minHeight: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #64748b', paddingBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#64748b' }}>할 일 (TODO)</span>
            <span style={{ fontSize: '11px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', color: '#475569' }}>{todoTasks.length}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
            {todoTasks.map((t: any) => {
              const doc = data.documents.find((d: any) => d.id === t.document_id);
              const dept = departments.find((d: any) => d.id === doc?.department_id);
              return (
                <div 
                  key={t.id} 
                  onClick={() => navigate(`/edit-task/${t.id}`)}
                  className="kanban-card"
                  style={{ 
                    padding: '14px', 
                    backgroundColor: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>
                    {dept ? dept.name : '기본 부서'}
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{t.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📄 {doc ? doc.title : '연결된 문서'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>수정하기 📝</span>
                  </div>
                </div>
              );
            })}
            {todoTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>할 일이 비어 있습니다.</div>
            )}
          </div>
        </div>

        {/* DOING Column */}
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '16px',
          minHeight: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #d97706', paddingBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>진행 중 (DOING)</span>
            <span style={{ fontSize: '11px', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', color: '#b45309' }}>{doingTasks.length}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
            {doingTasks.map((t: any) => {
              const doc = data.documents.find((d: any) => d.id === t.document_id);
              const dept = departments.find((d: any) => d.id === doc?.department_id);
              return (
                <div 
                  key={t.id} 
                  onClick={() => navigate(`/edit-task/${t.id}`)}
                  className="kanban-card"
                  style={{ 
                    padding: '14px', 
                    backgroundColor: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>
                    {dept ? dept.name : '기본 부서'}
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{t.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📄 {doc ? doc.title : '연결된 문서'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>수정하기 📝</span>
                  </div>
                </div>
              );
            })}
            {doingTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>진행 중인 업무가 없습니다.</div>
            )}
          </div>
        </div>

        {/* DONE Column */}
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '16px',
          minHeight: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #059669', paddingBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>완료됨 (DONE)</span>
            <span style={{ fontSize: '11px', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', color: '#15803d' }}>{doneTasks.length}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
            {doneTasks.map((t: any) => {
              const doc = data.documents.find((d: any) => d.id === t.document_id);
              const dept = departments.find((d: any) => d.id === doc?.department_id);
              return (
                <div 
                  key={t.id} 
                  onClick={() => navigate(`/edit-task/${t.id}`)}
                  className="kanban-card"
                  style={{ 
                    padding: '14px', 
                    backgroundColor: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>
                    {dept ? dept.name : '기본 부서'}
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)', textDecoration: 'line-through', opacity: 0.7 }}>{t.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📄 {doc ? doc.title : '연결된 문서'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>조회/수정 📝</span>
                  </div>
                </div>
              );
            })}
            {doneTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>완료된 업무가 없습니다.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
