import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import '../styles/Auth.css';

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
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="auth-links">
          <span>계정이 없으신가요?</span>
          <span className="auth-link" onClick={() => navigate('/signup')}>회원가입</span>
        </div>
      </div>
    </div>
  );
}
