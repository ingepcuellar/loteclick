import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { saleService } from '../services/saleService';
import { paymentService } from '../services/paymentService';
import { expenseService } from '../services/expenseService';
import { installmentService } from '../services/installmentService';
import { utilityService } from '../services/utilityService';
import { desistimientoService } from '../services/desistimientoService';
import { lotService } from '../services/lotService';
import { useAuth } from './AuthContext';
import { todayBogota } from '../lib/formatters';

// Initial State
const initialState = {
    projects: [],
    clients: [],
    sales: [],
    payments: [],
    expenses: [],
    utilityRegistrations: [],
    desistimientos: [],
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

    // Desistimientos
    SET_DESISTIMIENTOS: 'SET_DESISTIMIENTOS',
    ADD_DESISTIMIENTO: 'ADD_DESISTIMIENTO',
    UPDATE_DESISTIMIENTO: 'UPDATE_DESISTIMIENTO',
    DELETE_DESISTIMIENTO: 'DELETE_DESISTIMIENTO',
    MARK_SALE_DESISTIDA: 'MARK_SALE_DESISTIDA',
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
        case ACTIONS.ADD_SALE: {
            // Update ALL lot statuses in state.projects (primary lot + all saleLots)
            const newSale = action.payload;
            const newLotStatus = (newSale.paymentType === 'installments' || newSale.paymentType === 'credit') 
                ? 'pending_initial' 
                : 'sold';
            // Collect all lot IDs from this sale
            const allSoldLotIds = new Set();
            if (newSale.lotId || newSale.lot_id) {
                allSoldLotIds.add(newSale.lotId || newSale.lot_id);
            }
            // Include additional lots from grouped sales
            (newSale.saleLotIds || []).forEach(id => allSoldLotIds.add(id));

            const updatedProjectsOnAdd = state.projects.map(p => {
                if (p.id !== (newSale.projectId || newSale.project_id)) return p;
                const updatedLots = (p.lots || []).map(l => 
                    allSoldLotIds.has(l.id) ? { ...l, status: newLotStatus } : l
                );
                return { ...p, lots: updatedLots };
            });
            return { 
                ...state, 
                sales: [...state.sales, newSale],
                projects: updatedProjectsOnAdd
            };
        }
        case ACTIONS.UPDATE_SALE:
            return {
                ...state,
                sales: state.sales.map(s =>
                    s.id === action.payload.id ? action.payload : s
                ),
            };
        case ACTIONS.DELETE_SALE: {
            // Restore lot to available when sale is deleted
            const deletedSale = state.sales.find(s => s.id === action.payload);
            let updatedProjectsOnDelete = state.projects;
            if (deletedSale) {
                updatedProjectsOnDelete = state.projects.map(p => {
                    if (p.id !== (deletedSale.projectId || deletedSale.project_id)) return p;
                    const updatedLots = (p.lots || []).map(l =>
                        l.id === (deletedSale.lotId || deletedSale.lot_id)
                            ? { ...l, status: 'available' }
                            : l
                    );
                    return { ...p, lots: updatedLots };
                });
            }
            return {
                ...state,
                sales: state.sales.filter(s => s.id !== action.payload),
                payments: state.payments.filter(p => p.saleId !== action.payload && p.sale_id !== action.payload),
                projects: updatedProjectsOnDelete,
            };
        }

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

        // Desistimientos
        case ACTIONS.SET_DESISTIMIENTOS:
            return { ...state, desistimientos: action.payload };
        case ACTIONS.ADD_DESISTIMIENTO:
            return { ...state, desistimientos: [action.payload, ...state.desistimientos] };
        case ACTIONS.UPDATE_DESISTIMIENTO:
            return {
                ...state,
                desistimientos: state.desistimientos.map(d =>
                    d.id === action.payload.id ? action.payload : d
                ),
            };
        case ACTIONS.DELETE_DESISTIMIENTO:
            return {
                ...state,
                desistimientos: state.desistimientos.filter(d => d.id !== action.payload),
            };
        // Marca una venta como desistida en el estado local (sin eliminarla)
        case ACTIONS.MARK_SALE_DESISTIDA: {
            const desistidaSaleId = action.payload;
            const desistidaSale = state.sales.find(s => s.id === desistidaSaleId);
            // Liberar el lote en el estado de proyectos
            let updatedProjectsDesistida = state.projects;
            if (desistidaSale) {
                updatedProjectsDesistida = state.projects.map(p => {
                    if (p.id !== (desistidaSale.projectId || desistidaSale.project_id)) return p;
                    const updatedLots = (p.lots || []).map(l =>
                        l.id === (desistidaSale.lotId || desistidaSale.lot_id)
                            ? { ...l, status: 'available' }
                            : l
                    );
                    return { ...p, lots: updatedLots };
                });
            }
            return {
                ...state,
                sales: state.sales.map(s =>
                    s.id === desistidaSaleId ? { ...s, status: 'desistida' } : s
                ),
                projects: updatedProjectsDesistida,
            };
        }

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

        refreshData();
    }, [authLoading, isAuthenticated, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

    const refreshData = useCallback(async () => {
        console.log('[AppContext] Starting to load data...');
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });

        try {
                console.log('[AppContext] Fetching from API...');

                // Fetch each endpoint independently — one failure won't crash the whole app
                const safeGet = async (fetchFn, name) => {
                    try {
                        const res = await fetchFn();
                        if (res.error) console.warn(`[AppContext] ${name} returned error:`, res.error);
                        return res;
                    } catch (err) {
                        console.error(`[AppContext] ${name} threw:`, err);
                        return { data: [], error: err.message };
                    }
                };

                const [projectsRes, clientsRes, salesRes, paymentsRes, expensesRes, utilityRes] = await Promise.all([
                    safeGet(() => projectService.getAll(), 'projects'),
                    safeGet(() => clientService.getAll(), 'clients'),
                    safeGet(() => saleService.getAll(), 'sales'),
                    safeGet(() => paymentService.getAll(), 'payments'),
                    safeGet(() => expenseService.getAll(), 'expenses'),
                    safeGet(() => utilityService.getAll(), 'utilities'),
                ]);

                // Fetch desistimientos separately so a missing table doesn't crash the whole app
                let desistimientosRes = { data: [] };
                try {
                    desistimientosRes = await desistimientoService.getAll();
                } catch (desistErr) {
                    console.warn('[AppContext] Could not load desistimientos (table may not exist yet):', desistErr);
                }

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
                    return (sales || []).map(sale => {
                        // For grouped 'Venta Única' sales, build lot number from sale_lots
                        const rawSaleLots = sale.sale_lots || [];
                        const lotNumber = rawSaleLots.length > 1
                            ? rawSaleLots.map(sl => sl.lot_number).join(', ')
                            : (sale.lot?.number || sale.lot_number || sale.lotNumber);

                        return {
                            ...sale,
                            totalPrice: sale.sale_price || sale.totalPrice,
                            saleDate: sale.sale_date || sale.saleDate,
                            createdAt: sale.created_at || sale.createdAt,
                            paymentType: sale.payment_type === 'credit' ? 'installments' : (sale.payment_type || sale.paymentType || 'cash'),
                            downPayment: sale.down_payment || sale.downPayment || 0,
                            numberOfInstallments: sale.installments || sale.numberOfInstallments || 1,
                            lotNumber,
                            lotManzana: sale.lot?.manzana || sale.lot_manzana || sale.lotManzana || null,
                            lotEtapaName: sale.lot?.etapa_name || sale.lot?.etapaName || sale.lot_etapa_name || sale.lotEtapaName || null,
                            projectId: sale.project_id || sale.projectId,
                            lotId: sale.lot_id || sale.lotId,
                            clientId: sale.client_id || sale.clientId,
                            commissionAgent: sale.commission_agent || sale.commissionAgent || null,
                            saleLots: rawSaleLots,
                            // Status: 'active' | 'desistida' | 'completada'
                            status: sale.status || 'active',
                        };
                    });
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
                        paymentMethod: payment.payment_method || payment.paymentMethod || 'cash',
                        createdAt: payment.created_at || payment.createdAt
                    }));
                };

                const normalizeExpenses = (expenses) => {
                    return (expenses || []).map(expense => ({
                        ...expense,
                        projectId: expense.project_id || expense.projectId,
                        partnerId: expense.partner_id || expense.partnerId,
                        date: expense.expense_date || expense.date,
                        attachment: expense.attachment || null,
                        paymentMethod: expense.payment_method || expense.paymentMethod || 'cash',
                        bankAccountId: expense.bank_account_id || expense.bankAccountId || null,
                        selectedLots: expense.selected_lots ? (typeof expense.selected_lots === 'string' ? JSON.parse(expense.selected_lots) : expense.selected_lots) : null,
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
                        desistimientos: desistimientosRes.data || [],
                    }
                });
                console.log('[AppContext] Data loaded successfully!');
            } catch (error) {
                console.error('[AppContext] Error loading data:', error);
                dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
            }

            setInitialized(true);
    }, [isAuthenticated]);

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

    // Add a single lot to an existing project (without full wizard)
    const addLot = useCallback(async (lotData) => {
        const { data, error } = await lotService.create(lotData);
        if (error) {
            throw new Error(typeof error === 'object' ? (error.message || JSON.stringify(error)) : error);
        }
        // Update the project's lots array in state
        dispatch({
            type: ACTIONS.UPDATE_PROJECT,
            payload: {
                ...state.projects.find(p => p.id === (lotData.project_id || lotData.projectId)),
                lots: [
                    ...(state.projects.find(p => p.id === (lotData.project_id || lotData.projectId))?.lots || []),
                    data
                ]
            }
        });
        return data;
    }, [state.projects]);

    // Delete a single lot (only available lots)
    const deleteLot = useCallback(async (lotId, projectId) => {
        const { error } = await lotService.delete(lotId);
        if (error) {
            throw new Error(typeof error === 'object' ? (error.message || JSON.stringify(error)) : error);
        }
        // Remove lot from project state
        const project = state.projects.find(p => p.id === projectId);
        if (project) {
            dispatch({
                type: ACTIONS.UPDATE_PROJECT,
                payload: { ...project, lots: (project.lots || []).filter(l => l.id !== lotId) }
            });
        }
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
            sale_date: sale.saleDate || todayBogota(),
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
            include_acometida: sale.includeAcometida || false,
            acometida_value: sale.acometidaValue || 0,
            acometida_paid: sale.acometidaPaid || false,
            lot_number: sale.lotNumber || null,
            client_name: sale.clientName || null,
            sale_lots: sale.saleLots || null,
        };
        const { data, error } = await saleService.create(saleData);
        if (error) {
            console.error('Error creating sale:', error);
            // Propagate error so the caller can show the message to the user
            throw new Error(error.message || 'Error al crear la venta');
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
            const startDate = sale.saleDate || todayBogota();

            try {
                const downPaymentAmount = parseFloat(sale.downPayment || 0);
                const separeAmount = parseFloat(sale.separeAmount || 0);
                const { error: installmentError } = await installmentService.generateInstallments(
                    data.id,
                    totalAfterDownPayment,
                    sale.numberOfInstallments,
                    startDate,
                    downPaymentAmount,
                    separeAmount,
                    sale.customPlan || null
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

        // Build list of ALL sold lot IDs (primary + saleLots) for the reducer
        const allSaleLotIds = [];
        if (sale.saleLots && Array.isArray(sale.saleLots)) {
            sale.saleLots.forEach(sl => {
                const id = sl.lotId || sl.lot_id;
                if (id) allSaleLotIds.push(id);
            });
        }

        dispatch({ 
            type: ACTIONS.ADD_SALE, 
            payload: { 
                ...normalizedSale,
                saleLotIds: allSaleLotIds  // extra lot IDs for reducer to mark as sold
            } 
        });

        // Refresh the project from API to guarantee the matrix reflects DB state
        try {
            const projectId = sale.projectId || saleData.project_id;
            if (projectId) {
                const { data: freshProject } = await projectService.getById(projectId);
                if (freshProject) {
                    dispatch({ type: ACTIONS.UPDATE_PROJECT, payload: freshProject });
                }
            }
        } catch (err) {
            // Not critical - matrix will still show updated state from reducer
        }

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
            return { success: false, error };
        }
        dispatch({ type: ACTIONS.DELETE_SALE, payload: saleId });
        return { success: true };
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
            payment_date: payment.paymentDate || todayBogota(),
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
            saleId: data.sale_id || data.saleId,
            receiptImage: data.receipt_image || data.receiptImage || null,
            paymentMethod: data.payment_method || data.paymentMethod || 'cash'
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
            expense_date: expense.date || todayBogota(),
            notes: expense.notes,
            attachment: expense.attachment || null,
            selected_lots: expense.selectedLots ? JSON.stringify(expense.selectedLots) : null,
            payment_method: expense.payment_method || expense.paymentMethod || 'cash',
            sale_id: expense.sale_id || null,
            bank_account_id: expense.bank_account_id || expense.bankAccountId || null,
        };
        const { data, error } = await expenseService.create(expenseData);
        if (error) {
            console.error('Error creating expense:', error);
            return null;
        }
        const normalizedData = {
            ...data,
            projectId: data.project_id || data.projectId,
            partnerId: data.partner_id || data.partnerId,
            date: data.expense_date || data.date,
            paymentMethod: data.payment_method || data.paymentMethod || 'cash',
            createdAt: data.created_at || data.createdAt
        };
        dispatch({ type: ACTIONS.ADD_EXPENSE, payload: normalizedData });
        return normalizedData;
    }, []);

    const updateExpense = useCallback(async (expense) => {
        const { data, error } = await expenseService.update(expense.id, expense);
        if (error) {
            console.error('Error updating expense:', error);
            return;
        }
        const normalizedData = {
            ...data,
            projectId: data.project_id || data.projectId,
            partnerId: data.partner_id || data.partnerId,
            date: data.expense_date || data.date,
            createdAt: data.created_at || data.createdAt
        };
        dispatch({ type: ACTIONS.UPDATE_EXPENSE, payload: normalizedData });
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
        // Solo ventas activas (excluir desistidas de los conteos de ingresos)
        const activeSales = state.sales.filter(s => (s.status || 'active') !== 'desistida');

        const totalProjects = state.projects.length;
        const totalClients = state.clients.length;
        const totalSales = activeSales.length;

        const totalRevenue = activeSales.reduce((sum, s) =>
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
            sum + (p.lots?.filter(l => l.status === 'sold' || l.status === 'pending_initial').length || 0), 0
        );

        const availableLots = state.projects.reduce((sum, p) =>
            sum + (p.lots?.filter(l => l.status === 'available' || !l.status).length || 0), 0
        );

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
                charge_date: registration.chargeDate || todayBogota(),
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
        getAllInstallmentsBySale: async (saleId) => {
            return await installmentService.getBySale(saleId);
        },
        markInstallmentAsPaid: async (installmentId, paymentId, paidAmount) => {
            return await installmentService.markAsPaid(installmentId, paymentId);
        },
        markInstallmentAsPartial: async (installmentId, paidAmount) => {
            return await installmentService.markAsPartial(installmentId, paidAmount);
        },
        calculateRestructureOptions: async (saleId, paymentAmount) => {
            return await installmentService.calculateRestructure(saleId, paymentAmount);
        },
        applyRestructure: async (saleId, option, restructureData, paymentId) => {
            const optionData = option === 'reduceTime' ? restructureData.reduceTime : restructureData.reducePayment;
            const startDate = todayBogota();
            return await installmentService.restructurePayments(saleId, optionData.newNumInstallments, startDate);
        },
        autoRedistributeInstallments: async (saleId, paymentAmount, paymentId) => {
            return await installmentService.autoRedistribute(saleId, paymentAmount, paymentId);
        },
        // Desistimientos
        addDesistimiento: async (data) => {
            const { data: result, error } = await desistimientoService.create(data);
            if (error) {
                console.error('Error creating desistimiento:', error);
                return null;
            }
            dispatch({ type: ACTIONS.ADD_DESISTIMIENTO, payload: result });
            // Marcar la venta como desistida en estado local (no eliminarla)
            dispatch({ type: ACTIONS.MARK_SALE_DESISTIDA, payload: data.sale_id || data.saleId });
            return result;
        },
        updateDesistimiento: async (id, data) => {
            const { data: result, error } = await desistimientoService.update(id, data);
            if (error) {
                console.error('Error updating desistimiento:', error);
                return null;
            }
            dispatch({ type: ACTIONS.UPDATE_DESISTIMIENTO, payload: result });
            return result;
        },
        deleteDesistimiento: async (id) => {
            const { error } = await desistimientoService.delete(id);
            if (error) { console.error('Error deleting desistimiento:', error); return; }
            dispatch({ type: ACTIONS.DELETE_DESISTIMIENTO, payload: id });
        },
        getDesistimientosByProject: (projectId) => {
            return state.desistimientos.filter(d => d.project_id === projectId);
        },
        // Stats
        getStats,
        // Utils
        generateId,
        refreshData,
        // Lot management
        addLot,
        deleteLot,
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
