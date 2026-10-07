import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Review } from './pages/Review';
import { AskCodebase } from './pages/AskCodebase';
import { PullRequests } from './pages/PullRequests';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { Architecture } from './pages/Architecture';
import { CodebaseHealth } from './pages/CodebaseHealth';
import { TechnicalDebt } from './pages/TechnicalDebt';
import { ImpactAnalysis } from './pages/ImpactAnalysis';
import { AiDebugger } from './pages/AiDebugger';
import { ApiGuardian } from './pages/ApiGuardian';
import { DatabaseRisk } from './pages/DatabaseRisk';
import { TestGenerator } from './pages/TestGenerator';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review/:id"
            element={
              <ProtectedRoute>
                <Review />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review/:owner/:repo"
            element={
              <ProtectedRoute>
                <Review />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ask"
            element={
              <ProtectedRoute>
                <AskCodebase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ask/:owner/:repo"
            element={
              <ProtectedRoute>
                <AskCodebase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pull-requests"
            element={
              <ProtectedRoute>
                <PullRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <Security />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security/:owner/:repo"
            element={
              <ProtectedRoute>
                <Security />
              </ProtectedRoute>
            }
          />
          <Route
            path="/architecture"
            element={
              <ProtectedRoute>
                <Architecture />
              </ProtectedRoute>
            }
          />
          <Route
            path="/architecture/:owner/:repo"
            element={
              <ProtectedRoute>
                <Architecture />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health"
            element={
              <ProtectedRoute>
                <CodebaseHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/:owner/:repo"
            element={
              <ProtectedRoute>
                <CodebaseHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technical-debt"
            element={
              <ProtectedRoute>
                <TechnicalDebt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technical-debt/:owner/:repo"
            element={
              <ProtectedRoute>
                <TechnicalDebt />
              </ProtectedRoute>
            }
          />
          {/* Engineering Intelligence: 5 Pro Features */}
          <Route
            path="/impact"
            element={
              <ProtectedRoute>
                <ImpactAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/impact/:owner/:repo"
            element={
              <ProtectedRoute>
                <ImpactAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/debugger"
            element={
              <ProtectedRoute>
                <AiDebugger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/debugger/:owner/:repo"
            element={
              <ProtectedRoute>
                <AiDebugger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-guardian"
            element={
              <ProtectedRoute>
                <ApiGuardian />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-guardian/:owner/:repo"
            element={
              <ProtectedRoute>
                <ApiGuardian />
              </ProtectedRoute>
            }
          />
          <Route
            path="/database-risk"
            element={
              <ProtectedRoute>
                <DatabaseRisk />
              </ProtectedRoute>
            }
          />
          <Route
            path="/database-risk/:owner/:repo"
            element={
              <ProtectedRoute>
                <DatabaseRisk />
              </ProtectedRoute>
            }
          />
          <Route
            path="/test-generator"
            element={
              <ProtectedRoute>
                <TestGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/test-generator/:owner/:repo"
            element={
              <ProtectedRoute>
                <TestGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
