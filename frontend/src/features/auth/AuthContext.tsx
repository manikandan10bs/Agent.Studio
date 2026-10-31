import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../../services/api';
import { auth, googleProvider, isFirebaseConfigured } from '../../services/firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isFirebaseActive: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirebaseActive = isFirebaseConfigured();

  const syncBackendUser = async (idToken: string): Promise<User> => {
    localStorage.setItem('agent_studio_token', idToken);
    const u = await api.getCurrentUser();
    setUser(u);
    return u;
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('agent_studio_token');
      if (token) {
        const u = await api.getCurrentUser();
        setUser(u);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      localStorage.removeItem('agent_studio_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFirebaseActive && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            await syncBackendUser(token);
          } catch (err) {
            console.warn('Failed to sync Firebase session with backend:', err);
            await refreshUser();
          } finally {
            setLoading(false);
          }
        } else {
          // If no Firebase user, check if a local JWT exists or clear
          await refreshUser();
        }
      });
      return () => unsubscribe();
    } else {
      refreshUser();
    }
  }, [isFirebaseActive]);

  const login = async (email: string, password: string) => {
    if (isFirebaseActive && auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCred.user.getIdToken();
        await syncBackendUser(token);
        return;
      } catch (err: any) {
        // If user doesn't exist in Firebase or if fallback allowed, try backend directly
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            const data = await api.login(email, password);
            setUser(data.user);
            return;
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }

    // Default backend auth
    const data = await api.login(email, password);
    setUser(data.user);
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseActive || !auth || !googleProvider) {
      throw new Error('Google Sign-In requires Firebase to be configured with VITE_FIREBASE_* environment variables.');
    }
    const result = await signInWithPopup(auth, googleProvider);
    const token = await result.user.getIdToken();
    await syncBackendUser(token);
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    if (isFirebaseActive && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      const token = await cred.user.getIdToken(true);
      await syncBackendUser(token);
      return;
    }
    throw new Error('User registration requires Firebase to be enabled.');
  };

  const resetPassword = async (email: string) => {
    if (!isFirebaseActive || !auth) {
      throw new Error('Password reset requires Firebase to be configured.');
    }
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    try {
      if (isFirebaseActive && auth) {
        await firebaseSignOut(auth);
      }
      await api.logout();
    } finally {
      localStorage.removeItem('agent_studio_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebaseActive,
        login,
        loginWithGoogle,
        registerWithEmail,
        resetPassword,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
