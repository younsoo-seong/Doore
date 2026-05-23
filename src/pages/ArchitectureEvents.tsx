import { useEffect, useMemo, useState } from 'react';
import { getDemoEvents, subscribeDemoEvents } from '../utils/eventBus';
import type { DemoEvent } from '../utils/eventBus';

const erdTables = [
  { name: 'companies', fields: ['id', 'name', 'created_at'] },
  { name: 'company_members', fields: ['company_id', 'user_id', 'role', 'joined_at'] },
  { name: 'departments', fields: ['id', 'company_id', 'name', 'created_at'] },
  { name: 'department_members', fields: ['department_id', 'user_id', 'role'] },
  { name: 'users', fields: ['id', 'email', 'name', 'created_at'] },
  { name: 'documents', fields: ['id', 'department_id', 'title', 'content', 'status', 'created_by', 'approver_id'] },
  { name: 'document_members', fields: ['user_id', 'document_id', 'role'] },
  { name: 'tasks', fields: ['id', 'document_id', 'title', 'content', 'status', 'due_date'] },
  { name: 'task_assignees', fields: ['task_id', 'user_id', 'assigned_at'] },
  { name: 'notifications', fields: ['id', 'user_id', 'type', 'message', 'is_read'] },
];

export default function ArchitectureEvents() {
  const [events, setEvents] = useState<DemoEvent[]>(() => getDemoEvents());
  const [activeEvent, setActiveEvent] = useState<DemoEvent | null>(events[0] ?? null);
  const [activeTable, setActiveTable] = useState<string | null>(null);

  useEffect(() => {
    return subscribeDemoEvents((event) => {
      setEvents(getDemoEvents());
      setActiveEvent(event);
    });
  }, []);

  const activeTables = useMemo(() => new Set(activeEvent?.tables ?? []), [activeEvent]);
  const tableEventCount = (tableName: string) => events.filter((event) => event.tables.includes(tableName)).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(360px, 0.9fr)', gap: '20px', padding: '20px', height: '100%' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>ERD 이벤트 맵</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              화면에서 발생한 API 호출이 어떤 테이블을 변경하는지 커서를 올려 확인할 수 있습니다.
            </p>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            최근 이벤트 {events.length}개
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
          {erdTables.map((table) => {
            const active = activeTables.has(table.name);
            return (
              <div
                key={table.name}
                onMouseEnter={() => setActiveTable(table.name)}
                onMouseLeave={() => setActiveTable(null)}
                title={`${table.name}\n필드: ${table.fields.join(', ')}\n최근 이벤트: ${tableEventCount(table.name)}회`}
                style={{
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: active ? 'var(--primary-light)' : 'var(--bg-card)',
                  boxShadow: active ? '0 8px 20px rgba(37, 99, 235, 0.14)' : 'var(--card-shadow)',
                  overflow: 'hidden',
                  minHeight: '170px',
                  transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s'
                }}
              >
                <div style={{ background: active ? 'var(--primary)' : '#334155', color: 'white', padding: '10px 12px', fontWeight: 800, fontSize: '13px' }}>
                  {table.name}
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {table.fields.map((field) => (
                    <div key={field} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>{field}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{field.endsWith('_id') || field === 'id' ? 'integer' : 'value'}</span>
                    </div>
                  ))}
                </div>
                {activeTable === table.name && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 12px', fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                    이 테이블과 연결된 이벤트 {tableEventCount(table.name)}개
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
        <div className="card" style={{ gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px' }}>선택된 이벤트</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{activeEvent?.method}</span>
          </div>
          {activeEvent ? (
            <>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>{activeEvent.title}</div>
              <code style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '12px', whiteSpace: 'normal' }}>
                {activeEvent.api}
              </code>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{activeEvent.summary}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeEvent.tables.map((table) => (
                  <span key={table} style={{ padding: '4px 8px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                    {table}
                  </span>
                ))}
              </div>
              {activeEvent.payload && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  요청: <code>{activeEvent.payload}</code>
                </div>
              )}
              {activeEvent.result && (
                <div style={{ fontSize: '12px', color: '#047857', fontWeight: 700 }}>
                  결과: {activeEvent.result}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>아직 발생한 이벤트가 없습니다.</div>
          )}
        </div>

        <div className="card" style={{ minHeight: 0, overflow: 'hidden' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>API 이벤트 로그</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onMouseEnter={() => setActiveEvent(event)}
                onClick={() => setActiveEvent(event)}
                title={`${event.api}\n테이블: ${event.tables.join(', ')}\n${event.summary}`}
                style={{
                  textAlign: 'left',
                  border: activeEvent?.id === event.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  background: activeEvent?.id === event.id ? 'var(--primary-light)' : 'var(--bg-card)',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>{event.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>{event.method}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.api}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
