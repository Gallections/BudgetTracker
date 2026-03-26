import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { initDatabase } from '../db/db';

interface AppState {
  baseCurrency: string;
  dbReady: boolean;
  refreshKey: number;
}

type AppAction =
  | { type: 'SET_BASE_CURRENCY'; currency: string }
  | { type: 'DB_READY' }
  | { type: 'REFRESH' };

const initialState: AppState = {
  baseCurrency: 'CAD',
  dbReady: false,
  refreshKey: 0,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BASE_CURRENCY':
      return { ...state, baseCurrency: action.currency };
    case 'DB_READY':
      return { ...state, dbReady: true };
    case 'REFRESH':
      return { ...state, refreshKey: state.refreshKey + 1 };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    initDatabase()
      .then(() => dispatch({ type: 'DB_READY' }))
      .catch(console.error);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
