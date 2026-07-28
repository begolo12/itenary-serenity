'use client';
import { WorkspacePicker } from '../common/WorkspacePicker';
import { syncLabel } from './Sidebar';

function Topbar({ view, selected, cloudState, user, workspaces, activeWorkspaceId, switchWorkspace }) {
  const title = view === "home" ? "Rencanakan dengan tenang." : view === "new" ? "Perjalanan baru" : view === "settings" ? "Pengaturan" : view === "calendar" ? "Kalender perjalanan" : selected?.title || "Itinerary";
  return <header className="topbar"><div className="topbar-main"><p className="eyebrow">SERENITY ATLAS</p><h1>{title}</h1></div><div className="topbar-actions"><WorkspacePicker className="mobile-workspace-picker" workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} switchWorkspace={switchWorkspace} /><div className={`cloud-state ${cloudState}`}><i /><span>{user ? "Workspace tersinkron" : "Penyimpanan lokal"}<strong>{syncLabel(cloudState)}</strong></span></div></div></header>;
}

export default Topbar;
