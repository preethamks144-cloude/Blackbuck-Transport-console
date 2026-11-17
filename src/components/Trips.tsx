import { FormEvent, useEffect, useState } from 'react';
import { Banknote, Download, Plus, Send, X } from 'lucide-react';
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
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!reference.trim()) { setError('Enter the transaction ID from your payment app or bank statement.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a valid payment amount.'); return; }
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
    if (invoiceError) { setError('Payment saved but the invoice total could not be updated.'); return; }
    onDone(`Payment of ${money(value)} recorded for ${invoice.invoice_number}`);
    onClose();
  };
  return (
    <Modal title={`Record payment — ${invoice.invoice_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
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
            <input required type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
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
  const [payments, setPayments] = useState<SupabasePayment[]>([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<SupabaseInvoice | null>(null);
  const [payTarget, setPayTarget] = useState<SupabaseInvoice | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<SupabaseInvoice | null>(null);

  const fetchInvoices = async () => {
    const { data, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) { setError('Invoice data could not be loaded.'); return; }
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
        <button onClick={() => { void fetchInvoices(); void fetchPayments(); }} className="text-xs font-bold text-[#e87500]">Refresh</button>
      }>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {invoices.length ? (
          <Table>
            <tr>
              <th className="px-4 py-3">Invoice no.</th>
              <th className="px-4 py-3">GC no.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
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
                  <td className="px-4 py-3">{payment?.reference ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${badge(x.status)}`}>{x.status}</span></td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    <button onClick={() => setPreview(x)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">View</button>
                    <button onClick={() => downloadInvoicePdf(x, payment)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">PDF</button>
                    <button onClick={() => setWhatsappTarget(x)} className="flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white"><Send size={12} />WhatsApp</button>
                    {x.status !== 'paid' && <button onClick={() => openPaymentModal(x)} className="rounded-lg bg-[#ffb000] px-2.5 py-1.5 text-xs font-bold">Record payment</button>}
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
