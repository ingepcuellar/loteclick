import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { isAuthenticated as checkToken, setToken } from '../lib/apiClient';

// Roles and Permissions
export const ROLES = {
    ADMIN: 'admin',
    SELLER: 'seller',
    TREASURER: 'treasurer',
    PARTNER: 'partner'
};

export const ROLE_LABELS = {
    admin: 'Administrador',
    seller: 'Vendedor',
    treasurer: 'Tesorero',
    partner: 'Socio'
};

// Permissions by module
export const PERMISSIONS = {
    dashboard: {
        admin: ['view', 'all'],
        seller: [],
        treasurer: [],
        partner: ['view', 'own']
    },
    projects: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: ['view'],
        treasurer: [],
        partner: ['view_own']
    },
    clients: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: ['view', 'create', 'edit', 'delete'],
        treasurer: [],
        partner: []
    },
    sales: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: ['view', 'create', 'edit', 'delete'],
        treasurer: [],
        partner: ['view_own']
    },
    payments: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: [],
        treasurer: ['view', 'create', 'edit', 'delete'],
        partner: ['view_own']
    },
    expenses: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: [],
        treasurer: ['view', 'create', 'edit'],
        partner: ['view_own']
    },
    treasury: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: [],
        treasurer: [],
        partner: []
    },
    disbursements: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: [],
        treasurer: ['view', 'create', 'edit', 'delete'],
        partner: ['view_own']
    },
    reports: {
        admin: ['view', 'all'],
        seller: [],
        treasurer: [],
        partner: ['view_own']
    },
    users: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: [],
        treasurer: [],
        partner: []
    },
    utilities: {
        admin: ['view', 'create', 'edit', 'delete'],
        seller: ['view', 'create', 'edit'],
        treasurer: ['view', 'create', 'edit'],
        partner: ['view']
    }
};

// Initial State
const initialState = {
    currentUser: null,
    profile: null,
    users: [],
    isAuthenticated: false,
    isLoading: true,
    error: null
};

// Action Types
const ACTIONS = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    SET_PROFILE: 'SET_PROFILE',
    SET_USERS: 'SET_USERS',
    REGISTER: 'REGISTER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',
    LOAD_STATE: 'LOAD_STATE',
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR'
};

// Reducer
function authReducer(state, action) {
    switch (action.type) {
        case ACTIONS.LOGIN:
            return {
                ...state,
                currentUser: action.payload.user,
                profile: action.payload.profile,
                isAuthenticated: true,
                isLoading: false,
                error: null
            };

        case ACTIONS.LOGOUT:
            return {
                ...state,
                currentUser: null,
                profile: null,
                isAuthenticated: false,
                error: null
            };

        case ACTIONS.SET_PROFILE:
            return {
                ...state,
                profile: action.payload,
                currentUser: action.payload ? {
                    ...state.currentUser,
                    ...action.payload
                } : state.currentUser
            };

        case ACTIONS.SET_USERS:
            return {
                ...state,
                users: action.payload
            };

        case ACTIONS.REGISTER:
            return {
                ...state,
                users: [...state.users, action.payload]
            };

        case ACTIONS.UPDATE_USER:
            return {
                ...state,
                users: state.users.map(u =>
                    u.id === action.payload.id ? action.payload : u
                ),
                profile: state.profile?.id === action.payload.id
                    ? action.payload
                    : state.profile
            };

        case ACTIONS.DELETE_USER:
            return {
                ...state,
                users: state.users.filter(u => u.id !== action.payload)
            };

        case ACTIONS.LOAD_STATE:
            return {
                ...state,
                ...action.payload,
                isLoading: false
            };

        case ACTIONS.SET_LOADING:
            return {
                ...state,
                isLoading: action.payload
            };

        case ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                isLoading: false
            };

        default:
            return state;
    }
}

// Create Context
const AuthContext = createContext();

