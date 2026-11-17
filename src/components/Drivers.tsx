import { FormEvent, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
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

export function Drivers({ onUpdate, onDriverChange }: DriversProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [drivers, setDrivers] = useState<SupabaseDriver[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '' });

  const fetchDrivers = async () => {
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) { setError('Driver data could not be loaded.'); return; }
    const list = (data ?? []) as SupabaseDriver[];
    setDrivers(list);
    onDriverChange(list);
    setError('');
  };

  useEffect(() => { void fetchDrivers(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const { error: insertError } = await supabase
      .from('drivers')
      .insert({ full_name: form.full_name, phone: form.phone, account_status: 'active' });
    setSaving(false);
    if (insertError) { setFormError(insertError.message || 'Could not save the driver.'); return; }
    onUpdate('Driver added');
    setForm({ full_name: '', phone: '' });
    setOpen(false);
    void fetchDrivers();
  };

  const toggleStatus = async (driver: SupabaseDriver) => {
    const next = driver.account_status === 'active' ? 'restricted' : 'active';
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ account_status: next })
      .eq('id', driver.id);
    if (updateError) { setError('Could not update the driver status.'); return; }
    onUpdate('Account status updated');
    void fetchDrivers();
  };

  const list = drivers.filter(x =>
    `${x.full_name} ${x.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#e87500]">Network directory</p>
          <h2 className="heading mt-1 text-3xl font-bold">Drivers & Owners</h2>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#ffb000] px-4 py-3 text-sm font-bold">
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
        {list.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Account status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
            {list.map(x => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{x.full_name}</td>
                <td className="px-4 py-3">{x.phone}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${x.account_status === 'active' ? 'bg-emerald-100 text-emerald-700' : x.account_status === 'restricted' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{x.account_status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => void toggleStatus(x)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">
                    {x.account_status === 'active' ? 'Restrict' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty label="No drivers yet. Add one to begin." />}
      </Panel>

      {open && (
        <Modal title="Add driver / owner" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} placeholder="Ramesh Kumar" />
            <Field label="Mobile number" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+91 98765 43210" />
            {formError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
              {saving ? 'Saving...' : 'Save driver'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
