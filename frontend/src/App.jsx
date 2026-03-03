import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import EngineDashboard from './components/Engine/EngineDashboard';
import MudPumpDashboard from './components/MudPump/MudPumpDashboard';
import WellControlDashboard from './components/WellControl/WellControlDashboard';
import TrendsDashboard from './components/Trends/TrendsDashboard';
import EdrDashboard from './components/EDR/EdrDashboard';
import AdminPanel from './components/Admin/AdminPanel';
import FishingDashboard from './components/Fishing/FishingDashboard';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#38bdf8',
        },
        background: {
            default: '#0f172a',
            paper: '#1e293b',
        },
    },
    typography: {
        fontFamily: 'Inter, sans-serif',
    },
});

import { AuthProvider } from './context/AuthContext';
import Login from './components/Auth/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
    return (
        <ThemeProvider theme={darkTheme}>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute />}>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<Dashboard />} />
                                <Route path="engine" element={<EngineDashboard />} />
                                <Route path="mudpump" element={<MudPumpDashboard />} />
                                <Route path="wellcontrol" element={<WellControlDashboard />} />
                                <Route path="fishing" element={<FishingDashboard />} />
                                <Route path="edr" element={
                                    <ErrorBoundary>
                                        <EdrDashboard />
                                    </ErrorBoundary>
                                } />
                                <Route path="trends" element={
                                    <ErrorBoundary>
                                        <TrendsDashboard />
                                    </ErrorBoundary>
                                } />
                                <Route path="admin" element={<AdminPanel />} />
                                <Route path="*" element={<Dashboard />} />
                            </Route>
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
