import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Eye, Plus, Search, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type LiveLoad = {
  id: string;
  from_city: string;
  from_state: string | null;
  to_city: string;
  to_state: string | null;
  goods: string;
  description: string | null;
  weight: string;
  bales_or_units: string | null;
  vehicle_type: string;
  posted_by: string | null;
  posted_on: string;
  time_ago: string | null;
  is_new: boolean | null;
  distance: string;
  load_type: string | null;
  pickup_date: string;
  delivery_date: string;
  price: number;
  status: string | null;
  created_at: string;
};

type Store = { loads: { id: string }[]; drivers: { id: string }[]; trips: { id: string }[]; invoices: { id: string }[]; notifications: Notice[] };
type Notice = { id: string; title: string; text: string; read: boolean; date: string };

const STORE_KEY = 'blackbuck-local-trial-store';
const id = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const emptyForm = {
  from_city: '', from_state: '', to_city: '', to_state: '',
  goods: '', description: '', weight: '', bales_or_units: '',
  vehicle_type: 'Heavy Vehicle', distance: '',
  pickup_date: today(), delivery_date: today(), price: '',
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
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

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
      <p className="text-slate-400">{label}</p>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</thead>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

function Field({ label, value, onChange, placeholder, type = 'text', required = true }: {
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

export function Loads({ update }: { update: (x: Record<string, unknown>, m: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loads, setLoads] = useState<LiveLoad[]>([]);
  const [loadsError, setLoadsError] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchLoads = async () => {
    const { data, error } = await supabase.from('loads').select('*').order('created_at', { ascending: false });
    if (error) { setLoadsError('Live load data could not be loaded.'); return; }
    setLoads((data ?? []) as LiveLoad[]);
    setLoadsError('');
  };

  useEffect(() => { void fetchLoads(); }, []);

  const visible = loads.filter(x =>
    `${x.from_city} ${x.to_city} ${x.goods} ${x.vehicle_type} ${x.status ?? ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = {
      from_city: form.from_city,
      from_state: form.from_state || null,
      to_city: form.to_city,
      to_state: form.to_state || null,
      goods: form.goods,
      description: form.description || null,
      weight: form.weight,
      bales_or_units: form.bales_or_units || null,
      vehicle_type: form.vehicle_type,
      posted_on: today(),
      distance: form.distance,
      pickup_date: form.pickup_date,
      delivery_date: form.delivery_date,
      price: Number(form.price),
    };
    const { error } = await supabase.from('loads').insert(payload);
    setSaving(false);
    if (error) { setFormError(error.message || 'Could not save the load.'); return; }
    const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '{"notifications":[]}') as Store;
    update({
      notifications: [{
        id: id(), title: 'New load posted',
        text: `${form.from_city} → ${form.to_city} (${form.goods}) is now available.`,
        read: false, date: today(),
      }, ...existing.notifications],
    }, 'Load posted to Supabase');
    setForm({ ...emptyForm });
    setOpen(false);
    void fetchLoads();
  };

  const archive = async (loadId: string) => {
    const { error } = await supabase.from('loads').update({ status: 'Archived', is_new: false }).eq('id', loadId);
    if (error) { setLoadsError('Could not archive the load.'); return; }
    update({}, 'Load archived');
    void fetchLoads();
  };

  const toneFor = (status: string | null) =>
    status === 'Available' ? 'yellow' : status === 'Confirmed' ? 'green' : 'neutral';

  const badgeClass = (tone: string) =>
    tone === 'green' ? 'bg-emerald-100 text-emerald-700' :
    tone === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#e87500]">Shipment pipeline</p>
          <h2 className="heading mt-1 text-3xl font-bold">Loads Management</h2>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#ffb000] px-4 py-3 text-sm font-bold">
          <Plus size={17} />Post new load
        </button>
      </div>

      <Panel title="Loads listing" action={
        <button onClick={() => void fetchLoads()} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} />Connected to Supabase — {loads.length} load{loads.length === 1 ? '' : 's'} found
        </div>
        {loadsError && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadsError}</div>}
        <div className="mb-5 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={17} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by city, goods or vehicle..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ffb000]" />
          </div>
        </div>
        {visible.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">From → To</th>
              <th className="px-4 py-3">Goods</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Distance</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
            {visible.map(x => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{x.from_city}{x.from_state ? `, ${x.from_state}` : ''} → {x.to_city}{x.to_state ? `, ${x.to_state}` : ''}</td>
                <td className="px-4 py-3">{x.goods}</td>
                <td className="px-4 py-3">{x.weight}</td>
                <td className="px-4 py-3">{x.vehicle_type}</td>
                <td className="px-4 py-3">{x.distance}</td>
                <td className="px-4 py-3 font-bold">{money(Number(x.price))}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badgeClass(toneFor(x.status))}`}>{x.status ?? 'Available'}</span></td>
                <td className="flex gap-2 px-4 py-3">
                  <button className="rounded-lg border p-2"><Eye size={15} /></button>
                  {x.status !== 'Archived' && <button onClick={() => void archive(x.id)} className="rounded-lg border px-2 text-xs font-bold">Archive</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty label="No loads yet. Post your first load to begin." />}
      </Panel>

      {open && (
        <Modal title="Post new load" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From city" value={form.from_city} onChange={v => setForm({ ...form, from_city: v })} placeholder="Hubballi" />
              <Field label="From state" value={form.from_state} onChange={v => setForm({ ...form, from_state: v })} placeholder="Karnataka" required={false} />
              <Field label="To city" value={form.to_city} onChange={v => setForm({ ...form, to_city: v })} placeholder="Bengaluru" />
              <Field label="To state" value={form.to_state} onChange={v => setForm({ ...form, to_state: v })} placeholder="Karnataka" required={false} />
              <Field label="Goods" value={form.goods} onChange={v => setForm({ ...form, goods: v })} placeholder="Cement bags" />
              <Field label="Weight" value={form.weight} onChange={v => setForm({ ...form, weight: v })} placeholder="18 tons" />
              <Field label="Bales / units" value={form.bales_or_units} onChange={v => setForm({ ...form, bales_or_units: v })} placeholder="400 bags" required={false} />
              <Field label="Vehicle type" value={form.vehicle_type} onChange={v => setForm({ ...form, vehicle_type: v })} placeholder="Heavy Vehicle" />
              <Field label="Distance" value={form.distance} onChange={v => setForm({ ...form, distance: v })} placeholder="412 km" />
              <Field label="Price (₹)" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="25000" type="number" />
              <Field label="Pickup date" value={form.pickup_date} onChange={v => setForm({ ...form, pickup_date: v })} placeholder={today()} type="date" />
              <Field label="Delivery date" value={form.delivery_date} onChange={v => setForm({ ...form, delivery_date: v })} placeholder={today()} type="date" />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Description (optional)</span>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Additional load details..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" rows={2} />
            </label>
            {formError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
              <Send size={16} />{saving ? 'Saving...' : 'Post load'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
