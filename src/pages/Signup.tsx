import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import '../styles/Auth.css';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, setCurrentCompany } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const response = await api.signup(email, name, password);
      login(response.user, response.token);
      setCurrentCompany(null); // New users have no company
      navigate('/');
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">DOORE</div>
          <h1 className="auth-title">회원가입</h1>
          <p className="auth-subtitle">새로운 계정을 생성하고 협업을 시작하세요.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSignup}>
          <div className="form-group">
            <label>이름</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="정동재"
              required 
            />
          </div>
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
              minLength={4}
            />
          </div>
          <div className="form-group">
            <label>비밀번호 확인</label>
            <input 
              type="password" 
              value={passwordConfirm} 
              onChange={(e) => setPasswordConfirm(e.target.value)} 
              placeholder="••••••••"
              required 
              minLength={4}
            />
          </div>
          <ApiHint hint={apiHints.signup} align="left" fullWidth>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </ApiHint>
        </form>

        <div className="auth-links">
          <span>이미 계정이 있으신가요?</span>
          <span className="auth-link" onClick={() => navigate('/login')}>로그인</span>
        </div>
      </div>
    </div>
  );
}
