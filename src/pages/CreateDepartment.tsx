import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import MemberSelector from '../components/MemberSelector';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

export default function CreateDepartment() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  
  const [deptName, setDeptName] = useState('');
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<number, 'LEADER' | 'TASK_MANAGER' | 'MEMBER'>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      if (currentCompany) {
        try {
          const members = await api.getCompanyMembers(currentCompany.id);
          setCompanyMembers(members);
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    }
    loadMembers();
  }, [currentCompany]);

  const handleSelect = (userId: number) => {
    setSelectedIds(prev => [...prev, userId]);
    setMemberRoles(prev => ({ ...prev, [userId]: 'MEMBER' })); // Default role is MEMBER
  };

  const handleDeselect = (userId: number) => {
    setSelectedIds(prev => prev.filter(id => id !== userId));
    setMemberRoles(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !currentCompany) return;
    setIsCreating(true);

    try {
      // 1. Create department
      const newDept = await api.createDepartment(currentCompany.id, deptName.trim());
      
      // 2. Add selected members with their chosen roles to the department
      for (const userId of selectedIds) {
        try {
          const role = memberRoles[userId] || 'MEMBER';
          await api.addDepartmentMember(newDept.id, userId, role);
        } catch (err) {
          console.error(`Failed to add user ${userId} to department:`, err);
        }
      }

      alert(`'${deptName}' 부서가 개설되고 ${selectedIds.length}명의 부서원이 배정되었습니다.`);
      navigate('/docs');
    } catch (e: any) {
      alert(e.message || '부서 개설 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentCompany) {
    return (
      <div className="empty-state">
        <h3>선택된 회사가 없습니다.</h3>
        <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '12px' }}>대시보드로 가기</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          onClick={() => navigate('/docs')} 
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          ←
        </button>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => navigate('/docs')}>
          부서 문서함으로 돌아가기
        </span>
      </div>

      <div className="card" style={{ padding: '36px' }}>
        <h2 style={{ marginBottom: '8px', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>새 부서 개설</h2>
        <p style={{ marginBottom: '28px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          새로운 조직 부서를 생성하고 소속 부서원들을 일괄 배정할 수 있습니다.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>회사 멤버 정보를 불러오는 중...</div>
        ) : (
          <form onSubmit={handleCreateDept} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>부서 이름</label>
              <input 
                type="text" 
                value={deptName} 
                onChange={e => setDeptName(e.target.value)} 
                placeholder="예: 마케팅팀, 글로벌 개발 Unit" 
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>초기 부서원 배정</label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                부서에 배정할 우리 회사 소속 멤버를 검색하고 선택해 주세요.
              </p>
              
              <MemberSelector 
                candidates={companyMembers}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
                placeholder="회사원 검색..."
                renderExtraActions={(userId) => (
                  <select
                    value={memberRoles[userId] || 'MEMBER'}
                    onChange={(e) => setMemberRoles(prev => ({ ...prev, [userId]: e.target.value as 'LEADER' | 'TASK_MANAGER' | 'MEMBER' }))}
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
            </div>

            <ApiHint hint={apiHints.assignDepartmentMember} align="left" fullWidth>
              <button
                type="submit"
                className="btn-primary"
                disabled={isCreating || !deptName.trim()}
                style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '12px' }}
              >
                {isCreating ? '부서 개설 중...' : '부서 개설 및 배정 완료'}
              </button>
            </ApiHint>
          </form>
        )}
      </div>
    </div>
  );
}
