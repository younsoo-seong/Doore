import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import MemberSelector from '../components/MemberSelector';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';

export default function Settings() {
  const { currentUser, currentCompany, setCurrentCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'members'>('general');
  
  // General Tab State
  const [companyName, setCompanyName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Members Tab State
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Inviting / Selector State
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState<number[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      setCompanyName(currentCompany.name);
      fetchMembersAndCandidates();
    }
  }, [currentCompany, activeTab]);

  const fetchMembersAndCandidates = async () => {
    if (!currentCompany) return;
    setLoadingMembers(true);
    try {
      // 1. Load current company members
      const currentMembers = await api.getCompanyMembers(currentCompany.id);
      setMembers(currentMembers);
      
      // 2. Load all system users to filter out existing members
      const allUsers = await api.getAllUsers();
      const currentMemberIds = currentMembers.map((m: any) => m.id);
      const inviteCandidates = allUsers.filter((u: any) => !currentMemberIds.includes(u.id));
      setCandidates(inviteCandidates);
      
      setSelectedInviteIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !companyName.trim()) return;
    setIsUpdating(true);
    try {
      const updated = await api.updateCompany(currentCompany.id, companyName);
      if (updated) setCurrentCompany(updated);
      alert('회사 정보가 수정되었습니다.');
    } catch (e) {
      alert('수정 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInviteMembers = async () => {
    if (!currentCompany || selectedInviteIds.length === 0) return;
    setIsInviting(true);
    try {
      for (const userId of selectedInviteIds) {
        const target = candidates.find(c => c.id === userId);
        if (target) {
          await api.addCompanyMember(currentCompany.id, target.email);
        }
      }
      alert(`${selectedInviteIds.length}명의 새 멤버가 회사에 추가되었습니다.`);
      await fetchMembersAndCandidates();
    } catch (e: any) {
      alert(e.message || '초대 중 오류가 발생했습니다.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'OWNER' | 'MEMBER') => {
    if (!currentCompany) return;
    try {
      await api.updateMemberRole(currentCompany.id, userId, newRole);
      fetchMembersAndCandidates();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDepartmentRoleChange = async (departmentId: number, userId: number, role: 'LEADER' | 'TASK_MANAGER' | 'MEMBER') => {
    try {
      await api.updateDepartmentMemberRole(departmentId, userId, role);
      await fetchMembersAndCandidates();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!currentCompany) return;
    if (currentUser?.id === userId) {
      alert('자기 자신을 삭제할 수 없습니다.');
      return;
    }
    if (confirm('정말 이 멤버를 회사에서 추방하시겠습니까?')) {
      try {
        await api.removeMember(currentCompany.id, userId);
        fetchMembersAndCandidates();
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!currentCompany) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"></div>
        <h3>선택된 회사가 없습니다</h3>
        <p>좌측 상단에서 회사를 선택하거나 새로 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', paddingTop: '20px' }}>
      <h2 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>회사 설정</h2>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Settings Navigation */}
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('general')}
            style={{ padding: '10px 16px', textAlign: 'left', background: activeTab === 'general' ? 'var(--bg-card)' : 'transparent', border: activeTab === 'general' ? '1px solid var(--border-color)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === 'general' ? '600' : '400', color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-primary)' }}
          >
            일반 설정
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            style={{ padding: '10px 16px', textAlign: 'left', background: activeTab === 'members' ? 'var(--bg-card)' : 'transparent', border: activeTab === 'members' ? '1px solid var(--border-color)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === 'members' ? '600' : '400', color: activeTab === 'members' ? 'var(--primary)' : 'var(--text-primary)' }}
          >
            멤버 관리
          </button>
        </div>

        {/* Settings Content */}
        <div className="card" style={{ flexGrow: 1 }}>
          {activeTab === 'general' && (
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>회사 일반 설정</h3>
              <form onSubmit={handleUpdateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>회사 이름</label>
                  <input 
                    type="text" 
                    value={companyName} 
                    onChange={e => setCompanyName(e.target.value)} 
                    placeholder="회사 이름을 입력하세요"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }} disabled={isUpdating}>
                  {isUpdating ? '저장 중...' : '변경 사항 저장'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>멤버 관리</h3>
              
              {/* Member Invite Section using standard searchable MemberSelector */}
              <div style={{ marginBottom: '24px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-secondary)' }}>새 멤버 추가</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  시스템 사용자 전체 리스트에서 초대할 멤버를 선택하여 일괄 추가합니다.
                </p>
                <MemberSelector 
                  candidates={candidates}
                  selectedIds={selectedInviteIds}
                  onSelect={(id) => setSelectedInviteIds(prev => [...prev, id])}
                  onDeselect={(id) => setSelectedInviteIds(prev => prev.filter(x => x !== id))}
                  placeholder="이름 또는 이메일로 멤버 검색..."
                />
                <ApiHint hint={apiHints.inviteCompanyMember} align="left" fullWidth>
                  <button
                    onClick={handleInviteMembers}
                    disabled={selectedInviteIds.length === 0 || isInviting}
                    className="btn-primary"
                    style={{ width: '100%', padding: '10px', marginTop: '12px', fontSize: '13px' }}
                  >
                    {isInviting ? '멤버 추가 중...' : `선택된 ${selectedInviteIds.length}명 회사 멤버로 추가`}
                  </button>
                </ApiHint>
              </div>

              {loadingMembers ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>멤버 목록 불러오는 중...</div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto' }}>
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>이메일</th>
                        <th>소속 부서 (부서 직급)</th>
                        <th>회사 권한</th>
                        <th style={{ textAlign: 'right' }}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(member => (
                        <tr key={member.id}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{member.name.charAt(0)}</div>
                              {member.name}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{member.email}</td>
                          <td style={{ fontSize: '13px' }}>
                            {member.departments.map((dept: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: idx < member.departments.length - 1 ? '6px' : '0' }}>
                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{dept.name}</span>
                                {dept.role && dept.id ? (
                                  <ApiHint hint={apiHints.updateDepartmentRole}>
                                    <select
                                      value={dept.role}
                                      onChange={(e) => handleDepartmentRoleChange(dept.id, member.id, e.target.value as 'LEADER' | 'TASK_MANAGER' | 'MEMBER')}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                      background: dept.role === 'LEADER' || dept.role === 'TASK_MANAGER' ? '#eff6ff' : '#f8fafc',
                                      color: dept.role === 'LEADER' || dept.role === 'TASK_MANAGER' ? '#1d4ed8' : '#475569'
                                      }}
                                    >
                                      <option value="MEMBER">부서원</option>
                                      <option value="LEADER">부서장</option>
                                    </select>
                                  </ApiHint>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>부서 미배치</span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td>
                            <ApiHint hint={apiHints.updateCompanyRole}>
                              <select
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.id, e.target.value as 'OWNER' | 'MEMBER')}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                disabled={member.id === currentUser?.id}
                              >
                                <option value="OWNER">조직장</option>
                                <option value="MEMBER">일반 멤버</option>
                              </select>
                            </ApiHint>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={member.id === currentUser?.id}
                              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: member.id === currentUser?.id ? 'not-allowed' : 'pointer', opacity: member.id === currentUser?.id ? 0.5 : 1 }}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
