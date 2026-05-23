import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import type { Notification, Company } from '../data/mockDB';
import '../styles/Notification.css';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, currentCompany, setCurrentCompany, logout } = useAuth();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
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

  const handleLogout = () => {
    logout();
    navigate('/login');
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
              <div style={{borderTop: '1px solid var(--border-color)'}}></div>
              <div 
                onClick={(e) => { e.stopPropagation(); navigate('/settings'); setShowWorkspaceDropdown(false); }}
                style={{padding: '12px 16px', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                ⚙️ 회사 설정 및 관리
              </div>
              <div 
                onClick={(e) => { e.stopPropagation(); navigate('/create-company'); setShowWorkspaceDropdown(false); }}
                style={{padding: '10px 16px 16px', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                + 새 회사 만들기
              </div>
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            📊 대시보드
          </NavLink>
          <NavLink to="/docs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            📁 부서 문서함
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            📝 내 TASK
          </NavLink>
          <NavLink to="/approvals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            ✅ 결재함
          </NavLink>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-title">{headerTitle}</div>
          <div className="header-actions">
            
            {/* Notification Wrapper */}
            <div className="notification-wrapper" ref={dropdownRef}>
              <button 
                className="icon-button" 
                onClick={() => setShowNotifications(!showNotifications)}
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

            <div className="user-profile">
              <div className="avatar">{currentUser?.name?.charAt(0) || 'U'}</div>
              <span className="user-name">{currentUser?.name}</span>
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

        {/* Scrollable Content */}
        <div className="content-scrollable">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
