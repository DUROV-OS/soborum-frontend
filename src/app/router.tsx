import { lazy } from 'react'
import { RouteBoundary } from './RouteBoundary'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isSalesManager, salesHome, salesRouteAllowed } from '@/auth/salesNavigation'
import { useAuthStore } from '@/auth/store'
import { SECTIONS } from '@/shared/sections'
import { AccessGate } from './AccessGate'

const LoginPage = lazy(() => import('@/auth/pages/LoginPage').then(module => ({ default: module.LoginPage })))
const AccessMatrixPage = lazy(() => import('@/auth/pages/AccessMatrixPage').then(module => ({ default: module.AccessMatrixPage })))
const ClientDetailPage = lazy(() => import('@/clients/pages/ClientDetailPage').then(module => ({ default: module.ClientDetailPage })))
const FeedbackAdminPage = lazy(() => import('@/feedback/pages/FeedbackAdminPage').then(module => ({ default: module.FeedbackAdminPage })))
const FeedbackPage = lazy(() => import('@/feedback/pages/FeedbackPage').then(module => ({ default: module.FeedbackPage })))
const MyFeedbackPage = lazy(() => import('@/feedback/pages/MyFeedbackPage').then(module => ({ default: module.MyFeedbackPage })))
const NotificationsPage = lazy(() => import('@/notifications/pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })))
const ClientsBoardPage = lazy(() => import('@/clients/pages/ClientsBoardPage').then(module => ({ default: module.ClientsBoardPage })))
const PartnerDetailPage = lazy(() => import('@/partners/pages/PartnerDetailPage').then(module => ({ default: module.PartnerDetailPage })))
const PartnersPage = lazy(() => import('@/partners/pages/PartnersPage').then(module => ({ default: module.PartnersPage })))
const TasksPage = lazy(() => import('@/tasks/pages/TasksPage').then(module => ({ default: module.TasksPage })))
const BlockDetailPage = lazy(() => import('@/production/pages/BlockDetailPage').then(module => ({ default: module.BlockDetailPage })))
const ProductionOverviewPage = lazy(() => import('@/production/pages/ProductionOverviewPage').then(module => ({ default: module.ProductionOverviewPage })))
const ProductionLibraryPage = lazy(() => import('@/production/pages/ProductionLibraryPage').then(module => ({ default: module.ProductionLibraryPage })))
const StageTemplateReviewPage = lazy(() => import('@/production/pages/StageTemplateReviewPage').then(module => ({ default: module.StageTemplateReviewPage })))
const ProductionDetailShell = lazy(() => import('@/production/pages/ProductionDetailShell').then(module => ({ default: module.ProductionDetailShell })))
const ProductionBlocksTab = lazy(() => import('@/production/components/ProductionBlocksTab').then(module => ({ default: module.ProductionBlocksTab })))
const ProductionHomeTab = lazy(() => import('@/production/pages/ProductionHomeTab').then(module => ({ default: module.ProductionHomeTab })))
const SectionStub = lazy(() => import('@/production/components/SectionStub').then(module => ({ default: module.SectionStub })))
const MontageDetailPage = lazy(() => import('@/montage/pages/MontageDetailPage').then(module => ({ default: module.MontageDetailPage })))
const MontageOverviewPage = lazy(() => import('@/montage/pages/MontageOverviewPage').then(module => ({ default: module.MontageOverviewPage })))
const MarketingPage = lazy(() => import('@/marketing/pages/MarketingPage').then(module => ({ default: module.MarketingPage })))
const HouseModelsListPage = lazy(() => import('@/house_models/pages/HouseModelsListPage').then(module => ({ default: module.HouseModelsListPage })))
const HouseModelDetailPage = lazy(() => import('@/house_models/pages/HouseModelDetailPage').then(module => ({ default: module.HouseModelDetailPage })))
const CycleDetailPage = lazy(() => import('@/cycles/pages/CycleDetailPage').then(module => ({ default: module.CycleDetailPage })))
const CyclesListPage = lazy(() => import('@/cycles/pages/CyclesListPage').then(module => ({ default: module.CyclesListPage })))
const WarehousePage = lazy(() => import('@/warehouse/pages/WarehousePage').then(module => ({ default: module.WarehousePage })))
const MoyskladPage = lazy(() => import('@/moysklad/MoyskladPage').then(module => ({ default: module.MoyskladPage })))
const CrmPage = lazy(() => import('@/crm/CrmPage').then(module => ({ default: module.CrmPage })))
const RecipesPage = lazy(() => import('@/moysklad/RecipesPage').then(module => ({ default: module.RecipesPage })))
const PurchasingPage = lazy(() => import('@/purchasing/PurchasingPage').then(module => ({ default: module.PurchasingPage })))
const SalesPage = lazy(() => import('@/sales/SalesPage').then(module => ({ default: module.SalesPage })))
const CostingPage = lazy(() => import('@/costing/CostingPage').then(module => ({ default: module.CostingPage })))
const ApprovalsPage = lazy(() => import('@/costing/ApprovalsPage').then(module => ({ default: module.ApprovalsPage })))
const CatalogDetailPage = lazy(() => import('@/costing/CatalogDetailPage').then(module => ({ default: module.CatalogDetailPage })))
const AiChatPage = lazy(() => import('@/ai/pages/AiChatPage').then(module => ({ default: module.AiChatPage })))
const MeetingsPage = lazy(() => import('@/meeting/pages/MeetingsPage').then(module => ({ default: module.MeetingsPage })))
const BoardPage = lazy(() => import('@/board/pages/BoardPage').then(module => ({ default: module.BoardPage })))
const AgentProposalsPage = lazy(() => import('@/agents/pages/AgentProposalsPage').then(module => ({ default: module.AgentProposalsPage })))
const AgentsPage = lazy(() => import('@/agents/pages/AgentsPage').then(module => ({ default: module.AgentsPage })))
const AllChatsPage = lazy(() => import('@/max/pages/AllChatsPage').then(module => ({ default: module.AllChatsPage })))
const WorkPage = lazy(() => import('@/work/pages/WorkPage').then(module => ({ default: module.WorkPage })))
const AccountingPage = lazy(() => import('@/accounting/pages/AccountingPage').then(module => ({ default: module.AccountingPage })))
const SuppliersPage = lazy(() => import('@/suppliers/pages/SuppliersPage').then(module => ({ default: module.SuppliersPage })))
const TodayPage = lazy(() => import('@/today/pages/TodayPage').then(module => ({ default: module.TodayPage })))
const IntegrityPage = lazy(() => import('@/integrity/IntegrityPage').then(module => ({ default: module.IntegrityPage })))
const SalesWorkspace = lazy(() => import('@/work/pages/SalesWorkspace').then(module => ({ default: module.SalesWorkspace })))
const SalesTeam = lazy(() => import('@/work/pages/SalesWorkspace').then(module => ({ default: module.SalesTeam })))
const AppShell = lazy(() => import('./AppShell').then(module => ({ default: module.AppShell })))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const current = useAuthStore((s) => s.current)
  const location = useLocation()
  if (!current) return <Navigate to="/login" replace />
  if (isSalesManager(current) && !salesRouteAllowed(location.pathname, location.search)) {
    return <Navigate to={salesHome(current)} replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const first = SECTIONS.find((s) => !s.adminOnly && hasAccess(s.id))
  return <Navigate to={first?.path ?? '/admin'} replace />
}

export function AppRouter() {
  const salesManager = useAuthStore((s) => isSalesManager(s.current))
  return (
    <Routes>
      <Route path="/login" element={<RouteBoundary><LoginPage /></RouteBoundary>} />
      <Route
        element={
          <RequireAuth>
            <RouteBoundary><AppShell /></RouteBoundary>
          </RequireAuth>
        }
      >
        <Route index element={<RootRedirect />} />
        <Route path="/integrity" element={<AccessGate section="admin"><IntegrityPage /></AccessGate>} />
        <Route path="/cost-approvals" element={<ApprovalsPage />} />
        <Route path="/sales" element={salesManager ? <SalesWorkspace view="sales" /> : <AccessGate section="sales"><SalesPage /></AccessGate>} />
        <Route path="/team" element={salesManager ? <AccessGate section="crm"><SalesTeam /></AccessGate> : <Navigate to="/work" replace />} />
        <Route path="/recipes" element={<AccessGate section="recipes"><RecipesPage /></AccessGate>} />
        <Route path="/production-library" element={<AccessGate section="production"><ProductionLibraryPage /></AccessGate>} />
        <Route path="/costing" element={<AccessGate section="estimates"><CostingPage /></AccessGate>} />
        <Route path="/costing/catalog/:itemId" element={<AccessGate section="estimates"><CatalogDetailPage /></AccessGate>} />
        <Route path="/costing/models/:modelKey" element={<AccessGate section="estimates"><CatalogDetailPage /></AccessGate>} />
        <Route path="/purchasing" element={<AccessGate section="purchasing"><PurchasingPage /></AccessGate>} />
        <Route path="/crm" element={<AccessGate section="crm"><CrmPage /></AccessGate>} />
        <Route path="/moysklad" element={<AccessGate section="moysklad"><MoyskladPage /></AccessGate>} />
        {/* Заявки «Пожелания/предложения» (0075) — без AccessGate: писать о
            проблемах системы может любой вошедший сотрудник. */}
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/feedback/my" element={<MyFeedbackPage />} />
        {/* «Уведомления» (0080-d) — своя лента, без AccessGate: доступна
            каждому вошедшему, как «Мои заявки». */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/feedback/all"
          element={
            <AccessGate section="feedback_admin">
              <FeedbackAdminPage />
            </AccessGate>
          }
        />
        <Route
          path="/today"
          element={
            <AccessGate section="today">
              {salesManager ? <SalesWorkspace /> : <TodayPage />}
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
          path="/partners"
          element={
            <AccessGate section="partners">
              <PartnersPage />
            </AccessGate>
          }
        />
        <Route
          path="/partners/:id"
          element={
            <AccessGate section="partners">
              <PartnerDetailPage />
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
        <Route path="/work" element={salesManager ? <SalesWorkspace view="work" /> : <WorkPage />} />
        <Route
          path="/accounting"
          element={
            <AccessGate section="accounting">
              <AccountingPage />
            </AccessGate>
          }
        />
        <Route path="/suppliers" element={<AccessGate section="suppliers"><SuppliersPage /></AccessGate>} />
        <Route
          path="/board"
          element={
            <AccessGate section="board">
              <BoardPage />
            </AccessGate>
          }
        />
        <Route
          path="/ai-proposals"
          element={
            <AccessGate section="ai_proposals">
              <AgentProposalsPage />
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
