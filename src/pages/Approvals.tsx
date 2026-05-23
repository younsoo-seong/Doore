import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getDocumentStatusLabel } from '../utils/permissions';

export default function Approvals() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);

  const loadApprovals = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const result = await api.getApprovalDocuments(currentUser.id);
      setData(result);
      setSelectedDocId((prev) => prev ?? result.documents[0]?.id ?? null);
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

  const handleApprove = async () => {
    if (!selectedDoc || !currentUser) return;
    await api.approveDocument(selectedDoc.id, currentUser.id);
    await loadApprovals();
  };

  const handleReject = async () => {
    if (!selectedDoc || !currentUser) return;
    await api.rejectDocument(selectedDoc.id, currentUser.id, rejectReason.trim());
    setRejectReason('');
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
        <h3>결재 대기 문서가 없습니다</h3>
        <p>부서장이 모든 Task를 완료하고 승인 요청하면 이 화면에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '20px', padding: '20px', height: '100%' }}>
      <aside className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '4px' }}>결재 문서함</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>조직장은 PENDING 문서를 승인하거나 반려합니다.</p>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {data.documents.map((doc: any) => {
            const department = data.departments.find((dept: any) => dept.id === doc.department_id);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>{department?.name}</span>
                  <span className={`doc-status ${doc.status}`}>{getDocumentStatusLabel(doc.status)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedDoc && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
          <div className="card" style={{ gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800, marginBottom: '4px' }}>통합 문서 미리보기</div>
                <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>{selectedDoc.title}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  모든 Task가 완료되면 문서가 통합되고 승인 전까지 읽기 전용으로 잠깁니다.
                </p>
              </div>
              <span className={`doc-status ${selectedDoc.status}`} style={{ padding: '6px 12px' }}>
                {getDocumentStatusLabel(selectedDoc.status)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {['TODO', 'DOING', 'DONE'].map((status) => (
                <div key={status} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800 }}>{status}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>{docTasks.filter((task: any) => task.status === status).length}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>통합 본문</h3>
            <div style={{ overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', background: 'white', flexGrow: 1 }}>
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

          <div className="card" style={{ gap: '12px' }}>
            {selectedDoc.status === 'PENDING' ? (
              <>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력하면 부서장에게 알림으로 전달됩니다."
                  style={{ width: '100%', minHeight: '64px', resize: 'vertical', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', fontFamily: 'var(--font-sans)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={handleReject} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', fontWeight: 800 }}>
                    반려하고 재작업으로 전환
                  </button>
                  <button type="button" onClick={handleApprove} className="btn-primary" style={{ padding: '10px 16px' }}>
                    승인 완료
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  승인 완료 문서는 최종 산출물로 추출할 수 있습니다. 반려 문서는 문서함에서 다시 작업합니다.
                </div>
                {selectedDoc.status === 'APPROVED' && (
                  <button type="button" onClick={handleExport} className="btn-primary" style={{ padding: '10px 16px' }}>
                    문서 추출
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
