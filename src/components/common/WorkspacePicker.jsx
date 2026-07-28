'use client';
export function WorkspacePicker({ workspaces, activeWorkspaceId, switchWorkspace, className = "" }) {
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  return <label className={`workspace-picker ${className}`}>
    <span className="workspace-picker-copy"><strong>{active?.name || "Memuat workspace"}</strong><small>Workspace aktif</small></span>
    <select value={activeWorkspaceId || ""} onChange={(event) => switchWorkspace(event.target.value)} disabled={!workspaces.length} aria-label="Pilih workspace aktif">
      {!workspaces.length && <option value="">Memuat workspace...</option>}
      {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name || "Workspace"}</option>)}
    </select>
  </label>;
}
