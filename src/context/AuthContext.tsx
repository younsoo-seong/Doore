import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Company } from '../data/mockDB';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const storedUser = localStorage.getItem('doore_user');
    const storedToken = localStorage.getItem('doore_token');
    const storedCompany = localStorage.getItem('doore_company');

    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
        if (storedCompany) {
          setCurrentCompanyState(JSON.parse(storedCompany));
        }
      } catch (e) {
        localStorage.removeItem('doore_user');
        localStorage.removeItem('doore_token');
        localStorage.removeItem('doore_company');
      }
    }
    setLoading(false);
  }, []);

  const setCurrentCompany = (company: Company | null) => {
    if (company) {
      localStorage.setItem('doore_company', JSON.stringify(company));
    } else {
      localStorage.removeItem('doore_company');
    }
    setCurrentCompanyState(company);
  };

  const login = (user: User, token: string) => {
    localStorage.setItem('doore_user', JSON.stringify(user));
    localStorage.setItem('doore_token', token);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('doore_user');
    localStorage.removeItem('doore_token');
    localStorage.removeItem('doore_company');
    setCurrentUser(null);
    setCurrentCompanyState(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, currentCompany, setCurrentCompany, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