// Provider Component
export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Load session on mount — check if JWT token exists and is valid
    useEffect(() => {
        const initAuth = async () => {
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });

            try {
                if (!checkToken()) {
                    // No token stored, user is not logged in
                    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
                    return;
                }

                // Verify token by fetching current user profile
                const { data: profile, error } = await authService.getUser();

                if (error || !profile) {
                    // Token is invalid or expired
                    setToken(null);
                    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
                    return;
                }

                dispatch({
                    type: ACTIONS.LOGIN,
                    payload: {
                        user: profile,
                        profile: profile
                    }
                });

                // Load all users if admin
                if (profile.role === 'admin') {
                    const { data: users } = await authService.getAllUsers();
                    if (users) {
                        dispatch({ type: ACTIONS.SET_USERS, payload: users });
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                setToken(null);
                dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
            }
        };

        initAuth();
    }, []);

    // ============================================
    // LOGIN
    // ============================================
    const login = useCallback(async (email, password) => {
        const { data, error } = await authService.signIn(email, password);

        if (error) {
            return { success: false, error: error };
        }

        if (data?.user) {
            if (data.user.is_active === false) {
                await authService.signOut();
                return { success: false, error: 'Usuario desactivado' };
            }

            dispatch({
                type: ACTIONS.LOGIN,
                payload: {
                    user: data.user,
                    profile: data.user
                }
            });

            // Load users list if admin
            if (data.user.role === 'admin') {
                const { data: users } = await authService.getAllUsers();
                if (users) {
                    dispatch({ type: ACTIONS.SET_USERS, payload: users });
                }
            }

            return { success: true, user: data.user };
        }

        return { success: false, error: 'Error desconocido' };
    }, []);

    // ============================================
    // LOGOUT
    // ============================================
    const logout = useCallback(async () => {
        await authService.signOut();
        dispatch({ type: ACTIONS.LOGOUT });
    }, []);

    // ============================================
    // REGISTER USER
    // ============================================
    const registerUser = useCallback(async (userData) => {
        const { data, error } = await authService.signUp({
            email: userData.email,
            password: userData.password,
            name: userData.name,
            role: userData.role || 'seller',
            associatedProjects: userData.associatedProjects || []
        });

        if (error) {
            return { success: false, error: error };
        }

        if (data) {
            dispatch({ type: ACTIONS.REGISTER, payload: data });
            return { success: true, user: data };
        }

        return { success: false, error: 'Error al crear usuario' };
    }, []);

    // ============================================
    // UPDATE USER
    // ============================================
    const updateUser = useCallback(async (userData) => {
        const { data, error } = await authService.updateProfile(userData.id, {
            name: userData.name,
            role: userData.role,
            is_active: userData.isActive ?? userData.is_active,
            associated_projects: userData.associatedProjects || userData.associated_projects || [],
            password: userData.password || undefined
        });

        if (error) {
            return { success: false, error: error };
        }

        dispatch({ type: ACTIONS.UPDATE_USER, payload: data });
        return { success: true };
    }, []);

    // ============================================
    // DELETE USER
    // ============================================
    const deleteUser = useCallback(async (userId) => {
        const user = state.users.find(u => u.id === userId);

        if (user?.email === 'admin@loteclick.com') {
            return { success: false, error: 'No se puede eliminar el administrador principal' };
        }

        if (state.currentUser?.id === userId || state.profile?.id === userId) {
            return { success: false, error: 'No puedes eliminarte a ti mismo' };
        }

        // Soft delete — deactivate the user
        await authService.updateProfile(userId, { is_active: false });
        dispatch({ type: ACTIONS.DELETE_USER, payload: userId });
        return { success: true };
    }, [state.users, state.currentUser, state.profile]);

    // ============================================
    // HELPERS
    // ============================================
    const getUserById = useCallback((id) => {
        return state.users.find(u => u.id === id);
    }, [state.users]);

    const getUsersByRole = useCallback((role) => {
        return state.users.filter(u => u.role === role);
    }, [state.users]);

    const hasPermission = useCallback((module, action) => {
        const role = state.profile?.role || state.currentUser?.role;
        if (!role) return false;

        const rolePermissions = PERMISSIONS[module]?.[role] || [];
        return rolePermissions.includes(action) || rolePermissions.includes('all');
    }, [state.profile, state.currentUser]);

    const canAccessModule = useCallback((module) => {
        const role = state.profile?.role || state.currentUser?.role;
        if (!role) return false;

        const rolePermissions = PERMISSIONS[module]?.[role] || [];
        return rolePermissions.length > 0;
    }, [state.profile, state.currentUser]);

    const isAdmin = useCallback(() => {
        const role = state.profile?.role || state.currentUser?.role;
        return role === ROLES.ADMIN;
    }, [state.profile, state.currentUser]);

    const isPartner = useCallback(() => {
        const role = state.profile?.role || state.currentUser?.role;
        return role === ROLES.PARTNER;
    }, [state.profile, state.currentUser]);

    const isTreasurer = useCallback(() => {
        const role = state.profile?.role || state.currentUser?.role;
        return role === ROLES.TREASURER;
    }, [state.profile, state.currentUser]);

    const isSeller = useCallback(() => {
        const role = state.profile?.role || state.currentUser?.role;
        return role === ROLES.SELLER;
    }, [state.profile, state.currentUser]);

    const getAssociatedProjects = useCallback(() => {
        return state.profile?.associated_projects || state.currentUser?.associatedProjects || [];
    }, [state.profile, state.currentUser]);

    const value = {
        state,
        // Auth
        login,
        logout,
        isAuthenticated: state.isAuthenticated,
        currentUser: state.profile || state.currentUser,
        isLoading: state.isLoading,
        error: state.error,
        isSupabaseMode: false,
        // User management
        registerUser,
        updateUser,
        deleteUser,
        getUserById,
        getUsersByRole,
        users: state.users,
        // Permissions
        hasPermission,
        canAccessModule,
        isAdmin,
        isPartner,
        isTreasurer,
        isSeller,
        getAssociatedProjects,
        // Constants
        ROLES,
        ROLE_LABELS
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom Hook
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
