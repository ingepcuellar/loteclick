import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { isAuthenticated as checkToken, setToken } from '../lib/apiClient';

// Roles and Permissions
export const ROLES = {
    ADMIN: 'admin',
    SELLER: 'seller',
    TREASURER: 'treasurer',
    PARTNER: 'partner',
    PARTNER_SECONDARY: 'partner_secondary' // Ítem 15: Socio Secundario (solo lectura)
};

export const ROLE_LABELS = {
    admin: 'Administrador',
    seller: 'Vendedor',
    treasurer: 'Tesorero',
    partner: 'Socio',
    partner_secondary: 'Socio Secundario' // Ítem 15
};

export const ROLE_ICONS = {
    admin: '🔐',
    seller: '💼',
    treasurer: '💰',
    partner: '🤝',
    partner_secondary: '👤' // Ítem 15
};

/**
 * Normalizes role data from various formats into a consistent array.
 * Handles: string ("seller"), legacy combo ("seller_treasurer"), JSON array, or actual array.
 */
export function getRolesArray(profile) {
    const raw = profile?.roles || profile?.role;
    if (!raw) return ['seller'];

    // Already an array
    if (Array.isArray(raw)) return raw;

    // Try JSON parse (stored as JSON string in DB)
    if (typeof raw === 'string' && raw.startsWith('[')) {
        try { return JSON.parse(raw); } catch { /* fall through */ }
    }

    // Legacy combo role
    if (raw === 'seller_treasurer') return ['seller', 'treasurer'];

    // Simple string
    return [raw];
}

// Permissions by module — granular RBAC (Ítem 11)
// Actions: 'view' | 'create' | 'edit' | 'delete' | 'view_own' | 'all'
// 'view_own' = can view but only records scoped to their own projects
// 'all'      = bypasses all checks (admin shortcut)
export const PERMISSIONS = {
    dashboard: {
        admin:     ['view', 'all'],
        seller:    [],
        treasurer: [],
        partner:   ['view', 'view_own']
    },
    projects: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    ['view'],             // read-only
        treasurer: [],                   // no access
        partner:   ['view', 'view_own']  // own projects only
    },
    clients: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],                   // no access (Ítem 7 / Ítem 11)
        treasurer: [],
        partner:   []
    },
    sales: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    ['view'],             // read-only
        treasurer: [],                   // no access
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    payments: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],                   // no access
        treasurer: ['view'],             // read-only
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    expenses: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],                   // no access
        treasurer: ['view'],             // read-only
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    treasury: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],
        treasurer: [],
        partner:   []
    },
    disbursements: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],                   // no access
        treasurer: ['view'],             // read-only
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    desistimientos: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],
        treasurer: ['view'],             // read-only
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    utilities: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],
        treasurer: ['view'],             // read-only
        partner:   ['view', 'view_own', 'create', 'edit', 'delete']
    },
    reports: {
        admin:     ['view', 'all'],
        seller:    ['view'],             // own-scope reports
        treasurer: ['view'],             // own-scope reports
        partner:   ['view', 'view_own']  // all report types, own data
    },
    contract_params: {
        admin:     ['view', 'edit'],
        seller:    ['view', 'edit'],
        treasurer: ['view', 'edit'],
        partner:   [],
        partner_secondary: []
    },
    users: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],
        treasurer: [],
        partner:   [],
        partner_secondary: []
    },
    bank_reconciliation: {
        admin:     ['view', 'create', 'edit', 'delete'],
        seller:    [],
        treasurer: ['view', 'create', 'edit'],
        partner:   [],
        partner_secondary: []
    }
};

// Ítem 15: Permisos de Socio Secundario (solo lectura de sus datos)
// Hereda visión de partner pero sin create/edit/delete
Object.keys(PERMISSIONS).forEach(module => {
    if (!PERMISSIONS[module].partner_secondary) {
        const partnerPerms = PERMISSIONS[module].partner || [];
        PERMISSIONS[module].partner_secondary = partnerPerms
            .filter(p => p !== 'create' && p !== 'edit' && p !== 'delete');
    }
});

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
                if (getRolesArray(profile).includes('admin')) {
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
            if (getRolesArray(data.user).includes('admin')) {
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
        return state.users.filter(u => getRolesArray(u).includes(role));
    }, [state.users]);

    const hasPermission = useCallback((module, action) => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        if (!userRoles.length) return false;

        // Merge permissions from all assigned roles
        const allPerms = new Set();
        for (const r of userRoles) {
            const perms = PERMISSIONS[module]?.[r] || [];
            perms.forEach(p => allPerms.add(p));
        }
        return allPerms.has(action) || allPerms.has('all');
    }, [state.profile, state.currentUser]);

    // hasAction — explicit CRUD check: 'view' | 'create' | 'edit' | 'delete'
    const hasAction = useCallback((module, action) => {
        return hasPermission(module, action);
    }, [hasPermission]);

    const canAccessModule = useCallback((module) => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        if (!userRoles.length) return false;

        // Check if any assigned role has permissions for this module
        for (const r of userRoles) {
            const perms = PERMISSIONS[module]?.[r] || [];
            if (perms.length > 0) return true;
        }
        return false;
    }, [state.profile, state.currentUser]);

    const isAdmin = useCallback(() => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        return userRoles.includes(ROLES.ADMIN);
    }, [state.profile, state.currentUser]);

    const isPartner = useCallback(() => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        return userRoles.includes(ROLES.PARTNER) || userRoles.includes(ROLES.PARTNER_SECONDARY);
    }, [state.profile, state.currentUser]);

    // Ítem 15: helper específico para Socio Secundario
    const isSecondaryPartner = useCallback(() => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        return userRoles.includes(ROLES.PARTNER_SECONDARY) && !userRoles.includes(ROLES.PARTNER);
    }, [state.profile, state.currentUser]);

    const isTreasurer = useCallback(() => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        return userRoles.includes(ROLES.TREASURER);
    }, [state.profile, state.currentUser]);

    const isSeller = useCallback(() => {
        const userRoles = getRolesArray(state.profile || state.currentUser);
        return userRoles.includes(ROLES.SELLER);
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
        hasAction,
        canAccessModule,
        isAdmin,
        isPartner,
        isSecondaryPartner, // Ítem 15
        isTreasurer,
        isSeller,
        getAssociatedProjects,
        getRolesArray,
        // Constants
        ROLES,
        ROLE_LABELS,
        ROLE_ICONS,
        PERMISSIONS // Ítem 15: exponer para UserForm
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
