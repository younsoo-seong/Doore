import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getDocumentStatusLabel, getTaskStatusLabel } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

export default function Approvals() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadApprovals = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const result = await api.getApprovalDocuments(currentUser.id);
      setData(result);
      setSelectedDocId((prev) => (
        result.documents.some((doc: any) => doc.id === prev)
          ? prev
          : result.documents[0]?.id ?? null
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [currentUser]);

  const selectedDoc = useMemo(
    () => data?.documents.find((doc: any) => doc.id === selectedDocId),
    [data, selectedDocId],
  );

  const docTasks = useMemo(
    () => data && selectedDoc ? data.tasks.filter((task: any) => task.document_id === selectedDoc.id) : [],
    [data, selectedDoc],
  );

  const selectedDepartment = useMemo(
    () => data && selectedDoc ? data.departments.find((dept: any) => dept.id === selectedDoc.department_id) : null,
    [data, selectedDoc],
  );

  const selectedAuthor = useMemo(
    () => data && selectedDoc ? data.users.find((user: any) => user.id === selectedDoc.created_by) : null,
    [data, selectedDoc],
  );

  const taskStats = useMemo(() => ({
    TODO: docTasks.filter((task: any) => task.status === 'TODO').length,
    DOING: docTasks.filter((task: any) => task.status === 'DOING').length,
    DONE: docTasks.filter((task: any) => task.status === 'DONE').length,
  }), [docTasks]);

  const handleApprove = async () => {
    if (!selectedDoc || !currentUser) return;
    await api.approveDocument(selectedDoc.id, currentUser.id);
    await loadApprovals();
  };

  const handleExport = () => {
    if (!selectedDoc) return;
    const content = [
      `# ${selectedDoc.title}`,
      '',
      selectedDoc.content || docTasks.map((task: any) => `## ${task.title}\n${task.content}`).join('\n\n'),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedDoc.title}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>결재 문서를 불러오는 중...</div>;
  }

  if (!data || data.documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">승인</div>
        <h3>결재할 문서가 없습니다</h3>
        <p>지정 결재자로 배정된 승인 대기 문서만 이 화면에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '18px', padding: '20px', height: '100%' }}>
      <aside className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '4px' }}>결재 문서함</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>통합 완료 문서를 검토하고 승인합니다.</p>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {data.documents.map((doc: any) => {
            const department = data.departments.find((dept: any) => dept.id === doc.department_id);
            const docTaskCount = data.tasks.filter((task: any) => task.document_id === doc.id).length;
            const selected = doc.id === selectedDocId;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderBottom: '1px solid var(--border-color)',
                  background: selected ? 'var(--primary-light)' : 'var(--bg-card)',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{doc.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                  <span>{department?.name}</span>
                  <span className={`doc-status ${doc.status}`}>{getDocumentStatusLabel(doc.status)}</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Task {docTaskCount}개 · {new Date(doc.updated_at).toLocaleDateString('ko-KR')}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedDoc && (
        <section style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '14px', minHeight: 0 }}>
          <div className="card" style={{ gap: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800, marginBottom: '4px' }}>통합 문서 검토</div>
                <h2 style={{ fontSize: '22px', marginBottom: '8px', lineHeight: 1.25 }}>{selectedDoc.title}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>부서: {selectedDepartment?.name ?? '-'}</span>
                  <span>작성자: {selectedAuthor?.name ?? '-'}</span>
                  <span>수정일: {new Date(selectedDoc.updated_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className={`doc-status ${selectedDoc.status}`} style={{ padding: '6px 12px' }}>
                  {getDocumentStatusLabel(selectedDoc.status)}
                </span>
                {selectedDoc.status === 'PENDING' ? (
                  <ApiHint hint={apiHints.approveDocument}>
                    <button type="button" onClick={handleApprove} className="btn-primary" style={{ padding: '9px 16px' }}>
                      승인 완료
                    </button>
                  </ApiHint>
                ) : selectedDoc.status === 'APPROVED' ? (
                  <button type="button" onClick={handleExport} className="btn-primary" style={{ padding: '9px 16px' }}>
                    문서 추출
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800 }}>전체 Task</div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{docTasks.length}</div>
              </div>
              {(['TODO', 'DOING', 'DONE'] as const).map((status) => (
                <div key={status} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800 }}>{getTaskStatusLabel(status)}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>{taskStats[status]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '14px', minHeight: 0 }}>
            <div className="card" style={{ minHeight: 0, overflow: 'hidden', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px' }}>통합 본문</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>읽기 전용</span>
              </div>
              <div style={{ overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '18px', background: 'white', flexGrow: 1 }}>
                {selectedDoc.content ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7 }}>{selectedDoc.content}</pre>
                ) : (
                  docTasks.map((task: any) => (
                    <article key={task.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '14px' }}>
                      <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>{task.title}</h4>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{task.content || '작성된 내용이 없습니다.'}</p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <aside className="card" style={{ minHeight: 0, overflow: 'hidden', padding: '18px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Task 검토</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                {docTasks.map((task: any, index: number) => (
                  <div key={task.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-app)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', lineHeight: 1.35 }}>{index + 1}. {task.title}</strong>
                      <span className={`doc-status ${task.status === 'DONE' ? 'APPROVED' : task.status === 'DOING' ? 'PENDING' : 'WORKING'}`}>
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {task.content || '작성된 내용이 없습니다.'}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
