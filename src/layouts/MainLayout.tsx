import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { api } from '../api';
import type { Notification, Company, ChatMessage } from '../data/mockDB';
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
  const [showMessenger, setShowMessenger] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [chatDepartments, setChatDepartments] = useState<any[]>([]);
  const [selectedChatDepartmentId, setSelectedChatDepartmentId] = useState<number | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [roleSummary, setRoleSummary] = useState<{ companyRole?: string; departmentRole?: string }>({});
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const accountSwitcherRef = useRef<HTMLDivElement>(null);
  const messengerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount
  useEffect(() => {
    async function fetchInitialData() {
      if (currentUser) {
        const companies = await api.getCompanies(currentUser.id);
        setUserCompanies(companies);
        if (companies.length > 0 && !currentCompany) {
          setCurrentCompany(companies[0]);
        }

        const targetCompany = currentCompany || companies[0];
        const notifs = await api.getNotifications(currentUser.id, targetCompany?.id);
        setNotifications(notifs);
        if (targetCompany) {
          const departments = await api.getDepartments(targetCompany.id);
          const departmentMembers = await Promise.all(
            departments.map((department: any) => api.getDepartmentMembers(department.id))
          );
          const accessibleDepartments = departments.filter((_department: any, index: number) => (
            departmentMembers[index].some((member: any) => member.id === currentUser.id)
          ));
          setChatDepartments(accessibleDepartments);
          const nextDepartmentId = selectedChatDepartmentId && accessibleDepartments.some((dept: any) => dept.id === selectedChatDepartmentId)
            ? selectedChatDepartmentId
            : accessibleDepartments[0]?.id ?? null;
          setSelectedChatDepartmentId(nextDepartmentId);
          if (!nextDepartmentId) {
            setChatMessages([]);
            setChatUsers([]);
          }
        } else {
          setChatDepartments([]);
          setSelectedChatDepartmentId(null);
          setChatMessages([]);
          setChatUsers([]);
        }
      }
    }
    fetchInitialData();
  }, [currentUser, currentCompany, setCurrentCompany]);

  useEffect(() => {
    async function fetchSelectedDepartmentMessages() {
      if (!currentCompany || !selectedChatDepartmentId) {
        setChatMessages([]);
        setChatUsers([]);
        return;
      }

      const chatData = await api.getCompanyChatMessages(currentCompany.id, selectedChatDepartmentId);
      setChatMessages(chatData.messages);
      setChatUsers(chatData.users);
    }

    fetchSelectedDepartmentMessages();
  }, [currentCompany, selectedChatDepartmentId]);

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
      if (messengerRef.current && !messengerRef.current.contains(event.target as Node)) {
        setShowMessenger(false);
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
  const displayRole = roleSummary.companyRole === 'OWNER'
    ? '조직장'
    : roleSummary.departmentRole === 'LEADER' || roleSummary.departmentRole === 'TASK_MANAGER'
      ? '부서장'
      : '부서원';

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

  const handleSelectChatDepartment = async (departmentId: number) => {
    if (!chatDepartments.some((department: any) => department.id === departmentId)) return;
    setSelectedChatDepartmentId(departmentId);
    setChatDraft('');
  };

  const handleSendChatMessage = async () => {
    if (!currentUser || !currentCompany || !selectedChatDepartmentId || !chatDraft.trim()) return;
    setIsSendingMessage(true);
    try {
      const message = await api.sendCompanyChatMessage(currentCompany.id, currentUser.id, chatDraft, selectedChatDepartmentId);
      setChatMessages(prev => [...prev, message]);
      setChatDraft('');
    } catch (e: any) {
      alert(e.message || '메시지 전송에 실패했습니다.');
    } finally {
      setIsSendingMessage(false);
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
        <div className="sidebar-header" style={{ padding: '0 20px' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <img
              src="/doore-logo.svg"
              alt="DOORE 로고"
              style={{ width: '36px', height: '30px', objectFit: 'contain', flexShrink: 0 }}
            />
            <span className="logo-text">DOORE</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div
            ref={workspaceDropdownRef}
            style={{ position: 'relative' }}
          >
            <button
              type="button"
              className="nav-item workspace-nav-item"
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            >
              <span>{currentCompany ? currentCompany.name : '회사 생성 필요'}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px' }}>▼</span>
            </button>

            {showWorkspaceDropdown && (
              <div style={{
                position: 'absolute', top: '44px', left: '0', right: '0',
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
              {isOwner && (
                  <div
                    onClick={(e) => { e.stopPropagation(); navigate('/settings'); setShowWorkspaceDropdown(false); }}
                    style={{padding: '12px 16px', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
                  >
                     회사 설정 및 관리
                  </div>
              )}
              <div
                onClick={(e) => { e.stopPropagation(); navigate('/create-company'); setShowWorkspaceDropdown(false); }}
                style={{padding: isOwner ? '10px 16px 16px' : '12px 16px', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                + 새 회사 만들기
              </div>
              {!isOwner && (
                <div style={{padding: '0 16px 14px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, lineHeight: 1.45}}>
                  회사 생성은 모든 사용자가 할 수 있습니다. 회사 설정 관리는 조직장 권한이 필요합니다.
                </div>
              )}
            </div>
          )}
          </div>

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
            
            <div ref={messengerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowMessenger(!showMessenger)}
                style={{
                  border: '1px solid var(--border-color)',
                  background: showMessenger ? 'var(--primary-light)' : 'transparent',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: showMessenger ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                메신저
              </button>

              {showMessenger && (
                <div
                  style={{
                    position: 'absolute',
                    top: '38px',
                    right: 0,
                    zIndex: 2300,
                    width: '360px',
                    maxWidth: 'calc(100vw - 40px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.18)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>부서 메신저</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>{chatMessages.length}</span>
                    </div>
                    <select
                      value={selectedChatDepartmentId ?? ''}
                      onChange={(event) => handleSelectChatDepartment(Number(event.target.value))}
                      disabled={chatDepartments.length === 0}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700 }}
                    >
                      {chatDepartments.length === 0 ? (
                        <option value="">부서 없음</option>
                      ) : (
                        chatDepartments.map((department: any) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div style={{ height: '280px', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-app)' }}>
                    {!selectedChatDepartmentId ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '56px 8px' }}>
                        메신저 부서를 선택해 주세요.
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '56px 8px' }}>
                        메시지가 없습니다.
                      </div>
                    ) : (
                      chatMessages.map((message) => {
                        const sender = chatUsers.find((user: any) => user.id === message.sender_id);
                        const mine = message.sender_id === currentUser?.id;
                        return (
                          <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                            <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: '3px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{sender?.name ?? '알 수 없음'}</span>
                              <div style={{ padding: '8px 10px', borderRadius: '8px', background: mine ? 'var(--primary)' : 'white', color: mine ? 'white' : 'var(--text-primary)', border: mine ? '1px solid var(--primary)' : '1px solid var(--border-color)', fontSize: '12px', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>
                                {message.content}
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(message.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder="메시지 입력"
                      rows={2}
                      style={{ flex: 1, resize: 'none', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', fontFamily: 'inherit', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                    />
                    <ApiHint hint={apiHints.sendMessage}>
                      <button
                        type="button"
                        onClick={handleSendChatMessage}
                        disabled={isSendingMessage || !chatDraft.trim() || !currentCompany || !selectedChatDepartmentId}
                        className="btn-primary"
                        style={{ padding: '8px 12px', minHeight: '36px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        전송
                      </button>
                    </ApiHint>
                  </div>
                </div>
              )}
            </div>

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
                    {displayRole}
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
