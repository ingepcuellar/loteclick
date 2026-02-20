import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';

// Auth Pages
import Login from './pages/Auth/Login';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
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
    const { isAuthenticated, isLoading, isSeller, isTreasurer } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando...</p>
            </div>
        );
    }

    // Determine default route based on role
    const getDefaultRoute = () => {
        if (isSeller()) return <Navigate to="/projects" replace />;
        if (isTreasurer()) return <Navigate to="/payments" replace />;
        return <Dashboard />;
    };

    return (
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

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default App;
