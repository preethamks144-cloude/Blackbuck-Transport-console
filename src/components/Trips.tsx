import { FormEvent, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Download, Plus, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Panel, Empty, Table, Modal, Select, Field, today, money } from '@/components/ui';
import type { SupabaseDriver } from '@/components/Drivers';

export type SupabaseTrip = {
  id: string;
  trip_number: string;
  load_id: string;
  driver_id: string;
  status: string;
  assigned_date: string;
  advance_amount: number;
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

export type SupabasePayment = {
  id: string;
  invoice_id: string | null;
  amount: number;
  payment_type: string;
  payment_method: string;
  status: string;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
};

const BUSINESS = {
  name: 'Blackbuck Transport',
  address: 'Gadag, Karnataka',
  phone: '+91 90000 00000',
  gstin: 'Not configured',
};

const methodLabel = (method: string) =>
  method === 'upi' ? 'UPI' : method === 'qr_code' ? 'QR code' : method === 'net_banking' ? 'Net banking' : method === 'card' ? 'Card' : 'Cash';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

function downloadInvoicePdf(invoice: SupabaseInvoice, payment: SupabasePayment | null) {
  const rows: [string, string][] = [
    ['Invoice number', invoice.invoice_number],
    ['GC number', invoice.gc_number ?? '—'],
    ['Invoice date', invoice.invoice_date],
    ['Consignor', invoice.consignor ?? '—'],
    ['Consignee', invoice.consignee ?? '—'],
    ['Freight', money(Number(invoice.freight))],
    ['Hamali', money(Number(invoice.hamali))],
    ['Other charges', money(Number(invoice.other_charges))],
    ['GST', money(Number(invoice.gst))],
    ['Advance', `- ${money(Number(invoice.advance))}`],
    ['Total amount', money(Number(invoice.total_amount))],
    ['Paid amount', money(Number(invoice.paid_amount))],
    ['Balance due', money(Number(invoice.total_amount) - Number(invoice.paid_amount))],
    ['Status', invoice.status.toUpperCase()],
  ];
  if (payment) {
    rows.push(
      ['Payment method', methodLabel(payment.payment_method)],
      ['Transaction ID', payment.reference ?? '—'],
      ['Paid at', payment.paid_at ? formatDateTime(payment.paid_at) : '—'],
    );
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.invoice_number)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .brand { color: #e87500; font-weight: bold; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; font-size: 13px; }
  td.label { color: #64748b; }
  td.value { text-align: right; font-weight: bold; }
  .total td { background: #fff7dc; font-size: 15px; }
</style></head><body>
<h1><span class="brand">${esc(BUSINESS.name)}</span> — Tax Invoice</h1>
<p class="meta">${esc(BUSINESS.address)} · ${esc(BUSINESS.phone)} · GSTIN: ${esc(BUSINESS.gstin)}</p>
<table>
${rows.map(([label, value]) => `<tr><td class="label">${esc(label)}</td><td class="value">${esc(value)}</td></tr>`).join('')}
</table>
<p class="meta" style="margin-top:24px">Computer-generated invoice. Thank you for your business.</p>
</body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
}

function WhatsAppModal({ invoice, onClose, onSent }: { invoice: SupabaseInvoice; onClose: () => void; onSent: (message: string) => void }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Enter a valid WhatsApp number with country code, e.g. +91 98765 43210.'); return; }
    setSending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-whatsapp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id, phone: digits }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        setError(result.error ?? `WhatsApp could not send the invoice (error ${response.status}).`);
        setSending(false);
        return;
      }
      onSent(`Invoice ${invoice.invoice_number} sent as PDF on WhatsApp to ${phone}`);
      setSending(false);
      onClose();
    } catch {
      setError('Could not reach the WhatsApp service. Check your connection and try again.');
      setSending(false);
    }
  };
  return (
    <Modal title={`Send invoice ${invoice.invoice_number} on WhatsApp`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          The invoice PDF is delivered as a WhatsApp document message to this number through the official WhatsApp Business API.
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Registered mobile number</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" />
        </label>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button onClick={() => void send()} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-bold text-white disabled:opacity-60">
          <Send size={16} />{sending ? 'Sending PDF...' : 'Send PDF on WhatsApp'}
        </button>
      </div>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose, onDone }: { invoice: SupabaseInvoice; onClose: () => void; onDone: (message: string) => void }) {
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(Number(invoice.total_amount) - Number(invoice.paid_amount)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const outstanding = Number(invoice.total_amount) - Number(invoice.paid_amount);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!reference.trim()) { setError('Enter the transaction ID from your payment app or bank statement.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a valid payment amount greater than zero.'); return; }
    if (value > outstanding) { setError(`The payment amount cannot exceed the outstanding balance of ${money(outstanding)}.`); return; }
    setSaving(true);
    const paidAt = new Date().toISOString();
    const newPaid = Number(invoice.paid_amount) + value;
    const newStatus = newPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
    const { error: paymentError } = await supabase.from('payments').insert({
      invoice_id: invoice.id,
      amount: value,
      payment_type: 'freight_settlement',
      payment_method: method,
      status: 'verified',
      reference: reference.trim(),
      paid_at: paidAt,
    });
    if (paymentError) { setError(paymentError.message || 'Could not save the payment.'); setSaving(false); return; }
    const { error: invoiceError } = await supabase.from('invoices')
      .update({ paid_amount: newPaid, status: newStatus })
      .eq('id', invoice.id);
    setSaving(false);
    if (invoiceError) { setError('Payment saved but the invoice total could not be updated. Try refreshing the invoices page.'); return; }
    onDone(`Payment of ${money(value)} recorded for ${invoice.invoice_number}`);
    onClose();
  };
  return (
    <Modal title={`Record payment — ${invoice.invoice_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Invoice total</span><span className="font-bold">{money(Number(invoice.total_amount))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Already paid</span><span className="font-bold">{money(Number(invoice.paid_amount))}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">Outstanding</span><span className="font-bold text-[#e87500]">{money(outstanding)}</span></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Payment method" value={method} onChange={setMethod}>
            <option value="upi">UPI</option>
            <option value="qr_code">QR code</option>
            <option value="net_banking">Net banking</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </Select>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Amount (₹)</span>
            <input required type="number" min="1" max={outstanding} value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Transaction ID</span>
          <input required value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. UPI4821XXXX2103"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#ffb000] focus:bg-white" />
        </label>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
          <Banknote size={16} />{saving ? 'Saving...' : 'Save payment'}
        </button>
      </form>
    </Modal>
  );
}

function InvoiceEditModal({ invoice, onClose, onDone }: { invoice: SupabaseInvoice; onClose: () => void; onDone: (message: string) => void }) {
  const [form, setForm] = useState({
    freight: String(invoice.freight),
    hamali: String(invoice.hamali),
    other_charges: String(invoice.other_charges),
    gst: String(invoice.gst),
    advance: String(invoice.advance),
    consignor: invoice.consignor ?? '',
    consignee: invoice.consignee ?? '',
    gc_number: invoice.gc_number ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = (() => {
    const f = Number(form.freight) || 0;
    const h = Number(form.hamali) || 0;
    const o = Number(form.other_charges) || 0;
    const g = Number(form.gst) || 0;
    const a = Number(form.advance) || 0;
    return f + h + o + g - a;
  })();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const freight = Number(form.freight);
    if (!Number.isFinite(freight) || freight < 0) { setError('Freight must be a valid non-negative amount.'); return; }
    setSaving(true);
    const { error: updateError } = await supabase.from('invoices').update({
      freight: Number(form.freight) || 0,
      hamali: Number(form.hamali) || 0,
      other_charges: Number(form.other_charges) || 0,
      gst: Number(form.gst) || 0,
      advance: Number(form.advance) || 0,
      consignor: form.consignor.trim() || null,
      consignee: form.consignee.trim() || null,
      gc_number: form.gc_number.trim() || null,
    }).eq('id', invoice.id);
    setSaving(false);
    if (updateError) { setError(updateError.message || 'Could not update the invoice.'); return; }
    onDone('Invoice updated');
    onClose();
  };

  return (
    <Modal title={`Edit invoice ${invoice.invoice_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Consignor" value={form.consignor} onChange={v => setForm({ ...form, consignor: v })} placeholder="Sender name" required={false} />
          <Field label="Consignee" value={form.consignee} onChange={v => setForm({ ...form, consignee: v })} placeholder="Receiver name" required={false} />
          <Field label="GC number" value={form.gc_number} onChange={v => setForm({ ...form, gc_number: v })} placeholder="GC / GR number" required={false} />
          <Field label="Freight (₹)" value={form.freight} onChange={v => setForm({ ...form, freight: v })} placeholder="0" type="number" />
          <Field label="Hamali (₹)" value={form.hamali} onChange={v => setForm({ ...form, hamali: v })} placeholder="0" type="number" required={false} />
          <Field label="Other charges (₹)" value={form.other_charges} onChange={v => setForm({ ...form, other_charges: v })} placeholder="0" type="number" required={false} />
          <Field label="GST (₹)" value={form.gst} onChange={v => setForm({ ...form, gst: v })} placeholder="0" type="number" required={false} />
          <Field label="Advance (₹)" value={form.advance} onChange={v => setForm({ ...form, advance: v })} placeholder="0" type="number" required={false} />
        </div>
        <div className="flex justify-between rounded-xl bg-[#fff7dc] px-4 py-3">
          <span className="font-bold">Total payable</span><span className="font-bold">{money(total)}</span>
        </div>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}

type SupabaseLoadLite = { id: string; from_city: string; to_city: string; goods: string; price: number; status: string | null };

type TripsProps = { drivers: SupabaseDriver[]; onUpdate: (message: string) => void };

export function Trips({ drivers, onUpdate }: TripsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [trips, setTrips] = useState<SupabaseTrip[]>([]);
  const [loads, setLoads] = useState<SupabaseLoadLite[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ load_id: '', driver_id: '', advance: '0' });
  const [confirmComplete, setConfirmComplete] = useState<SupabaseTrip | null>(null);

  const fetchTrips = async () => {
    setLoading(true);
    const [tripResult, loadResult] = await Promise.all([
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
      supabase.from('loads').select('id, from_city, to_city, goods, price, status').order('created_at', { ascending: false }),
    ]);
    setLoading(false);
    if (tripResult.error) { setError('Trip data could not be loaded. Tap Refresh to try again.'); return; }
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
    const load = loadFor(form.load_id);
    if (!load) { setFormError('Select a load to assign.'); return; }
    if (!form.driver_id) { setFormError('Select a driver.'); return; }
    const advanceNum = Number(form.advance);
    if (!Number.isFinite(advanceNum) || advanceNum < 0) { setFormError('Advance amount must be zero or a positive number.'); return; }

    setSaving(true);
    const tripNumber = `TRP-${Date.now().toString().slice(-6)}`;
    const { error: tripError } = await supabase
      .from('trips')
      .insert({
        trip_number: tripNumber,
        load_id: form.load_id,
        driver_id: form.driver_id,
        status: 'assigned',
        assigned_date: today(),
        freight_amount: Number(load.price) || 0,
        advance_amount: advanceNum,
      });
    if (tripError) { setFormError(tripError.message || 'Could not assign the trip.'); setSaving(false); return; }
    await supabase.from('loads').update({ status: 'Confirmed' }).eq('id', form.load_id);
    setSaving(false);
    onUpdate('Trip assigned and load confirmed');
    setForm({ load_id: '', driver_id: '', advance: '0' });
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
      const { data: invoiceCount } = await supabase.from('invoices').select('id', { count: 'exact', head: true });
      const seq = (invoiceCount ?? 0) + 1;
      const invoiceNumber = `INV-${today().split('-').join('')}-${String(seq).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
      const freight = Number(trip.freight_amount) || Number(load?.price) || 0;
      const advance = Number(trip.advance_amount) || 0;
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
        advance,
        status: 'pending',
      });
      if (invoiceError) {
        setError('Trip was completed but the invoice could not be created. You can create one manually from the Invoices page.');
        void fetchTrips();
        return;
      }
      await supabase.from('notifications').insert({
        title: 'Trip completed',
        message: `Trip ${trip.trip_number} completed. Invoice ${invoiceNumber} generated.`,
        category: 'trip_completed',
        is_read: false,
      });
      onUpdate('Trip completed and invoice created');
    } else {
      onUpdate('Trip status updated to ongoing');
    }
    void fetchTrips();
  };

  const cancelTrip = async (trip: SupabaseTrip) => {
    const { error: cancelError } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id);
    if (cancelError) { setError('Could not cancel the trip.'); return; }
    await supabase.from('loads').update({ status: 'Available' }).eq('id', trip.load_id);
    onUpdate('Trip cancelled and load returned to available');
    void fetchTrips();
  };

  const badge = (status: string) =>
    status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
    status === 'assigned' || status === 'ongoing' ? 'bg-amber-100 text-amber-700' :
    status === 'cancelled' ? 'bg-red-100 text-red-700' :
    'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        {loading ? <Empty label="Loading trips..." /> : trips.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Trip no.</th>
              <th className="px-4 py-3">Driver / owner</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Freight</th>
              <th className="px-4 py-3">Advance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
            {trips.map(x => {
              const load = loadFor(x.load_id);
              return (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{x.trip_number}</td>
                  <td className="px-4 py-3">{driverName(x.driver_id)}</td>
                  <td className="px-4 py-3">{load ? `${load.from_city} → ${load.to_city}` : '—'}</td>
                  <td className="px-4 py-3">{money(Number(x.freight_amount))}</td>
                  <td className="px-4 py-3">{money(Number(x.advance_amount))}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badge(x.status)}`}>{x.status}</span></td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    {x.status === 'assigned' && <button onClick={() => void move(x)} className="rounded-lg bg-[#ffb000] px-3 py-1.5 text-xs font-bold">Start trip</button>}
                    {x.status === 'ongoing' && <button onClick={() => setConfirmComplete(x)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Complete trip</button>}
                    {(x.status === 'assigned' || x.status === 'ongoing') && <button onClick={() => void cancelTrip(x)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Cancel</button>}
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
            {availableLoads.length === 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">No available loads. Post a load first, then assign it to a driver.</p>}
            <Select label="Driver / owner" value={form.driver_id} onChange={v => setForm({ ...form, driver_id: v })}>
              <option value="">Select a driver</option>
              {drivers.filter(x => x.account_status === 'active').map(x => (
                <option key={x.id} value={x.id}>{x.full_name}</option>
              ))}
            </Select>
            <Field label="Advance amount (₹)" value={form.advance} onChange={v => setForm({ ...form, advance: v })} placeholder="0" type="number" required={false} />
            {formError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb000] py-3 font-bold disabled:opacity-60">
              {saving ? 'Saving...' : 'Create trip'}
            </button>
          </form>
        </Modal>
      )}

      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={20} /></div>
            <h2 className="heading mt-4 text-xl font-bold">Complete this trip?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Completing trip {confirmComplete.trip_number} will automatically generate an invoice. This cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmComplete(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold">Cancel</button>
              <button onClick={() => { void move(confirmComplete); setConfirmComplete(null); }} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">Complete trip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type InvoicesProps = { onUpdate: (message: string) => void };

export function Invoices({ onUpdate }: InvoicesProps) {
  const [invoices, setInvoices] = useState<SupabaseInvoice[]>([]);
  const [payments, setPayments] = useState<SupabasePayment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<SupabaseInvoice | null>(null);
  const [payTarget, setPayTarget] = useState<SupabaseInvoice | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<SupabaseInvoice | null>(null);
  const [editTarget, setEditTarget] = useState<SupabaseInvoice | null>(null);
  const [deleteId, setDeleteId] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (fetchError) { setError('Invoice data could not be loaded. Tap Refresh to try again.'); return; }
    setInvoices((data ?? []) as SupabaseInvoice[]);
    setError('');
  };

  const fetchPayments = async () => {
    const { data, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) return;
    setPayments((data ?? []) as SupabasePayment[]);
  };

  useEffect(() => { void fetchInvoices(); void fetchPayments(); }, []);

  const latestPaymentFor = (invoiceId: string) =>
    payments.find(p => p.invoice_id === invoiceId) ?? null;

  const openPaymentModal = (invoice: SupabaseInvoice) => { setError(''); setPayTarget(invoice); };

  const onPaymentDone = (message: string) => {
    onUpdate(message);
    void fetchInvoices();
    void fetchPayments();
  };

  const removeInvoice = async (invoiceId: string) => {
    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoiceId);
    setDeleteId('');
    if (deleteError) { setError('Could not delete the invoice. It may have payments linked to it.'); return; }
    onUpdate('Invoice deleted');
    void fetchInvoices();
  };

  const badge = (status: string) =>
    status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
    status === 'overdue' ? 'bg-red-100 text-red-700' :
    status === 'draft' ? 'bg-slate-100 text-slate-600' :
    'bg-amber-100 text-amber-700';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#e87500]">Billing workspace</p>
        <h2 className="heading mt-1 text-3xl font-bold">Invoices & Payments</h2>
      </div>
      <Panel title="Invoice history" action={
        <button onClick={() => { void fetchInvoices(); void fetchPayments(); }} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading ? <Empty label="Loading invoices..." /> : invoices.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Invoice no.</th>
              <th className="px-4 py-3">GC no.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Transaction ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
            {invoices.map(x => {
              const payment = latestPaymentFor(x.id);
              return (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{x.invoice_number}</td>
                  <td className="px-4 py-3">{x.gc_number ?? '—'}</td>
                  <td className="px-4 py-3">{x.invoice_date}</td>
                  <td className="px-4 py-3">{money(x.total_amount)}</td>
                  <td className="px-4 py-3">{money(x.paid_amount)}</td>
                  <td className="px-4 py-3">{payment?.reference ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badge(x.status)}`}>{x.status.replace('_', ' ')}</span></td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    <button onClick={() => setPreview(x)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">View</button>
                    <button onClick={() => downloadInvoicePdf(x, payment)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">PDF</button>
                    <button onClick={() => setEditTarget(x)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">Edit</button>
                    <button onClick={() => setWhatsappTarget(x)} className="flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white"><Send size={12} />WhatsApp</button>
                    {x.status !== 'paid' && <button onClick={() => openPaymentModal(x)} className="rounded-lg bg-[#ffb000] px-2.5 py-1.5 text-xs font-bold">Record payment</button>}
                    {x.status !== 'paid' && (deleteId === x.id
                      ? <button onClick={() => void removeInvoice(x.id)} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white">Confirm delete</button>
                      : <button onClick={() => setDeleteId(x.id)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">Delete</button>)}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : <Empty label="Invoices are created automatically when trips are completed." />}
      </Panel>

      {whatsappTarget && (
        <WhatsAppModal invoice={whatsappTarget} onClose={() => setWhatsappTarget(null)} onSent={onUpdate} />
      )}
      {payTarget && (
        <PaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onDone={onPaymentDone} />
      )}
      {editTarget && (
        <InvoiceEditModal invoice={editTarget} onClose={() => setEditTarget(null)} onDone={onUpdate} />
      )}

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
              <div className="flex justify-between border-t border-slate-100 px-4 py-2.5">
                <span className="text-slate-500">Paid</span><span className="font-semibold text-emerald-600">{money(Number(preview.paid_amount))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Balance due</span><span className="font-bold text-[#e87500]">{money(Number(preview.total_amount) - Number(preview.paid_amount))}</span>
              </div>
            </div>
            {(() => {
              const payment = latestPaymentFor(preview.id);
              if (!payment) return <div className="rounded-xl bg-slate-50 p-4 text-slate-500">No payment recorded yet for this invoice.</div>;
              return (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase text-emerald-700">Latest payment</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-emerald-700">Method</p><p className="font-semibold">{methodLabel(payment.payment_method)}</p></div>
                    <div><p className="text-xs text-emerald-700">Transaction ID</p><p className="font-semibold">{payment.reference ?? '—'}</p></div>
                    <div><p className="text-xs text-emerald-700">Date &amp; time</p><p className="font-semibold">{payment.paid_at ? formatDateTime(payment.paid_at) : '—'}</p></div>
                    <div><p className="text-xs text-emerald-700">Amount</p><p className="font-semibold">{money(Number(payment.amount))}</p></div>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => downloadInvoicePdf(preview, latestPaymentFor(preview.id))} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#050505] py-3 text-sm font-bold text-white"><Download size={16} />Download PDF</button>
              <button onClick={() => { setWhatsappTarget(preview); setPreview(null); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white"><Send size={16} />Send on WhatsApp</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
