import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Panel, Empty, Table, Modal, Field } from '@/components/ui';

export type SupabaseDriver = {
  id: string;
  full_name: string;
  phone: string;
  account_status: string;
  notes: string | null;
  registered_at: string;
};

type DriversProps = { onUpdate: (message: string) => void; onDriverChange: (drivers: SupabaseDriver[]) => void };

const emptyForm = { full_name: '', phone: '', notes: '' };

export function Drivers({ onUpdate, onDriverChange }: DriversProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SupabaseDriver | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [drivers, setDrivers] = useState<SupabaseDriver[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const fetchDrivers = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (fetchError) { setError('Driver data could not be loaded. Tap Refresh to try again.'); return; }
    const list = (data ?? []) as SupabaseDriver[];
    setDrivers(list);
    onDriverChange(list);
    setError('');
  };

  useEffect(() => { void fetchDrivers(); }, []);

  const openAdd = () => { setForm({ ...emptyForm }); setFormError(''); setOpen(true); };

  const openEdit = (driver: SupabaseDriver) => {
    setEditTarget(driver);
    setForm({ full_name: driver.full_name, phone: driver.phone, notes: driver.notes ?? '' });
    setFormError('');
    setOpen(true);
  };

  const closeForm = () => { setOpen(false); setEditTarget(null); setForm({ ...emptyForm }); setFormError(''); };

  const validate = (): string | null => {
    if (!form.full_name.trim()) return 'Enter the driver\'s full name.';
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) return 'Enter a valid mobile number (at least 10 digits).';
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const validationError = validate();
    if (validationError) { setFormError(validationError); return; }

    setSaving(true);
    if (editTarget) {
      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
        })
        .eq('id', editTarget.id);
      setSaving(false);
      if (updateError) {
        const msg = updateError.message || '';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          setFormError('A driver with this phone number already exists.');
        } else {
          setFormError(updateError.message || 'Could not update the driver.');
        }
        return;
      }
      onUpdate('Driver updated');
    } else {
      const { error: insertError } = await supabase
        .from('drivers')
        .insert({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          account_status: 'active',
          notes: form.notes.trim() || null,
        });
      setSaving(false);
      if (insertError) {
        const msg = insertError.message || '';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          setFormError('A driver with this phone number already exists.');
        } else {
          setFormError(insertError.message || 'Could not save the driver.');
        }
        return;
      }
      onUpdate('Driver added');
    }
    closeForm();
    void fetchDrivers();
  };

  const toggleStatus = async (driver: SupabaseDriver) => {
    const next = driver.account_status === 'active' ? 'restricted' : 'active';
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ account_status: next })
      .eq('id', driver.id);
    if (updateError) { setError('Could not update the driver status.'); return; }
    onUpdate(`Driver ${next === 'active' ? 'activated' : 'restricted'}`);
    void fetchDrivers();
  };

  const remove = async (driverId: string) => {
    const { error: deleteError } = await supabase.from('drivers').delete().eq('id', driverId);
    setDeleteId('');
    if (deleteError) {
      const msg = deleteError.message || '';
      if (msg.includes('foreign key') || msg.includes('violates')) {
        setError('Cannot delete this driver because they have trips, subscriptions, or payments linked. Remove those first.');
      } else {
        setError('Could not delete the driver.');
      }
      return;
    }
    onUpdate('Driver removed');
    void fetchDrivers();
  };

  const list = drivers.filter(x =>
    `${x.full_name} ${x.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#e87500]">Network directory</p>
          <h2 className="heading mt-1 text-3xl font-bold">Drivers & Owners</h2>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-[#ffb000] px-4 py-3 text-sm font-bold">
          <Plus size={17} />Add driver
        </button>
      </div>

      <Panel title="Driver / owner directory" action={
        <button onClick={() => void fetchDrivers()} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="mb-5 relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or phone..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ffb000]" />
        </div>
        {loading ? <Empty label="Loading drivers..." /> : list.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Account status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
            {list.map(x => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{x.full_name}</td>
                <td className="px-4 py-3">{x.phone}</td>
                <td className="px-4 py-3 max-w-[200px] truncate text-slate-500">{x.notes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${x.account_status === 'active' ? 'bg-emerald-100 text-emerald-700' : x.account_status === 'restricted' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{x.account_status}</span>
                </td>
                <td className="flex flex-wrap gap-2 px-4 py-3">
                  <button onClick={() => openEdit(x)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Pencil size={12} />Edit</button>
                  <button onClick={() => void toggleStatus(x)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">
                    {x.account_status === 'active' ? 'Restrict' : 'Activate'}
                  </button>
                  {deleteId === x.id
                    ? <button onClick={() => void remove(x.id)} className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white"><Trash2 size={12} />Confirm</button>
                    : <button onClick={() => setDeleteId(x.id)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Trash2 size={12} />Delete</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty label="No drivers yet. Add one to begin." />}
      </Panel>

      {open && (
        <Modal title={editTarget ? 'Edit driver / owner' : 'Add driver / owner'} onClose={closeForm}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} placeholder="Ramesh Kumar" />
            <Field label="Mobile number" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+91 98765 43210" />
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Notes (optional)</span>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Vehicle details, address, remarks..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" rows={2} />
            </label>
            {formError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
              {saving ? 'Saving...' : editTarget ? 'Save changes' : 'Save driver'}
            </button>
          </form>
        </Modal>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={20} /></div>
            <h2 className="heading mt-4 text-xl font-bold">Delete this driver?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">This permanently removes the driver. If they have trips, subscriptions, or payments linked, the deletion will be blocked — remove those records first.</p>
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
