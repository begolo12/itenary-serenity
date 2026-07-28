'use client';
import { PanelHead } from '../common/PanelHead';

export function Checklist({ trip, updateList, setModal, removeItem }) {
  const tasks = trip.tasks || [];
  const toggle = (id) => updateList('tasks', tasks.map((task) => {
    if (task.id !== id) return task;
    const done = !task.done;
    return { ...task, done, status: done ? 'done' : 'todo' };
  }));
  const done = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const categories = [...new Set(tasks.map((task) => task.category || 'Umum'))];
  return <section className="panel">
    <PanelHead eyebrow="PERSIAPAN & TUGAS" title={`${done}/${tasks.length} tugas selesai`} action="＋ Tambah tugas" onAction={() => setModal({ type: 'task', item: null })} />
    {tasks.length > 0 && <div className="progress-bar checklist-progress"><div className="progress-fill" style={{ width: `${progress}%` }} /><span>{progress}% siap — {tasks.length - done} tugas tersisa</span></div>}
    {!tasks.length ? <p className="panel-empty">Belum ada tugas. Tambahkan persiapan sebelum perjalanan.</p> : categories.map((category) => {
      const categoryTasks = tasks.filter((task) => (task.category || 'Umum') === category);
      const categoryDone = categoryTasks.filter((task) => task.done).length;
      return <div key={category} className="checklist-group"><h4 className="checklist-category">{category}<small>{categoryDone}/{categoryTasks.length}</small></h4>{categoryTasks.map((task) => <article key={task.id} className={`checklist-item ${task.done ? 'done' : ''}`}><label><input type="checkbox" checked={Boolean(task.done)} onChange={() => toggle(task.id)} /><span><b>{task.title}</b><small>{task.note || 'Tanpa catatan'}{task.due ? ` · ${task.due}` : ''}</small></span></label><span className={`priority-badge ${task.priority || 'sedang'}`}>{task.priority || 'sedang'}</span><button className="mini" onClick={() => setModal({ type: 'task', item: task })}>Edit</button><button className="mini danger" onClick={() => removeItem('tasks', task.id, 'tugas')}>Hapus</button></article>)}</div>;
    })}
  </section>;
}
