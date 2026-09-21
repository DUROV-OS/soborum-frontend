import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/auth/pages/LoginPage'
import { AccessMatrixPage } from '@/auth/pages/AccessMatrixPage'
import { useAuthStore } from '@/auth/store'
import { ClientDetailPage } from '@/clients/pages/ClientDetailPage'
import { FeedbackPage } from '@/feedback/pages/FeedbackPage'
import { ClientsBoardPage } from '@/clients/pages/ClientsBoardPage'
import { TasksPage } from '@/tasks/pages/TasksPage'
import { BlockDetailPage } from '@/production/pages/BlockDetailPage'
import { ProductionOverviewPage } from '@/production/pages/ProductionOverviewPage'
import { StageTemplateReviewPage } from '@/production/pages/StageTemplateReviewPage'
import { ProductionDetailShell } from '@/production/pages/ProductionDetailShell'
import { ProductionBlocksTab } from '@/production/components/ProductionBlocksTab'
import { ProductionHomeTab } from '@/production/pages/ProductionHomeTab'
import { SectionStub } from '@/production/components/SectionStub'
import { MontageDetailPage } from '@/montage/pages/MontageDetailPage'
import { MontageOverviewPage } from '@/montage/pages/MontageOverviewPage'
import { MarketingPage } from '@/marketing/pages/MarketingPage'
import { HouseModelsListPage } from '@/house_models/pages/HouseModelsListPage'
import { HouseModelDetailPage } from '@/house_models/pages/HouseModelDetailPage'
import { CycleDetailPage } from '@/cycles/pages/CycleDetailPage'
import { CyclesListPage } from '@/cycles/pages/CyclesListPage'
import { WarehousePage } from '@/warehouse/pages/WarehousePage'
import { AiChatPage } from '@/ai/pages/AiChatPage'
import { MeetingsPage } from '@/meeting/pages/MeetingsPage'
import { BoardPage } from '@/board/pages/BoardPage'
import { AgentsPage } from '@/agents/pages/AgentsPage'
import { AllChatsPage } from '@/max/pages/AllChatsPage'
import { WorkPage } from '@/work/pages/WorkPage'
import { AccountingPage } from '@/accounting/pages/AccountingPage'
import { SuppliersPage } from '@/suppliers/pages/SuppliersPage'
import { TodayPage } from '@/today/pages/TodayPage'
import { SECTIONS } from '@/shared/sections'
import { AccessGate } from './AccessGate'
import { AppShell } from './AppShell'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const current = useAuthStore((s) => s.current)
  if (!current) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const first = SECTIONS.find((s) => !s.adminOnly && hasAccess(s.id))
  return <Navigate to={first?.path ?? '/admin'} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<RootRedirect />} />
        {/* Заявки «Пожелания/предложения» (0075) — без AccessGate: писать о
            проблемах системы может любой вошедший сотрудник. */}
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route
          path="/today"
          element={
            <AccessGate section="today">
              <TodayPage />
            </AccessGate>
          }
        />
        <Route
          path="/clients"
          element={
            <AccessGate section="clients">
              <ClientsBoardPage />
            </AccessGate>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <AccessGate section="clients">
              <ClientDetailPage />
            </AccessGate>
          }
        />
        <Route
          path="/production"
          element={
            <AccessGate section="production">
              <ProductionOverviewPage />
            </AccessGate>
          }
        />
        <Route
          path="/production/blocks/:id"
          element={
            <AccessGate section="production">
              <BlockDetailPage />
            </AccessGate>
          }
        />
        <Route
          path="/production/stage-templates/:id"
          element={
            <AccessGate section="production">
              <StageTemplateReviewPage />
            </AccessGate>
          }
        />
        <Route
          path="/production/:id"
          element={
            <AccessGate section="production">
              <ProductionDetailShell />
            </AccessGate>
          }
        >
          <Route index element={<Navigate to="sborka" replace />} />
          <Route path="glavnaya" element={<ProductionHomeTab />} />
          <Route path="postavka" element={<SectionStub title="Поставка" />} />
          <Route path="sborka" element={<ProductionBlocksTab />} />
          <Route path="ostalnoe" element={<SectionStub title="Остальное" />} />
        </Route>
        <Route
          path="/montage"
          element={
            <AccessGate section="installation">
              <MontageOverviewPage />
            </AccessGate>
          }
        />
        <Route
          path="/montage/:id"
          element={
            <AccessGate section="installation">
              <MontageDetailPage />
            </AccessGate>
          }
        />
        <Route
          path="/cycles"
          element={
            <AccessGate section="cycle">
              <CyclesListPage />
            </AccessGate>
          }
        />
        <Route
          path="/cycles/:id"
          element={
            <AccessGate section="cycle">
              <CycleDetailPage />
            </AccessGate>
          }
        />
        <Route
          path="/warehouse"
          element={
            <AccessGate section="warehouse">
              <WarehousePage />
            </AccessGate>
          }
        />
        <Route
          path="/marketing"
          element={
            <AccessGate section="marketing">
              <MarketingPage />
            </AccessGate>
          }
        />
        <Route
          path="/house-models"
          element={
            <AccessGate section="house_models">
              <HouseModelsListPage />
            </AccessGate>
          }
        />
        <Route
          path="/house-models/:key"
          element={
            <AccessGate section="house_models">
              <HouseModelDetailPage />
            </AccessGate>
          }
        />
        <Route
          path="/tasks"
          element={
            <AccessGate section="tasks">
              <TasksPage />
            </AccessGate>
          }
        />
        <Route path="/work" element={<WorkPage />} />
        <Route
          path="/accounting"
          element={
            <AccessGate section="accounting">
              <AccountingPage />
            </AccessGate>
          }
        />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route
          path="/board"
          element={
            <AccessGate section="board">
              <BoardPage />
            </AccessGate>
          }
        />
        <Route
          path="/agents"
          element={
            <AccessGate section="agents">
              <AgentsPage />
            </AccessGate>
          }
        />
        <Route
          path="/chats"
          element={
            <AccessGate section="chats">
              <AllChatsPage />
            </AccessGate>
          }
        />
        <Route
          path="/chats/:chatId"
          element={
            <AccessGate section="chats">
              <AllChatsPage />
            </AccessGate>
          }
        />
        <Route
          path="/ai"
          element={
            <AccessGate section="ai">
              <AiChatPage />
            </AccessGate>
          }
        />
        <Route
          path="/ai/:chatId"
          element={
            <AccessGate section="ai">
              <AiChatPage />
            </AccessGate>
          }
        />
        <Route
          path="/meetings"
          element={
            <AccessGate section="meetings">
              <MeetingsPage />
            </AccessGate>
          }
        />
        <Route
          path="/meetings/:id"
          element={
            <AccessGate section="meetings">
              <MeetingsPage />
            </AccessGate>
          }
        />
        <Route
          path="/admin"
          element={
            <AccessGate section="admin">
              <AccessMatrixPage />
            </AccessGate>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Route>
    </Routes>
  )
}
