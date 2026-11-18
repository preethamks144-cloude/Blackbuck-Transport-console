import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Eye, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Panel, Empty, Table, Modal, Field, today, money } from '@/components/ui';

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

const emptyForm = {
  from_city: '', from_state: '', to_city: '', to_state: '',
  goods: '', description: '', weight: '', bales_or_units: '',
  vehicle_type: 'Heavy Vehicle', distance: '',
  pickup_date: today(), delivery_date: today(), price: '',
};

function badgeClass(status: string | null) {
  const s = (status ?? 'Available').toLowerCase();
  if (s === 'confirmed') return 'bg-emerald-100 text-emerald-700';
  if (s === 'archived') return 'bg-slate-100 text-slate-600';
  if (s === 'cancelled') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function LoadDetails({ load, onClose }: { load: LiveLoad; onClose: () => void }) {
  const rows: [string, string][] = [
    ['From', `${load.from_city}${load.from_state ? `, ${load.from_state}` : ''}`],
    ['To', `${load.to_city}${load.to_state ? `, ${load.to_state}` : ''}`],
    ['Goods', load.goods],
    ['Weight', load.weight],
    ['Bales / units', load.bales_or_units ?? '—'],
    ['Vehicle type', load.vehicle_type],
    ['Distance', load.distance],
    ['Price', money(Number(load.price))],
    ['Pickup date', load.pickup_date],
    ['Delivery date', load.delivery_date],
    ['Posted by', load.posted_by ?? '—'],
    ['Posted on', load.posted_on],
    ['Status', load.status ?? 'Available'],
    ['Description', load.description ?? '—'],
  ];
  return (
    <Modal title={`Load: ${load.from_city} → ${load.to_city}`} onClose={onClose}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex justify-between px-4 py-3 text-sm ${i % 2 ? 'bg-slate-50' : ''}`}>
            <span className="text-slate-500">{label}</span>
            <span className="max-w-[60%] text-right font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-5 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold">Close</button>
    </Modal>
  );
}

export function Loads({ update }: { update: (x: Record<string, unknown>, m: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loads, setLoads] = useState<LiveLoad[]>([]);
  const [loadsError, setLoadsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [viewLoad, setViewLoad] = useState<LiveLoad | null>(null);
  const [deleteId, setDeleteId] = useState('');

  const fetchLoads = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('loads').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { setLoadsError('Live load data could not be loaded. Tap Refresh to try again.'); return; }
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

    if (!form.from_city.trim()) { setFormError('Enter the origin city.'); return; }
    if (!form.to_city.trim()) { setFormError('Enter the destination city.'); return; }
    if (!form.goods.trim()) { setFormError('Enter the goods type.'); return; }
    if (!form.weight.trim()) { setFormError('Enter the weight.'); return; }
    if (!form.distance.trim()) { setFormError('Enter the distance.'); return; }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setFormError('Enter a valid price greater than zero.'); return; }
    if (form.pickup_date && form.delivery_date && form.pickup_date > form.delivery_date) {
      setFormError('Pickup date cannot be after the delivery date.'); return;
    }

    setSaving(true);
    const payload = {
      from_city: form.from_city.trim(),
      from_state: form.from_state.trim() || null,
      to_city: form.to_city.trim(),
      to_state: form.to_state.trim() || null,
      goods: form.goods.trim(),
      description: form.description.trim() || null,
      weight: form.weight.trim(),
      bales_or_units: form.bales_or_units.trim() || null,
      vehicle_type: form.vehicle_type.trim(),
      posted_on: today(),
      distance: form.distance.trim(),
      pickup_date: form.pickup_date,
      delivery_date: form.delivery_date,
      price: priceNum,
    };
    const { error } = await supabase.from('loads').insert(payload);
    setSaving(false);
    if (error) { setFormError(error.message || 'Could not save the load. Check your connection and try again.'); return; }
    update({}, 'Load posted successfully');
    setForm({ ...emptyForm });
    setOpen(false);
    void fetchLoads();
  };

  const archive = async (loadId: string) => {
    const { error } = await supabase.from('loads').update({ status: 'Archived', is_new: false }).eq('id', loadId);
    if (error) { setLoadsError('Could not archive the load. Tap Refresh and try again.'); return; }
    update({}, 'Load archived');
    void fetchLoads();
  };

  const unarchive = async (loadId: string) => {
    const { error } = await supabase.from('loads').update({ status: 'Available' }).eq('id', loadId);
    if (error) { setLoadsError('Could not restore the load.'); return; }
    update({}, 'Load restored to available');
    void fetchLoads();
  };

  const remove = async (loadId: string) => {
    const { error } = await supabase.from('loads').delete().eq('id', loadId);
    setDeleteId('');
    if (error) { setLoadsError('Could not delete the load. It may be linked to a trip.'); return; }
    update({}, 'Load deleted');
    void fetchLoads();
  };

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
        {loading ? <Empty label="Loading loads..." /> : visible.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">From → To</th>
              <th className="px-4 py-3">Goods</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Distance</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
            {visible.map(x => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{x.from_city}{x.from_state ? `, ${x.from_state}` : ''} → {x.to_city}{x.to_state ? `, ${x.to_state}` : ''}</td>
                <td className="px-4 py-3">{x.goods}</td>
                <td className="px-4 py-3">{x.weight}</td>
                <td className="px-4 py-3">{x.vehicle_type}</td>
                <td className="px-4 py-3">{x.distance}</td>
                <td className="px-4 py-3 font-bold">{money(Number(x.price))}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badgeClass(x.status)}`}>{x.status ?? 'Available'}</span></td>
                <td className="flex flex-wrap gap-2 px-4 py-3">
                  <button onClick={() => setViewLoad(x)} className="rounded-lg border p-2" title="View details"><Eye size={15} /></button>
                  {x.status !== 'Archived' && <button onClick={() => void archive(x.id)} className="rounded-lg border px-2 text-xs font-bold">Archive</button>}
                  {x.status === 'Archived' && <button onClick={() => void unarchive(x.id)} className="rounded-lg border px-2 text-xs font-bold">Restore</button>}
                  {deleteId === x.id
                    ? <button onClick={() => void remove(x.id)} className="flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-bold text-white"><Trash2 size={12} />Confirm</button>
                    : <button onClick={() => setDeleteId(x.id)} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold"><Trash2 size={12} />Delete</button>}
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

      {viewLoad && <LoadDetails load={viewLoad} onClose={() => setViewLoad(null)} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={20} /></div>
            <h2 className="heading mt-4 text-xl font-bold">Delete this load?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">This permanently removes the load from the database. If it is linked to a trip, the deletion may be blocked.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteId('')} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold">Cancel</button>
              <button onClick={() => void remove(deleteId)} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
