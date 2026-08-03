import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useOffline } from './context/OfflineContext';
import { useEffect } from 'react';
import Layout from './components/Layout/Layout';
import OfflineIndicator from './components/ui/OfflineIndicator';
import PushNotificationService from './services/PushNotificationService';
import { brand } from './config/brandConfig';

// Auth Pages
import Login from './pages/Auth/Login';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
import PartnerDashboard from './pages/Dashboard/PartnerDashboard';
import ProjectList from './pages/Projects/ProjectList';
import ProjectWizard from './pages/Projects/ProjectWizard';
import ProjectDetail from './pages/Projects/ProjectDetail';
import ClientList from './pages/Clients/ClientList';
import ClientForm from './pages/Clients/ClientForm';
import ClientDetail from './pages/Clients/ClientDetail';
import SalesList from './pages/Sales/SalesList';
import SaleForm from './pages/Sales/SaleForm';
import SaleDetail from './pages/Sales/SaleDetail';
import PaymentList from './pages/Payments/PaymentList';
import PaymentForm from './pages/Payments/PaymentForm';
import ExpenseList from './pages/Expenses/ExpenseList';
import ExpenseForm from './pages/Expenses/ExpenseForm';
import ExpenseDetail from './pages/Expenses/ExpenseDetail';
import UserList from './pages/Users/UserList';
import UserForm from './pages/Users/UserForm';
import Reports from './pages/Reports/Reports';
import DisbursementList from './pages/Treasury/DisbursementList';
import DisbursementForm from './pages/Treasury/DisbursementForm';
import UtilityList from './pages/Utilities/UtilityList';
import UtilityForm from './pages/Utilities/UtilityForm';
import NotificationList from './pages/Notifications/NotificationList';
import Profile from './pages/Profile/Profile';
import ContractParams from './pages/Settings/ContractParams';
import BulkImport from './pages/BulkImport/BulkImport';
import DesistimientoList from './pages/Desistimientos/DesistimientoList';
import AuditLog from './pages/Admin/AuditLog';
import OfflineDiagnostic from './pages/Admin/OfflineDiagnostic';
import BankReconciliation from './pages/BankReconciliation/BankReconciliation';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
    const { isAuthenticated, isLoading, currentUser } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check role if required
    if (requiredRole && currentUser?.role !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function App() {
    const { isAuthenticated, isLoading, isAdmin, isSeller, isTreasurer, isPartner, currentUser } = useAuth();
    const { pendingCount, isSyncing, forceSync } = useOffline();

    // Initialize push notifications when user is logged in
    useEffect(() => {
        if (isAuthenticated && currentUser) {
            const token = localStorage.getItem(brand.tokenKey);
            if (token) {
                PushNotificationService.initialize(token, (notification) => {
                    // Handle foreground notification - could show a toast
                    console.log('Notification received:', notification.title);
                });
            }
        }
    }, [isAuthenticated, currentUser]);

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando...</p>
            </div>
        );
    }

    // Determine default route based on role (admin takes priority over all others)
    const getDefaultRoute = () => {
        if (isAdmin()) return <Dashboard />;
        if (isSeller()) return <Navigate to="/projects" replace />;
        if (isTreasurer()) return <Navigate to="/payments" replace />;
        if (isPartner()) return <PartnerDashboard />;
        return <Dashboard />;
    };

    return (
        <>
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Routes>
                                {/* Dashboard - role-based default */}
                                <Route path="/" element={getDefaultRoute()} />
                                <Route path="/partner-dashboard" element={<PartnerDashboard />} />

                                {/* Projects */}
                                <Route path="/projects" element={<ProjectList />} />
                                <Route path="/projects/new" element={<ProjectWizard />} />
                                <Route path="/projects/:id" element={<ProjectDetail />} />
                                <Route path="/projects/:id/edit" element={<ProjectWizard />} />

                                {/* Clients */}
                                <Route path="/clients" element={<ClientList />} />
                                <Route path="/clients/new" element={<ClientForm />} />
                                <Route path="/clients/:id" element={<ClientDetail />} />
                                <Route path="/clients/:id/edit" element={<ClientForm />} />

                                {/* Sales */}
                                <Route path="/sales" element={<SalesList />} />
                                <Route path="/sales/new" element={<SaleForm />} />
                                <Route path="/sales/:id" element={<SaleDetail />} />

                                {/* Payments */}
                                <Route path="/payments" element={<PaymentList />} />
                                <Route path="/payments/new" element={<PaymentForm />} />

                                {/* Expenses */}
                                <Route path="/expenses" element={<ExpenseList />} />
                                <Route path="/expenses/new" element={<ExpenseForm />} />
                                <Route path="/expenses/:id" element={<ExpenseDetail />} />
                                <Route path="/expenses/:id/edit" element={<ExpenseForm />} />

                                {/* Disbursements (Treasury) */}
                                <Route path="/disbursements" element={<DisbursementList />} />
                                <Route path="/disbursements/new" element={<DisbursementForm />} />

                                {/* Desistimientos */}
                                <Route path="/desistimientos" element={<DesistimientoList />} />

                                {/* Conciliación Bancaria (Ítem 4b) */}
                                <Route path="/bank-reconciliation" element={<BankReconciliation />} />

                                {/* Utility Registrations (Servicios Públicos) */}
                                <Route path="/utilities" element={<UtilityList />} />
                                <Route path="/utilities/new" element={<UtilityForm />} />
                                <Route path="/utilities/:id/edit" element={<UtilityForm />} />

                                {/* Users (Admin only) */}
                                <Route path="/users" element={<UserList />} />
                                <Route path="/users/new" element={<UserForm />} />
                                <Route path="/users/:id/edit" element={<UserForm />} />

                                {/* Reports */}
                                <Route path="/reports" element={<Reports />} />

                                {/* Notifications */}
                                <Route path="/notifications" element={<NotificationList />} />


                                {/* Profile */}
                                <Route path="/profile" element={<Profile />} />

                                {/* Contract Params (Admin) */}
                                <Route path="/contract-params" element={<ContractParams />} />

                                {/* Bulk Import (Admin) */}
                                <Route path="/bulk-import" element={<BulkImport />} />

                                {/* Audit Log (Admin only) */}
                                <Route path="/admin/audit" element={<ProtectedRoute requiredRole="admin"><AuditLog /></ProtectedRoute>} />

                                {/* Offline Diagnostic (Admin only) */}
                                <Route path="/admin/offline" element={<ProtectedRoute requiredRole="admin"><OfflineDiagnostic /></ProtectedRoute>} />

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
        <OfflineIndicator
            pendingCount={pendingCount}
            isSyncing={isSyncing}
            onForceSync={forceSync}
        />
        <style>{`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .spin-animation {
                animation: spin 1s linear infinite;
            }
        `}</style>
        </>
    );
}

export default App;
