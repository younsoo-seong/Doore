import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import '../styles/Auth.css';

const demoAccounts = [
  { label: '조직장', email: 'admin@doore.com', description: '승인, 조직 관리' },
  { label: '부서장', email: 'leader@doore.com', description: '부서 배치, Task 분할' },
  { label: '부서원', email: 'member@doore.com', description: '내 Task 편집' },
];

export default function Login() {
  const [email, setEmail] = useState('admin@doore.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, setCurrentCompany } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await api.login(email, password);
      login(response.user, response.token);
      
      // Load user's companies and set the first one as active
      const userCompanies = await api.getCompanies(response.user.id);
      if (userCompanies.length > 0) {
        setCurrentCompany(userCompanies[0]);
      } else {
        setCurrentCompany(null);
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">DOORE</div>
          <h1 className="auth-title">로그인</h1>
          <p className="auth-subtitle">Task 기반 협업 그룹웨어에 오신 것을 환영합니다.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword('password');
              }}
              style={{
                border: email === account.email ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                background: email === account.email ? 'var(--primary-light)' : 'var(--bg-app)',
                color: email === account.email ? 'var(--primary)' : 'var(--text-primary)',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800 }}>{account.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{account.description}</div>
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>이메일</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="name@company.com"
              required 
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>
          <ApiHint hint={apiHints.login} align="left" fullWidth>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </ApiHint>
        </form>

        <div className="auth-links">
          <span>계정이 없으신가요?</span>
          <span className="auth-link" onClick={() => navigate('/signup')}>회원가입</span>
        </div>
      </div>
    </div>
  );
}
