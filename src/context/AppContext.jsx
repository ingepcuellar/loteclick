import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { saleService } from '../services/saleService';
import { paymentService } from '../services/paymentService';
import { expenseService } from '../services/expenseService';
import { installmentService } from '../services/installmentService';
import { utilityService } from '../services/utilityService';
import { useAuth } from './AuthContext';

// Initial State
const initialState = {
    projects: [],
    clients: [],
    sales: [],
    payments: [],
    expenses: [],
    utilityRegistrations: [],
    currentProject: null,
    isLoading: true,
    error: null,
};

// Action Types
const ACTIONS = {
    // Data Loading
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    LOAD_STATE: 'LOAD_STATE',

    // Projects
    SET_PROJECTS: 'SET_PROJECTS',
    ADD_PROJECT: 'ADD_PROJECT',
    UPDATE_PROJECT: 'UPDATE_PROJECT',
    DELETE_PROJECT: 'DELETE_PROJECT',
    SET_CURRENT_PROJECT: 'SET_CURRENT_PROJECT',

    // Clients
    SET_CLIENTS: 'SET_CLIENTS',
    ADD_CLIENT: 'ADD_CLIENT',
    UPDATE_CLIENT: 'UPDATE_CLIENT',
    DELETE_CLIENT: 'DELETE_CLIENT',

    // Sales
    SET_SALES: 'SET_SALES',
    ADD_SALE: 'ADD_SALE',
    UPDATE_SALE: 'UPDATE_SALE',
    DELETE_SALE: 'DELETE_SALE',

    // Payments
    SET_PAYMENTS: 'SET_PAYMENTS',
    ADD_PAYMENT: 'ADD_PAYMENT',
    UPDATE_PAYMENT: 'UPDATE_PAYMENT',
    DELETE_PAYMENT: 'DELETE_PAYMENT',

    // Expenses
    SET_EXPENSES: 'SET_EXPENSES',
    ADD_EXPENSE: 'ADD_EXPENSE',
    UPDATE_EXPENSE: 'UPDATE_EXPENSE',
    DELETE_EXPENSE: 'DELETE_EXPENSE',

    // Utility Registrations (independent)
    SET_UTILITY_REGISTRATIONS: 'SET_UTILITY_REGISTRATIONS',
    ADD_UTILITY_REGISTRATION: 'ADD_UTILITY_REGISTRATION',
    UPDATE_UTILITY_REGISTRATION: 'UPDATE_UTILITY_REGISTRATION',
    DELETE_UTILITY_REGISTRATION: 'DELETE_UTILITY_REGISTRATION',
};

