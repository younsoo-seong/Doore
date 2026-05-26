import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { api } from '../api';
import type { Notification, Company } from '../data/mockDB';
import { companyRoleLabels, departmentRoleLabels } from '../utils/permissions';
import ApiHint from '../components/ApiHint';
import { apiHints } from '../utils/apiHints';
import '../styles/Notification.css';

const demoAccounts = [
  { label: '조직장', email: 'admin@doore.com', name: '박재홍', role: '승인, 조직 관리' },
  { label: '부서장', email: 'leader@doore.com', name: '오승민', role: '부서 배치, 문서 생성, Task 분할' },
  { label: '부서원', email: 'member@doore.com', name: '정동재', role: '내 Task 편집' },
];

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, currentCompany, setCurrentCompany, login, logout } = useAuth();
  const { isOffline, syncState, simulateDisconnect, simulateReconnect } = useNetwork();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [roleSummary, setRoleSummary] = useState<{ companyRole?: string; departmentRole?: string }>({});
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const accountSwitcherRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount
  useEffect(() => {
    async function fetchInitialData() {
      if (currentUser) {
        const notifs = await api.getNotifications(currentUser.id);
        setNotifications(notifs);
        
        const companies = await api.getCompanies(currentUser.id);
        setUserCompanies(companies);
        if (companies.length > 0 && !currentCompany) {
          setCurrentCompany(companies[0]);
        }
      }
    }
    fetchInitialData();
  }, [currentUser]);

  useEffect(() => {
    async function fetchRoles() {
      if (!currentUser || !currentCompany) {
        setRoleSummary({});
        return;
      }

      const members = await api.getCompanyMembers(currentCompany.id);
      const me = members.find((member: any) => member.id === currentUser.id);
      const departments = await api.getDepartments(currentCompany.id);
      let departmentRole: string | undefined;

      for (const dept of departments) {
        const deptMembers = await api.getDepartmentMembers(dept.id);
        const deptMe = deptMembers.find((member: any) => member.id === currentUser.id);
        if (deptMe?.role) {
          departmentRole = deptMe.role;
          break;
        }
      }

      setRoleSummary({ companyRole: me?.role, departmentRole });
    }

    fetchRoles();
  }, [currentUser, currentCompany]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
      if (accountSwitcherRef.current && !accountSwitcherRef.current.contains(event.target as Node)) {
        setShowAccountSwitcher(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchWorkspace = (company: Company) => {
    setCurrentCompany(company);
    setShowWorkspaceDropdown(false);
    navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = notifications.filter(n => 
    activeTab === 'unread' ? !n.is_read : n.is_read
  );
  const isOwner = roleSummary.companyRole === 'OWNER';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchDemoAccount = async (email: string) => {
    const response = await api.login(email, 'password');
    login(response.user, response.token);
    const companies = await api.getCompanies(response.user.id);
    setCurrentCompany(companies[0] || null);
    setShowAccountSwitcher(false);
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await api.markNotificationAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    // For demo purposes, we can navigate to dashboard or specific task
    setShowNotifications(false);
  };

  const handleMarkAllAsRead = async () => {
    if (currentUser) {
      await api.markAllAsRead(currentUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  let headerTitle = '대시보드';
  if (location.pathname === '/docs') headerTitle = '부서 문서함';
  if (location.pathname === '/tasks') headerTitle = '내 TASK';
  if (location.pathname === '/approvals') headerTitle = '결재함';

  const networkMessage =
    syncState === 'offline'
      ? '서버와 연결이 끊겼습니다. 변경사항은 로컬 IndexedDB에 임시 저장하고 재연결을 시도합니다.'
      : syncState === 'syncing'
        ? '서버와 다시 연결 중입니다. IndexedDB 임시 변경분을 reconnect-sync로 전송합니다.'
        : syncState === 'recovered'
          ? '재연결 완료. 로컬 IndexedDB 변경분이 서버 최신 상태와 동기화되었습니다.'
          : '';

  return (
    <div className="app-container">
      {/* Sidebar / LNB */}
      <aside className="sidebar">
        <div 
          className="sidebar-header" 
          ref={workspaceDropdownRef} 
          style={{position: 'relative', cursor: 'pointer', padding: '0 16px'}} 
          onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
        >
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: showWorkspaceDropdown ? 'rgba(255,255,255,0.1)' : 'transparent'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{width: '24px', height: '24px', backgroundColor: 'var(--primary)', borderRadius: '4px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px'}}>
                {currentCompany ? currentCompany.name.charAt(0) : 'D'}
              </div>
              <span className="logo-text" style={{fontSize: '15px'}}>{currentCompany ? currentCompany.name : '회사 생성 필요'}</span>
            </div>
            <span style={{fontSize: '10px', color: 'var(--sidebar-text)'}}>▼</span>
          </div>
          
          {showWorkspaceDropdown && (
            <div style={{
              position: 'absolute', top: '64px', left: '16px', right: '16px', 
              backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, color: 'var(--text-primary)', overflow: 'hidden'
            }}>
              <div style={{padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)'}}>
                내 워크스페이스
              </div>
              {userCompanies.map(comp => (
                <div 
                  key={comp.id} 
                  onClick={(e) => { e.stopPropagation(); handleSwitchWorkspace(comp); }}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                    fontWeight: currentCompany?.id === comp.id ? '600' : '400', 
                    background: currentCompany?.id === comp.id ? 'var(--primary-light)' : 'transparent'
                  }}
                >
                  {comp.name}
                </div>
              ))}
              {isOwner ? (
                <>
                  <div style={{borderTop: '1px solid var(--border-color)'}}></div>
                  <div
                    onClick={(e) => { e.stopPropagation(); navigate('/settings'); setShowWorkspaceDropdown(false); }}
                    style={{padding: '12px 16px', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
                  >
                     회사 설정 및 관리
                  </div>
                  <div
                    onClick={(e) => { e.stopPropagation(); navigate('/create-company'); setShowWorkspaceDropdown(false); }}
                    style={{padding: '10px 16px 16px', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
                  >
                    + 새 회사 만들기
                  </div>
                </>
              ) : (
                <div style={{borderTop: '1px solid var(--border-color)', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700}}>
                  조직 생성/관리는 조직장 권한이 필요합니다.
                </div>
              )}
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
             대시보드
          </NavLink>
          <NavLink to="/docs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
             부서 문서함
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
             내 TASK
          </NavLink>
          <NavLink to="/approvals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
             결재함
          </NavLink>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-title">{headerTitle}</div>
          <div className="header-actions">
            <ApiHint hint={apiHints.reconnectSync}>
              <button
                type="button"
                onClick={isOffline || syncState === 'syncing' ? simulateReconnect : simulateDisconnect}
                style={{
                  border: '1px solid var(--border-color)',
                  background: isOffline ? '#fef2f2' : 'transparent',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: isOffline ? '#dc2626' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                {isOffline || syncState === 'syncing' ? '네트워크 복구' : '네트워크 단절'}
              </button>
            </ApiHint>
            
            {/* Notification Wrapper */}
            <div className="notification-wrapper" ref={dropdownRef}>
              <button 
                className="icon-button" 
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="알림"
              >
                🔔
                {unreadCount > 0 && <span className="notification-badge"></span>}
              </button>

              {/* Notification Dropdown Menu */}
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <span>알림 센터</span>
                    {unreadCount > 0 && (
                      <span 
                        onClick={handleMarkAllAsRead}
                        style={{fontSize: '12px', color: 'var(--primary)', fontWeight: 'normal', cursor: 'pointer'}}
                      >
                        모두 읽음 처리
                      </span>
                    )}
                  </div>
                  <div className="notification-tabs">
                    <button 
                      className={`notification-tab ${activeTab === 'unread' ? 'active' : ''}`}
                      onClick={() => setActiveTab('unread')}
                    >
                      읽지 않음 ({unreadCount})
                    </button>
                    <button 
                      className={`notification-tab ${activeTab === 'read' ? 'active' : ''}`}
                      onClick={() => setActiveTab('read')}
                    >
                      읽은 알림 ({notifications.length - unreadCount})
                    </button>
                  </div>
                  <div className="notification-list">
                    {filteredNotifications.length === 0 ? (
                      <div className="notification-empty">해당하는 알림이 없습니다.</div>
                    ) : (
                      filteredNotifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="update-icon" style={{marginTop: '4px', backgroundColor: notif.type === 'DOC_REJECTED' ? '#ef4444' : 'var(--primary)'}}></div>
                          <div className="notification-content">
                            <div className="notification-message">{notif.message}</div>
                            <div className="notification-time">{new Date(notif.created_at).toLocaleString('ko-KR')}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-profile" ref={accountSwitcherRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                title="데모 계정 전환"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer'
                }}
              >
                <div className="avatar">{currentUser?.name?.charAt(0) || 'U'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, alignItems: 'flex-start' }}>
                  <span className="user-name">{currentUser?.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {roleSummary.companyRole ? companyRoleLabels[roleSummary.companyRole as keyof typeof companyRoleLabels] : '역할 없음'}
                    {roleSummary.departmentRole ? ` / ${departmentRoleLabels[roleSummary.departmentRole as keyof typeof departmentRoleLabels]}` : ''}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>▼</span>
              </button>

              {showAccountSwitcher && (
                <div
                  style={{
                    position: 'absolute',
                    top: '42px',
                    right: 0,
                    zIndex: 2200,
                    width: '260px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.18)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    데모 계정 전환
                  </div>
                  {demoAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleSwitchDemoAccount(account.email)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        border: 0,
                        borderBottom: '1px solid var(--border-color)',
                        background: currentUser?.email === account.email ? 'var(--primary-light)' : 'var(--bg-card)',
                        padding: '11px 12px',
                        textAlign: 'left'
                      }}
                    >
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{account.name.charAt(0)}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{account.name} · {account.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{account.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleLogout} 
              style={{
                marginLeft: '12px', 
                padding: '6px 12px', 
                fontSize: '13px', 
                fontWeight: '500',
                borderRadius: '6px', 
                border: '1px solid var(--border-color)', 
                background: 'transparent', 
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}>
              로그아웃
            </button>
          </div>
        </header>

        {syncState !== 'online' && (
          <div
            style={{
              borderBottom: '1px solid #facc15',
              background: syncState === 'offline' ? '#fef2f2' : syncState === 'syncing' ? '#fffbeb' : '#ecfdf5',
              color: syncState === 'offline' ? '#b91c1c' : syncState === 'syncing' ? '#92400e' : '#047857',
              padding: '10px 32px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{networkMessage}</span>
            {syncState === 'offline' && (
              <ApiHint hint={apiHints.reconnectSync}>
                <button
                  type="button"
                  onClick={simulateReconnect}
                  style={{
                    border: '1px solid currentColor',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  재연결
                </button>
              </ApiHint>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="content-scrollable">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
