import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import MemberSelector from '../components/MemberSelector';

export default function CreateCompany() {
  const navigate = useNavigate();
  const { currentUser, setCurrentCompany } = useAuth();
  const [companyName, setCompanyName] = useState('');
  
  // Member Selector State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await api.getAllUsers();
        // Remove current user from candidates since they are automatically the admin
        const candidates = currentUser ? users.filter((u: any) => u.id !== currentUser.id) : users;
        setAllUsers(candidates);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [currentUser]);

  const handleSelect = (id: number) => {
    setSelectedIds(prev => [...prev, id]);
  };

  const handleDeselect = (id: number) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !currentUser) return;
    setIsCreating(true);

    try {
      // 1. Create company
      const newCompany = await api.createCompany(currentUser.id, companyName.trim());
      
      // 2. Invite selected members
      for (const userId of selectedIds) {
        const targetUser = allUsers.find(u => u.id === userId);
        if (targetUser) {
          try {
            await api.addCompanyMember(newCompany.id, targetUser.email);
          } catch (inviteErr) {
            console.error(`Failed to invite ${targetUser.email}:`, inviteErr);
          }
        }
      }

      // 3. Set newly created company as active and navigate to dashboard
      setCurrentCompany(newCompany);
      alert(`'${companyName}' 회사가 개설되고 ${selectedIds.length}명의 초기 멤버가 배치되었습니다!`);
      navigate('/');
    } catch (err: any) {
      alert(err.message || '회사 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          ←
        </button>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => navigate('/')}>
          취소하고 돌아가기
        </span>
      </div>

      <div className="card" style={{ padding: '40px' }}>
        <h2 style={{ marginBottom: '8px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>새 회사 만들기</h2>
        <p style={{ marginBottom: '32px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          새로운 워크스페이스를 생성하고 동료들을 초대하여 실시간 협업을 시작해 보세요.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>사용자 리스트 불러오는 중...</div>
        ) : (
          <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Company Name */}
            <div className="form-group">
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>회사 이름</label>
              <input 
                type="text" 
                value={companyName} 
                onChange={e => setCompanyName(e.target.value)} 
                placeholder="예: 두레 테크, DOORE Corp" 
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px' }}
              />
            </div>

            {/* Add Members Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>초기 회사원 초대</label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                가입된 사용자 리스트에서 검색하여 초대할 멤버를 선택하세요.
              </p>
              
              <MemberSelector 
                candidates={allUsers}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
                placeholder="이름 또는 이메일 검색..."
              />
            </div>

            {/* Create Button */}
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isCreating || !companyName.trim()}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', marginTop: '12px' }}
            >
              {isCreating ? '회사 및 멤버 구성 생성 중...' : `회사 생성 및 ${selectedIds.length}명 초대 완료`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
