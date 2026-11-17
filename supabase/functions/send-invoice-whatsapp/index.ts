// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const money = (value) =>
  `\u20b9${Number(value || 0).toLocaleString("en-IN")}`;

function buildInvoiceHtml(invoice, business) {
  const rows = [
    ["Invoice number", invoice.invoice_number],
    ["GC number", invoice.gc_number ?? "\u2014"],
    ["Invoice date", invoice.invoice_date],
    ["Consignor", invoice.consignor ?? "\u2014"],
    ["Consignee", invoice.consignee ?? "\u2014"],
    ["Freight", money(invoice.freight)],
    ["Hamali", money(invoice.hamali)],
    ["Other charges", money(invoice.other_charges)],
    ["GST", money(invoice.gst)],
    ["Advance", `- ${money(invoice.advance)}`],
    ["Total amount", money(invoice.total_amount)],
    ["Paid amount", money(invoice.paid_amount)],
    ["Balance due", money(Number(invoice.total_amount) - Number(invoice.paid_amount))],
    ["Status", String(invoice.status).toUpperCase()],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .brand { color: #e87500; font-weight: bold; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; font-size: 13px; }
  td.label { color: #64748b; }
  td.value { text-align: right; font-weight: bold; }
</style></head><body>
<h1><span class="brand">${escapeHtml(business.name)}</span> \u2014 Tax Invoice</h1>
<p class="meta">${escapeHtml(business.address)} \u00b7 ${escapeHtml(business.phone)}</p>
<table>
${rows.map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`).join("")}
</table>
<p class="meta" style="margin-top:24px">Computer-generated invoice. Thank you for your business.</p>
</body></html>`;
}

// Minimal two-pass PDF writer (no external dependencies):
// builds an uncompressed PDF from simple text/line content streams.
function buildPdf(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const content = [];
  content.push("0 0 0 rg 0 0 0 RG");
  content.push("BT /F2 18 Tf 50 790 Td (Blackbuck Transport - Tax Invoice) Tj ET");
  content.push("0.39 0.39 0.39 rg");
  content.push("BT /F1 9 Tf 50 770 Td (Gadag, Karnataka) Tj ET");
  let y = 730;
  for (const line of lines) {
    const { text, bold, size = 10, gray = false, indent = 0 } = line;
    const escaped = text.replace(/\\\\/g, "\\\\").replace(/\\(/g, "\\(").replace(/\\)/g, "\\)");
    content.push(`${gray ? "0.45 0.45 0.45" : "0 0 0"} rg`);
    content.push(`BT /F${bold ? 2 : 1} ${size} Tf ${50 + indent} ${y} Td (${escaped}) Tj ET`);
    y -= size + 8;
  }
  const stream = content.join("\\n");

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`);
  objects.push(`<< /Length ${stream.length} >>\\nstream\\n${stream}\\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\\n${body}\\nendobj\\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \\n`;
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefStart}\\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { invoice_id, phone } = await req.json();
    if (!invoice_id || !phone) {
      return new Response(JSON.stringify({ error: "invoice_id and phone are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp Business API is not configured yet. Add the WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID secrets." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const business = { name: "Blackbuck Transport", address: "Gadag, Karnataka", phone: "+91 90000 00000" };
    const html = buildInvoiceHtml(invoice, business);

    // Convert the HTML invoice to PDF text lines (plain, reliable rendering)
    const doc = new DOMParser().parseFromString(html, "text/html");
    const lines = [];
    doc.querySelectorAll("td.label").forEach((cell) => {
      const value = cell.nextElementSibling?.textContent ?? "";
      lines.push({ text: `${cell.textContent}: ${value}`, size: 11 });
    });
    lines.push({ text: `Balance due: ${money(Number(invoice.total_amount) - Number(invoice.paid_amount))}`, bold: true, size: 12 });

    const pdfBytes = buildPdf(lines);
    const fileName = `${invoice.invoice_number}.pdf`;

    // 1. Upload the PDF to the WhatsApp media endpoint
    const form = new FormData();
    form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName);
    form.append("messaging_product", "whatsapp");
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson.id) {
      return new Response(JSON.stringify({ error: uploadJson.error?.message ?? "Could not upload the invoice PDF to WhatsApp." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Send it as a document message to the recipient
    const digits = String(phone).replace(/\\D/g, "");
    const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "document",
        document: { id: uploadJson.id, filename: fileName, caption: `Invoice ${invoice.invoice_number} - ${business.name}` },
      }),
    });
    const sendJson = await sendRes.json();
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: sendJson.error?.message ?? "WhatsApp rejected the send request." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, messageId: sendJson.messages?.[0]?.id ?? null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message ?? "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