// Reducer
function appReducer(state, action) {
    switch (action.type) {
        // Loading & Error
        case ACTIONS.SET_LOADING:
            return { ...state, isLoading: action.payload };
        case ACTIONS.SET_ERROR:
            return { ...state, error: action.payload, isLoading: false };
        case ACTIONS.LOAD_STATE:
            return { ...state, ...action.payload, isLoading: false };

        // Projects
        case ACTIONS.SET_PROJECTS:
            return { ...state, projects: action.payload };
        case ACTIONS.ADD_PROJECT:
            return { ...state, projects: [...state.projects, action.payload] };
        case ACTIONS.UPDATE_PROJECT:
            return {
                ...state,
                projects: state.projects.map(p =>
                    p.id === action.payload.id ? action.payload : p
                ),
            };
        case ACTIONS.DELETE_PROJECT:
            return {
                ...state,
                projects: state.projects.filter(p => p.id !== action.payload),
                sales: state.sales.filter(s => s.projectId !== action.payload && s.project_id !== action.payload),
            };
        case ACTIONS.SET_CURRENT_PROJECT:
            return { ...state, currentProject: action.payload };

        // Clients
        case ACTIONS.SET_CLIENTS:
            return { ...state, clients: action.payload };
        case ACTIONS.ADD_CLIENT:
            return { ...state, clients: [...state.clients, action.payload] };
        case ACTIONS.UPDATE_CLIENT:
            return {
                ...state,
                clients: state.clients.map(c =>
                    c.id === action.payload.id ? action.payload : c
                ),
            };
        case ACTIONS.DELETE_CLIENT:
            return {
                ...state,
                clients: state.clients.filter(c => c.id !== action.payload),
            };

        // Sales
        case ACTIONS.SET_SALES:
            return { ...state, sales: action.payload };
        case ACTIONS.ADD_SALE:
            return { ...state, sales: [...state.sales, action.payload] };
        case ACTIONS.UPDATE_SALE:
            return {
                ...state,
                sales: state.sales.map(s =>
                    s.id === action.payload.id ? action.payload : s
                ),
            };
        case ACTIONS.DELETE_SALE:
            return {
                ...state,
                sales: state.sales.filter(s => s.id !== action.payload),
                payments: state.payments.filter(p => p.saleId !== action.payload && p.sale_id !== action.payload),
            };

        // Payments
        case ACTIONS.SET_PAYMENTS:
            return { ...state, payments: action.payload };
        case ACTIONS.ADD_PAYMENT:
            return { ...state, payments: [...state.payments, action.payload] };
        case ACTIONS.UPDATE_PAYMENT:
            return {
                ...state,
                payments: state.payments.map(p =>
                    p.id === action.payload.id ? action.payload : p
                ),
            };
        case ACTIONS.DELETE_PAYMENT:
            return {
                ...state,
                payments: state.payments.filter(p => p.id !== action.payload),
            };

        // Expenses
        case ACTIONS.SET_EXPENSES:
            return { ...state, expenses: action.payload };
        case ACTIONS.ADD_EXPENSE:
            return { ...state, expenses: [...state.expenses, action.payload] };
        case ACTIONS.UPDATE_EXPENSE:
            return {
                ...state,
                expenses: state.expenses.map(e =>
                    e.id === action.payload.id ? action.payload : e
                ),
            };
        case ACTIONS.DELETE_EXPENSE:
            return {
                ...state,
                expenses: state.expenses.filter(e => e.id !== action.payload),
            };

        // Utility Registrations (independent - no project accounting impact)
        case ACTIONS.SET_UTILITY_REGISTRATIONS:
            return { ...state, utilityRegistrations: action.payload };
        case ACTIONS.ADD_UTILITY_REGISTRATION:
            return { ...state, utilityRegistrations: [...state.utilityRegistrations, action.payload] };
        case ACTIONS.UPDATE_UTILITY_REGISTRATION:
            return {
                ...state,
                utilityRegistrations: state.utilityRegistrations.map(u =>
                    u.id === action.payload.id ? action.payload : u
                ),
            };
        case ACTIONS.DELETE_UTILITY_REGISTRATION:
            return {
                ...state,
                utilityRegistrations: state.utilityRegistrations.filter(u => u.id !== action.payload),
            };

        default:
            return state;
    }
}

// Create Context
const AppContext = createContext();

