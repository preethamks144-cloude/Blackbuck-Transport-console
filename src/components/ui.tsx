import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export const today = () => new Date().toISOString().slice(0, 10);
export const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="heading text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
      <p className="text-slate-400">{label}</p>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</thead>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="heading text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = 'text', required = true }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" />
    </label>
  );
}

export function Select({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <select required value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-[#ffb000]">
        {children}
      </select>
    </label>
  );
}
