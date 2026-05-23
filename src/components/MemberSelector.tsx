import { useState } from 'react';

interface MemberSelectorProps {
  candidates: any[];
  selectedIds: number[];
  onSelect: (userId: number) => void;
  onDeselect: (userId: number) => void;
  placeholder?: string;
  renderExtraActions?: (userId: number) => React.ReactNode;
}

export default function MemberSelector({
  candidates,
  selectedIds,
  onSelect,
  onDeselect,
  placeholder = '이름 또는 이메일로 검색...',
  renderExtraActions
}: MemberSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filter candidates by search term
  const filtered = candidates.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Sort filtered candidates: selected ones go to the very top
  const sorted = [...filtered].sort((a, b) => {
    const aSelected = selectedIds.includes(a.id);
    const bSelected = selectedIds.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Search Input */}
      <input 
        type="text" 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
        placeholder={placeholder} 
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '14px',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)'
        }}
      />

      {/* Candidates List */}
      <div style={{ 
        border: '1px solid var(--border-color)', 
        borderRadius: '8px', 
        maxHeight: '220px', 
        overflowY: 'auto',
        backgroundColor: 'var(--bg-card)'
      }}>
        {sorted.map(user => {
          const isSelected = selectedIds.includes(user.id);
          return (
            <div 
              key={user.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar" style={{ 
                  width: 28, 
                  height: 28, 
                  fontSize: 11,
                  backgroundColor: isSelected ? 'var(--primary)' : '#94a3b8',
                  color: 'white'
                }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{user.email}</div>
                </div>
              </div>
              
              {isSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderExtraActions && renderExtraActions(user.id)}
                  <button
                    type="button"
                    onClick={() => onDeselect(user.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    선택 해제
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(user.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  선택
                </button>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
