import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Panel, Empty, Table, Modal, Select, today, money } from '@/components/ui';
import type { SupabaseDriver } from '@/components/Drivers';

export type SupabaseTrip = {
  id: string;
  trip_number: string;
  load_id: string;
  driver_id: string;
  status: string;
  assigned_date: string;
  freight_amount: number;
};

export type SupabaseInvoice = {
  id: string;
  invoice_number: string;
  gc_number: string | null;
  invoice_date: string;
  consignor: string | null;
  consignee: string | null;
  freight: number;
  hamali: number;
  other_charges: number;
  gst: number;
  advance: number;
  total_amount: number;
  paid_amount: number;
  status: string;
};

type SupabaseLoadLite = { id: string; from_city: string; to_city: string; goods: string; price: number; status: string | null };

type TripsProps = { drivers: SupabaseDriver[]; onUpdate: (message: string) => void };

export function Trips({ drivers, onUpdate }: TripsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [trips, setTrips] = useState<SupabaseTrip[]>([]);
  const [loads, setLoads] = useState<SupabaseLoadLite[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ load_id: '', driver_id: '' });

  const fetchTrips = async () => {
    const [tripResult, loadResult] = await Promise.all([
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
      supabase.from('loads').select('id, from_city, to_city, goods, price, status').order('created_at', { ascending: false }),
    ]);
    if (tripResult.error) { setError('Trip data could not be loaded.'); return; }
    if (loadResult.error) { setError('Load data could not be loaded.'); return; }
    setTrips(tripResult.data ?? []);
    setLoads(loadResult.data ?? []);
    setError('');
  };

  useEffect(() => { void fetchTrips(); }, []);

  const loadFor = (loadId: string) => loads.find(x => x.id === loadId);
  const driverName = (driverId: string) => drivers.find(x => x.id === driverId)?.full_name ?? 'Unknown driver';
  const availableLoads = loads.filter(x => (x.status ?? 'Available') === 'Available');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const load = loadFor(form.load_id);
    if (!load) { setFormError('Select a load to assign.'); setSaving(false); return; }
    const tripNumber = `TRP-${String(trips.length + 1001)}`;
    const { error: tripError } = await supabase
      .from('trips')
      .insert({
        trip_number: tripNumber,
        load_id: form.load_id,
        driver_id: form.driver_id,
        status: 'assigned',
        assigned_date: today(),
        freight_amount: Number(load.price) || 0,
      });
    if (tripError) { setFormError(tripError.message || 'Could not assign the trip.'); setSaving(false); return; }
    await supabase.from('loads').update({ status: 'Confirmed' }).eq('id', form.load_id);
    onUpdate('Trip assigned');
    setForm({ load_id: '', driver_id: '' });
    setOpen(false);
    void fetchTrips();
  };

  const move = async (trip: SupabaseTrip) => {
    if (trip.status !== 'assigned' && trip.status !== 'ongoing') return;
    const next = trip.status === 'assigned' ? 'ongoing' : 'completed';
    const { error: updateError } = await supabase.from('trips').update({ status: next }).eq('id', trip.id);
    if (updateError) { setError('Could not update the trip status.'); return; }
    if (next === 'completed') {
      const load = loadFor(trip.load_id);
      const invoiceNumber = `INV-${today().split('-').join('')}-${trips.filter(x => x.status === 'completed').length + 1}`;
      const freight = Number(trip.freight_amount) || Number(load?.price) || 0;
      const { error: invoiceError } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        trip_id: trip.id,
        gc_number: trip.trip_number,
        invoice_date: today(),
        consignor: load ? `${load.from_city} (Consignor)` : null,
        consignee: load ? `${load.to_city} (Consignee)` : null,
        freight,
        hamali: 0,
        other_charges: 0,
        gst: 0,
        advance: 0,
        status: 'pending',
      });
      if (invoiceError) { setError('Trip completed but the invoice could not be created.'); void fetchTrips(); return; }
      onUpdate('Trip completed and invoice created');
    } else {
      onUpdate('Trip status updated');
    }
    void fetchTrips();
  };

  const badge = (status: string) =>
    status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
    status === 'assigned' || status === 'ongoing' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#e87500]">Movement tracking</p>
          <h2 className="heading mt-1 text-3xl font-bold">Trips Management</h2>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#ffb000] px-4 py-3 text-sm font-bold">
          <Plus size={17} />Assign trip
        </button>
      </div>

      <Panel title="Trip activity" action={
        <button onClick={() => void fetchTrips()} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {trips.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Trip no.</th>
              <th className="px-4 py-3">Driver / owner</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
            {trips.map(x => {
              const load = loadFor(x.load_id);
              return (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{x.trip_number}</td>
                  <td className="px-4 py-3">{driverName(x.driver_id)}</td>
                  <td className="px-4 py-3">{load ? `${load.from_city} → ${load.to_city}` : '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badge(x.status)}`}>{x.status}</span></td>
                  <td className="px-4 py-3">
                    {x.status !== 'completed' && x.status !== 'cancelled' && (
                      <button onClick={() => void move(x)} className="rounded-lg bg-[#ffb000] px-3 py-1.5 text-xs font-bold">Advance status</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : <Empty label="No trips assigned yet. Create one from an available load." />}
      </Panel>

      {open && (
        <Modal title="Assign trip" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Select label="Available load" value={form.load_id} onChange={v => setForm({ ...form, load_id: v })}>
              <option value="">Select a load</option>
              {availableLoads.map(x => (
                <option key={x.id} value={x.id}>{x.from_city} to {x.to_city} — {x.goods}</option>
              ))}
            </Select>
            <Select label="Driver / owner" value={form.driver_id} onChange={v => setForm({ ...form, driver_id: v })}>
              <option value="">Select a driver</option>
              {drivers.filter(x => x.account_status === 'active').map(x => (
                <option key={x.id} value={x.id}>{x.full_name}</option>
              ))}
            </Select>
            {formError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
              {saving ? 'Saving...' : 'Create trip'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

type InvoicesProps = { onUpdate: (message: string) => void };

export function Invoices({ onUpdate }: InvoicesProps) {
  const [invoices, setInvoices] = useState<SupabaseInvoice[]>([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<SupabaseInvoice | null>(null);

  const fetchInvoices = async () => {
    const { data, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) { setError('Invoice data could not be loaded.'); return; }
    setInvoices((data ?? []) as SupabaseInvoice[]);
    setError('');
  };

  useEffect(() => { void fetchInvoices(); }, []);

  const recordPayment = async (invoice: SupabaseInvoice) => {
    const nextStatus = invoice.status === 'paid' ? 'pending' : 'paid';
    const paidAmount = nextStatus === 'paid' ? invoice.total_amount : 0;
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: nextStatus, paid_amount: paidAmount })
      .eq('id', invoice.id);
    if (updateError) { setError('Could not update the invoice.'); return; }
    onUpdate(nextStatus === 'paid' ? 'Payment recorded' : 'Invoice reopened');
    void fetchInvoices();
  };

  const badge = (status: string) =>
    status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
    status === 'overdue' ? 'bg-red-100 text-red-700' :
    'bg-amber-100 text-amber-700';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#e87500]">Billing workspace</p>
        <h2 className="heading mt-1 text-3xl font-bold">Invoices & Payments</h2>
      </div>
      <Panel title="Invoice history" action={
        <button onClick={() => void fetchInvoices()} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {invoices.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Invoice no.</th>
              <th className="px-4 py-3">GC no.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
            {invoices.map(x => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{x.invoice_number}</td>
                <td className="px-4 py-3">{x.gc_number ?? '—'}</td>
                <td className="px-4 py-3">{x.invoice_date}</td>
                <td className="px-4 py-3">{money(x.total_amount)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badge(x.status)}`}>{x.status}</span></td>
                <td className="flex gap-2 px-4 py-3">
                  <button onClick={() => setPreview(x)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">View</button>
                  <button onClick={() => void recordPayment(x)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">
                    {x.status === 'paid' ? 'Reopen' : 'Record payment'}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty label="Invoices are created automatically when trips are completed." />}
      </Panel>

      {preview && (
        <Modal title={`Invoice ${preview.invoice_number}`} onClose={() => setPreview(null)}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs font-bold uppercase text-slate-400">Consignor</p><p className="mt-1 font-semibold">{preview.consignor ?? '—'}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-400">Consignee</p><p className="mt-1 font-semibold">{preview.consignee ?? '—'}</p></div>
            </div>
            <div className="rounded-xl border border-slate-200">
              {([
                ['Freight', preview.freight],
                ['Hamali', preview.hamali],
                ['Other charges', preview.other_charges],
                ['GST', preview.gst],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 px-4 py-2.5">
                  <span className="text-slate-500">{label}</span><span className="font-semibold">{money(Number(value))}</span>
                </div>
              ))}
              <div className="flex justify-between bg-slate-50 px-4 py-3">
                <span className="font-bold">Advance</span><span className="font-semibold text-red-600">− {money(Number(preview.advance))}</span>
              </div>
              <div className="flex justify-between bg-[#fff7dc] px-4 py-3 text-base">
                <span className="font-bold">Total payable</span><span className="font-bold">{money(Number(preview.total_amount))}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
