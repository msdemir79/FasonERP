import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { userService } from '../services/userService';
import type { AppUser, Role, AppModule, PermissionAction } from '../types';

interface AuthContextType {
  currentUser: AppUser | null;
  currentRole: Role | null;
  users: AppUser[];
  roles: Role[];
  isLoading: boolean;
  switchUser: (userId: number) => Promise<void>;
  hasPermission: (module: AppModule, action?: PermissionAction) => boolean;
  isSuperAdmin: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Live queries for all users and roles
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const roles = useLiveQuery(() => db.roles.toArray()) || [];

  const loadActiveUserAndRole = useCallback(async () => {
    try {
      const user = await userService.getActiveUser();
      setCurrentUser(user);

      if (user) {
        let role: Role | undefined;
        if (user.roleCode) {
          role = await db.roles.where('code').equals(user.roleCode).first();
        }
        if (!role && user.roleId) {
          role = await db.roles.get(user.roleId);
        }
        setCurrentRole(role || null);
      } else {
        setCurrentRole(null);
      }
    } catch (err) {
      console.error('Auth yükleme hatası:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveUserAndRole();

    const unsubscribe = userService.onActiveUserChange((user, role) => {
      setCurrentUser(user);
      setCurrentRole(role);
    });

    return () => {
      unsubscribe();
    };
  }, [loadActiveUserAndRole]);

  // If users or roles change in DB (e.g. initial seeding completes), re-evaluate
  useEffect(() => {
    if (!currentUser && users.length > 0) {
      loadActiveUserAndRole();
    } else if (currentUser && roles.length > 0) {
      const updatedRole = roles.find(r => r.code === currentUser.roleCode || r.id === currentUser.roleId);
      if (updatedRole) {
        setCurrentRole(updatedRole);
      }
    }
  }, [users, roles, currentUser, loadActiveUserAndRole]);

  const switchUser = async (userId: number) => {
    setIsLoading(true);
    try {
      await userService.setActiveUserId(userId, true);
      await loadActiveUserAndRole();
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = useCallback(
    (module: AppModule, action: PermissionAction = 'view'): boolean => {
      return userService.hasPermission(currentUser, currentRole, module, action);
    },
    [currentUser, currentRole]
  );

  const isSuperAdmin = Boolean(
    currentUser?.roleCode === 'super_admin' || currentRole?.code === 'super_admin'
  );

  const value: AuthContextType = {
    currentUser,
    currentRole,
    users,
    roles,
    isLoading,
    switchUser,
    hasPermission,
    isSuperAdmin,
    refreshAuth: loadActiveUserAndRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