// Provider Component
export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [initialized, setInitialized] = useState(false);

    // Get auth state - wait for auth to be ready before loading data
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    // Load data when auth is ready
    useEffect(() => {
        console.log('[AppContext] useEffect triggered:', { authLoading, isAuthenticated });

        // Don't load data if auth is still loading
        if (authLoading) {
            console.log('[AppContext] Auth still loading, waiting...');
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });
            return;
        }

        // Only load data when authenticated
        if (!isAuthenticated) {
            console.log('[AppContext] Not authenticated, initialized:', initialized);
            if (!initialized) {
                dispatch({ type: ACTIONS.SET_LOADING, payload: false });
            }
            return;
        }

        const loadData = async () => {
            console.log('[AppContext] Starting to load data...');
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });

            try {
                console.log('[AppContext] Fetching from API...');
                const [projectsRes, clientsRes, salesRes, paymentsRes, expensesRes, utilityRes] = await Promise.all([
                    projectService.getAll(),
                    clientService.getAll(),
                    saleService.getAll(),
                    paymentService.getAll(),
                    expenseService.getAll(),
                    utilityService.getAll(),
                ]);

                console.log('[AppContext] Data fetched:', {
                    projects: projectsRes.data?.length,
                    clients: clientsRes.data?.length,
                    sales: salesRes.data?.length,
                    payments: paymentsRes.data?.length,
                    expenses: expensesRes.data?.length,
                    utilities: utilityRes.data?.length
                });

                // Normalize data to frontend format
                const normalizeSales = (sales) => {
                    return (sales || []).map(sale => ({
                        ...sale,
                        totalPrice: sale.sale_price || sale.totalPrice,
                        saleDate: sale.sale_date || sale.saleDate,
                        createdAt: sale.created_at || sale.createdAt,
                        paymentType: sale.payment_type === 'credit' ? 'installments' : (sale.payment_type || sale.paymentType || 'cash'),
                        downPayment: sale.down_payment || sale.downPayment || 0,
                        numberOfInstallments: sale.installments || sale.numberOfInstallments || 1,
                        lotNumber: sale.lot?.number || sale.lotNumber,
                        projectId: sale.project_id || sale.projectId,
                        lotId: sale.lot_id || sale.lotId,
                        clientId: sale.client_id || sale.clientId,
                        commissionAgent: sale.commission_agent || sale.commissionAgent || null
                    }));
                };

                const normalizeClients = (clients) => {
                    return (clients || []).map(client => ({
                        ...client,
                        fullName: client.name || client.fullName,
                        createdAt: client.created_at || client.createdAt
                    }));
                };

                const normalizePayments = (payments) => {
                    return (payments || []).map(payment => ({
                        ...payment,
                        paymentDate: payment.payment_date || payment.paymentDate,
                        saleId: payment.sale_id || payment.saleId,
                        receiptImage: payment.receipt_image || payment.receiptImage,
                        createdAt: payment.created_at || payment.createdAt
                    }));
                };

                const normalizeExpenses = (expenses) => {
                    return (expenses || []).map(expense => ({
                        ...expense,
                        projectId: expense.project_id || expense.projectId,
                        partnerId: expense.partner_id || expense.partnerId,
                        date: expense.expense_date || expense.date,
                        createdAt: expense.created_at || expense.createdAt
                    }));
                };

                const normalizeUtilities = (utilities) => {
                    return (utilities || []).map(u => ({
                        ...u,
                        saleId: u.sale_id || u.saleId,
                        serviceType: u.service_type || u.serviceType,
                        chargeDate: u.charge_date || u.chargeDate,
                        paidDate: u.paid_date || u.paidDate,
                        createdAt: u.created_at || u.createdAt
                    }));
                };

                dispatch({
                    type: ACTIONS.LOAD_STATE,
                    payload: {
                        projects: projectsRes.data || [],
                        clients: normalizeClients(clientsRes.data),
                        sales: normalizeSales(salesRes.data),
                        payments: normalizePayments(paymentsRes.data),
                        expenses: normalizeExpenses(expensesRes.data),
                        utilityRegistrations: normalizeUtilities(utilityRes.data),
                    }
                });
                console.log('[AppContext] Data loaded successfully!');
            } catch (error) {
                console.error('[AppContext] Error loading data:', error);
                dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
            }

            setInitialized(true);
        };

        loadData();
    }, [authLoading, isAuthenticated]);

    // Helper Functions
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ============================================
    // PROJECT ACTIONS
    // ============================================
    const addProject = useCallback(async (project) => {
        const { data, error } = await projectService.create(project);
        if (error) {
            console.error('Error creating project:', error);
            return null;
        }
        dispatch({ type: ACTIONS.ADD_PROJECT, payload: data });
        return data;
    }, []);

    const updateProject = useCallback(async (project) => {
        const { data, error } = await projectService.update(project.id, project);
        if (error) {
            console.error('Error updating project:', error);
            return;
        }
        dispatch({ type: ACTIONS.UPDATE_PROJECT, payload: data });
    }, []);

    const deleteProject = useCallback(async (projectId) => {
        const { error } = await projectService.delete(projectId);
        if (error) {
            console.error('Error deleting project:', error);
            return;
        }
        dispatch({ type: ACTIONS.DELETE_PROJECT, payload: projectId });
    }, []);

    const setCurrentProject = useCallback((project) => {
        dispatch({ type: ACTIONS.SET_CURRENT_PROJECT, payload: project });
    }, []);

    const getProjectById = useCallback((id) => {
        return state.projects.find(p => p.id === id);
    }, [state.projects]);

    // ============================================
    // CLIENT ACTIONS
    // ============================================
    const addClient = useCallback(async (client) => {
        const { data, error } = await clientService.create(client);
        if (error) {
            console.error('Error creating client:', error);
            return null;
        }
        // Normalize the response data to frontend format
        const normalizedClient = {
            ...data,
            fullName: data.name || data.fullName
        };
        dispatch({ type: ACTIONS.ADD_CLIENT, payload: normalizedClient });
        return normalizedClient;
    }, []);

    const updateClient = useCallback(async (client) => {
        const { data, error } = await clientService.update(client.id, client);
        if (error) {
            console.error('Error updating client:', error);
            return;
        }
        dispatch({ type: ACTIONS.UPDATE_CLIENT, payload: data });
    }, []);

    const deleteClient = useCallback(async (clientId) => {
        const { error } = await clientService.delete(clientId);
        if (error) {
            console.error('Error deleting client:', error);
            return;
        }
        dispatch({ type: ACTIONS.DELETE_CLIENT, payload: clientId });
    }, []);

    const getClientById = useCallback((id) => {
        return state.clients.find(c => c.id === id);
    }, [state.clients]);

    // ============================================
    // SALE ACTIONS
    // ============================================
    const addSale = useCallback(async (sale) => {
        // Map frontend fields to database fields
        const saleData = {
            project_id: sale.projectId,
            lot_id: sale.lotId,
            client_id: sale.clientId,
            sale_price: sale.totalPrice,
            sale_date: sale.saleDate || new Date().toISOString().split('T')[0],
            payment_type: sale.paymentType === 'installments' ? 'credit' : (sale.paymentType || 'cash'),
            down_payment: sale.downPayment || 0,
            installments: sale.numberOfInstallments || 1,
            notes: sale.notes,
            commission_agent: sale.commissionAgent || null,
            commission_agent_id: sale.commissionAgentId || null,
            commission_amount: sale.commissionAmount || null,
            original_price: sale.originalPrice || null,
            discount_amount: sale.discountAmount || null,
            discount_authorized_by: sale.discountAuthorizedBy || null,
            discount_partner_name: sale.discountPartnerName || null,
            lot_number: sale.lotNumber || null,
            client_name: sale.clientName || null,
            sale_lots: sale.saleLots || null,
        };
        const { data, error } = await saleService.create(saleData);
        if (error) {
            console.error('Error creating sale:', error);
            return null;
        }
        // Normalize the response data to frontend format
        const normalizedSale = {
            ...data,
            totalPrice: data.sale_price || data.totalPrice,
            saleDate: data.sale_date || data.saleDate,
            paymentType: data.payment_type === 'credit' ? 'installments' : (data.payment_type || 'cash'),
            downPayment: data.down_payment || data.downPayment || 0,
            numberOfInstallments: data.installments || data.numberOfInstallments || 1,
            lotNumber: sale.lotNumber,
            projectId: data.project_id || data.projectId,
            lotId: data.lot_id || data.lotId,
            clientId: data.client_id || data.clientId,
            commissionAgent: data.commission_agent || sale.commissionAgent || null
        };

        // Generate installments for credit sales
        if ((sale.paymentType === 'installments' || sale.paymentType === 'credit') && sale.numberOfInstallments > 1) {
            const totalAfterDownPayment = parseFloat(sale.totalPrice) - parseFloat(sale.downPayment || 0);
            const startDate = sale.saleDate || new Date().toISOString().split('T')[0];

            try {
                const downPaymentAmount = parseFloat(sale.downPayment || 0);
                const { error: installmentError } = await installmentService.generateInstallments(
                    data.id,
                    totalAfterDownPayment,
                    sale.numberOfInstallments,
                    startDate,
                    downPaymentAmount
                );
                if (installmentError) {
                    console.error('Error generating installments:', installmentError);
                } else {
                    console.log(`Generated ${sale.numberOfInstallments} installments for sale ${data.id}`);
                }
            } catch (err) {
                console.error('Error generating installments:', err);
            }
        }

        dispatch({ type: ACTIONS.ADD_SALE, payload: normalizedSale });
        return normalizedSale;
    }, []);

    const updateSale = useCallback(async (sale) => {
        const { data, error } = await saleService.update(sale.id, sale);
        if (error) {
            console.error('Error updating sale:', error);
            return;
        }
        dispatch({ type: ACTIONS.UPDATE_SALE, payload: data });
    }, []);

    const deleteSale = useCallback(async (saleId) => {
        const { error } = await saleService.delete(saleId);
        if (error) {
            console.error('Error deleting sale:', error);
            return;
        }
        dispatch({ type: ACTIONS.DELETE_SALE, payload: saleId });
    }, []);

    const getSaleById = useCallback((id) => {
        return state.sales.find(s => s.id === id);
    }, [state.sales]);

    const getSalesByProject = useCallback((projectId) => {
        return state.sales.filter(s => s.projectId === projectId || s.project_id === projectId);
    }, [state.sales]);

    const getSalesByClient = useCallback((clientId) => {
        return state.sales.filter(s => s.clientId === clientId || s.client_id === clientId);
    }, [state.sales]);

    // ============================================
    // PAYMENT ACTIONS
    // ============================================
    const addPayment = useCallback(async (payment) => {
        const paymentData = {
            sale_id: payment.saleId,
            amount: payment.amount,
            payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
            payment_method: payment.paymentMethod || 'cash',
            receipt_image: payment.receiptImage || null,
            notes: payment.notes,
        };
        const { data, error } = await paymentService.create(paymentData);
        if (error) {
            console.error('Error creating payment:', error);
            return null;
        }
        // Normalize the response data to frontend format
        const normalizedPayment = {
            ...data,
            paymentDate: data.payment_date || data.paymentDate,
            saleId: data.sale_id || data.saleId
        };
        dispatch({ type: ACTIONS.ADD_PAYMENT, payload: normalizedPayment });
        return normalizedPayment;
    }, []);

    const updatePayment = useCallback(async (payment) => {
        const { data, error } = await paymentService.update(payment.id, payment);
        if (error) {
            console.error('Error updating payment:', error);
            return;
        }
        dispatch({ type: ACTIONS.UPDATE_PAYMENT, payload: data });
    }, []);

    const deletePayment = useCallback(async (paymentId) => {
        const { error } = await paymentService.delete(paymentId);
        if (error) {
            console.error('Error deleting payment:', error);
            return;
        }
        dispatch({ type: ACTIONS.DELETE_PAYMENT, payload: paymentId });
    }, []);

    const getPaymentsBySale = useCallback((saleId) => {
        return state.payments.filter(p => p.saleId === saleId || p.sale_id === saleId);
    }, [state.payments]);

    const getTotalPaidBySale = useCallback((saleId) => {
        const payments = getPaymentsBySale(saleId);
        return payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    }, [getPaymentsBySale]);

    const getPendingAmount = useCallback((saleId) => {
        const sale = getSaleById(saleId);
        if (!sale) return 0;
        const totalPrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
        return totalPrice - getTotalPaidBySale(saleId);
    }, [getSaleById, getTotalPaidBySale]);

    // ============================================
    // EXPENSE ACTIONS
    // ============================================
    const addExpense = useCallback(async (expense) => {
        const expenseData = {
            project_id: expense.projectId,
            partner_id: expense.partnerId || null,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            expense_date: expense.date || new Date().toISOString().split('T')[0],
            notes: expense.notes,
        };
        const { data, error } = await expenseService.create(expenseData);
        if (error) {
            console.error('Error creating expense:', error);
            return null;
        }
        dispatch({ type: ACTIONS.ADD_EXPENSE, payload: data });
        return data;
    }, []);

    const updateExpense = useCallback(async (expense) => {
        const { data, error } = await expenseService.update(expense.id, expense);
        if (error) {
            console.error('Error updating expense:', error);
            return;
        }
        dispatch({ type: ACTIONS.UPDATE_EXPENSE, payload: data });
    }, []);

    const deleteExpense = useCallback(async (expenseId) => {
        const { error } = await expenseService.delete(expenseId);
        if (error) {
            console.error('Error deleting expense:', error);
            return;
        }
        dispatch({ type: ACTIONS.DELETE_EXPENSE, payload: expenseId });
    }, []);

    const getExpenseById = useCallback((id) => {
        return state.expenses.find(e => e.id === id);
    }, [state.expenses]);

    const getExpensesByProject = useCallback((projectId) => {
        return state.expenses.filter(e => e.projectId === projectId || e.project_id === projectId);
    }, [state.expenses]);

    const getExpensesByPartner = useCallback((partnerId) => {
        return state.expenses.filter(e => e.partnerId === partnerId || e.partner_id === partnerId);
    }, [state.expenses]);

    const getTotalExpensesByProject = useCallback((projectId) => {
        const expenses = getExpensesByProject(projectId);
        return expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    }, [getExpensesByProject]);

    const getProjectBalance = useCallback((projectId) => {
        const sales = getSalesByProject(projectId);
        const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalPrice || s.sale_price || 0), 0);
        const totalExpenses = getTotalExpensesByProject(projectId);
        return totalRevenue - totalExpenses;
    }, [getSalesByProject, getTotalExpensesByProject]);

    // ============================================
    // STATISTICS
    // ============================================
    const getStats = useCallback(() => {
        const totalProjects = state.projects.length;
        const totalClients = state.clients.length;
        const totalSales = state.sales.length;

        const totalRevenue = state.sales.reduce((sum, s) =>
            sum + parseFloat(s.totalPrice || s.sale_price || 0), 0
        );

        const totalCollected = state.payments.reduce((sum, p) =>
            sum + parseFloat(p.amount || 0), 0
        );

        const totalPending = totalRevenue - totalCollected;

        const totalLots = state.projects.reduce((sum, p) =>
            sum + (p.lots?.length || 0), 0
        );

        const soldLots = state.projects.reduce((sum, p) =>
            sum + (p.lots?.filter(l => l.status === 'sold').length || 0), 0
        );

        const availableLots = totalLots - soldLots;

        const totalExpenses = state.expenses.reduce((sum, e) =>
            sum + parseFloat(e.amount || 0), 0
        );

        const netProfit = totalCollected - totalExpenses;

        return {
            totalProjects,
            totalClients,
            totalSales,
            totalRevenue,
            totalCollected,
            totalPending,
            totalLots,
            soldLots,
            availableLots,
            totalExpenses,
            netProfit,
        };
    }, [state]);

    // ============================================
    // REFRESH DATA
    // ============================================
    const refreshData = useCallback(async () => {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });

        try {
            const [projectsRes, clientsRes, salesRes, paymentsRes, expensesRes, utilityRes] = await Promise.all([
                projectService.getAll(),
                clientService.getAll(),
                saleService.getAll(),
                paymentService.getAll(),
                expenseService.getAll(),
                utilityService.getAll(),
            ]);

            dispatch({
                type: ACTIONS.LOAD_STATE,
                payload: {
                    projects: projectsRes.data || [],
                    clients: clientsRes.data || [],
                    sales: salesRes.data || [],
                    payments: paymentsRes.data || [],
                    expenses: expensesRes.data || [],
                    utilityRegistrations: utilityRes.data || [],
                }
            });
        } catch (error) {
            console.error('Error refreshing data:', error);
            dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        }
    }, []);

    const value = {
        state,
        isLoading: state.isLoading,
        error: state.error,
        isSupabaseMode: false,
        // Projects
        addProject,
        updateProject,
        deleteProject,
        setCurrentProject,
        getProjectById,
        // Clients
        addClient,
        updateClient,
        deleteClient,
        getClientById,
        // Sales
        addSale,
        updateSale,
        deleteSale,
        getSaleById,
        getSalesByProject,
        getSalesByClient,
        // Payments
        addPayment,
        updatePayment,
        deletePayment,
        getPaymentsBySale,
        getTotalPaidBySale,
        getPendingAmount,
        // Expenses
        addExpense,
        updateExpense,
        deleteExpense,
        getExpenseById,
        getExpensesByProject,
        getExpensesByPartner,
        getTotalExpensesByProject,
        getProjectBalance,
        // Utility Registrations (independent)
        addUtilityRegistration: async (registration) => {
            const regData = {
                sale_id: registration.saleId,
                service_type: registration.serviceType,
                amount: registration.amount,
                status: registration.status || 'pending',
                charge_date: registration.chargeDate || new Date().toISOString().split('T')[0],
                paid_date: registration.paidDate || null,
                notes: registration.notes,
            };
            const { data, error } = await utilityService.create(regData);
            if (error) { console.error('Error creating utility registration:', error); return null; }
            const normalized = { ...data, saleId: data.sale_id, serviceType: data.service_type, chargeDate: data.charge_date, paidDate: data.paid_date, createdAt: data.created_at };
            dispatch({ type: ACTIONS.ADD_UTILITY_REGISTRATION, payload: normalized });
            return normalized;
        },
        updateUtilityRegistration: async (registration) => {
            const regData = {
                sale_id: registration.saleId || registration.sale_id,
                service_type: registration.serviceType || registration.service_type,
                amount: registration.amount,
                status: registration.status,
                charge_date: registration.chargeDate || registration.charge_date,
                paid_date: registration.paidDate || registration.paid_date || null,
                notes: registration.notes,
            };
            const { data, error } = await utilityService.update(registration.id, regData);
            if (error) { console.error('Error updating utility registration:', error); return; }
            const normalized = { ...data, saleId: data.sale_id, serviceType: data.service_type, chargeDate: data.charge_date, paidDate: data.paid_date, createdAt: data.created_at };
            dispatch({ type: ACTIONS.UPDATE_UTILITY_REGISTRATION, payload: normalized });
        },
        deleteUtilityRegistration: async (id) => {
            const { error } = await utilityService.delete(id);
            if (error) { console.error('Error deleting utility registration:', error); return; }
            dispatch({ type: ACTIONS.DELETE_UTILITY_REGISTRATION, payload: id });
        },
        getUtilityRegistrationsBySale: (saleId) => {
            return state.utilityRegistrations.filter(u => u.saleId === saleId || u.sale_id === saleId);
        },
        // Installments
        getInstallmentsBySale: async (saleId) => {
            return await installmentService.getBySale(saleId);
        },
        getPendingInstallmentsBySale: async (saleId) => {
            const result = await installmentService.getBySale(saleId);
            if (result.data) {
                result.data = result.data.filter(i => i.status !== 'paid');
            }
            return result;
        },
        markInstallmentAsPaid: async (installmentId, paymentId, paidAmount) => {
            return await installmentService.markAsPaid(installmentId, paymentId);
        },
        calculateRestructureOptions: async (saleId, paymentAmount) => {
            return await installmentService.calculateRestructure(saleId, paymentAmount);
        },
        applyRestructure: async (saleId, option, restructureData, paymentId) => {
            const optionData = option === 'reduceTime' ? restructureData.reduceTime : restructureData.reducePayment;
            const startDate = new Date().toISOString().split('T')[0];
            return await installmentService.restructurePayments(saleId, optionData.newNumInstallments, startDate);
        },
        autoRedistributeInstallments: async (saleId, paymentAmount, paymentId) => {
            return await installmentService.autoRedistribute(saleId, paymentAmount, paymentId);
        },
        // Stats
        getStats,
        // Utils
        generateId,
        refreshData,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

// Custom Hook
export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}

export default AppContext;
