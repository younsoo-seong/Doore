import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { emitDemoEvent } from '../utils/eventBus';

type SyncState = 'online' | 'offline' | 'syncing' | 'recovered';

interface NetworkContextValue {
  isOffline: boolean;
  isSimulatedOffline: boolean;
  syncState: SyncState;
  simulateDisconnect: () => void;
  simulateReconnect: () => void;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [browserOffline, setBrowserOffline] = useState(!navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'online' : 'offline');

  const isOffline = browserOffline || isSimulatedOffline;

  useEffect(() => {
    const handleOffline = () => {
      setBrowserOffline(true);
      setSyncState('offline');
      emitDemoEvent({
        title: '네트워크 연결 단절',
        api: 'WSS /ws-stomp',
        method: 'WSS',
        tables: ['tasks'],
        summary: '공동 편집 세션이 끊겨 변경사항을 로컬 IndexedDB에 임시 저장하고 재연결을 시도합니다.',
        result: 'IndexedDB 임시 저장, reconnect-sync 대기',
      });
    };
    const handleOnline = () => {
      setBrowserOffline(false);
      setSyncState('syncing');
      emitDemoEvent({
        title: '재동기화 요청',
        api: 'PUB /pub/tasks/{taskId}/reconnect-sync',
        method: 'WSS',
        tables: ['tasks'],
        summary: 'IndexedDB에 남아 있던 임시 변경분을 서버 최신 버전과 비교합니다.',
        payload: '{ last_known_version, indexeddb_patch_queue }',
        result: '서버 최신 병합 상태 반환',
      });
      window.setTimeout(() => setSyncState('recovered'), 900);
      window.setTimeout(() => setSyncState('online'), 3200);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const simulateDisconnect = () => {
    setIsSimulatedOffline(true);
    setSyncState('offline');
    emitDemoEvent({
      title: '네트워크 단절 시뮬레이션',
      api: 'WSS /ws-stomp',
      method: 'WSS',
      tables: ['tasks'],
      summary: '발표 데모용으로 연결 단절 상황을 강제로 발생시켰습니다.',
      result: 'IndexedDB 임시 저장 모드 진입',
    });
  };

  const simulateReconnect = () => {
    setIsSimulatedOffline(false);
    setSyncState('syncing');
    emitDemoEvent({
      title: '네트워크 복구 및 동기화',
      api: 'SUB /sub/tasks/{taskId}/sync',
      method: 'WSS',
      tables: ['tasks'],
      summary: '임시 저장된 변경 사항을 서버 최신 상태와 다시 맞춥니다.',
      result: 'IndexedDB 변경분 동기화 완료',
    });
    window.setTimeout(() => setSyncState('recovered'), 900);
    window.setTimeout(() => setSyncState('online'), 3200);
  };

  const value = useMemo(
    () => ({ isOffline, isSimulatedOffline, syncState, simulateDisconnect, simulateReconnect }),
    [isOffline, isSimulatedOffline, syncState],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
