"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";
import EventInventory from "@/components/EventInventory";
import TaskBoard from "@/components/TaskBoard";

type EventRow = {
  id: string;
  event_code: string;
  event_type: string;
  status: string;
  event_date: string;
  block_start: string;
  block_end: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_map_link: string | null;
  venue_contact: string | null;
  design_summary: string | null;
  colours: string | null;
  backdrop_type: string | null;
  special_instructions: string | null;
  vehicle: string | null;
  design_approved: boolean;
  customers: { name: string; phone: string | null; whatsapp: string | null } | null;
};

type Fin = {
  quotation_total: number;
  advance_required: number;
  total_received: number;
  balance_due: number;
  payment_status: string;
};

type Payment = {
  id: string;
  type: string;
  amount: number;
  method: string | null;
  received_on: string;
};

const emptyDetails = {
  venue_name: "",
  venue_address: "",
  venue_map_link: "",
  venue_contact: "",
  design_summary: "",
  colours: "",
  backdrop_type: "",
  special_instructions: "",
  vehicle: "",
};
type Details = typeof emptyDetails;

const STATUSES = [
  "confirmed",
  "preparing",
  "packed",
  "in_transit",
  "setup_done",
  "dismantled",
  "closed",
  "cancelled",
];

const money = (n: number | string) => Number(n).toLocaleString();
const when = (s: string) => new Date(s).toLocaleString();

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile();
  const isOwner = profile?.role === "owner";

  const [ev, setEv] = useState<EventRow | null>(null);
  const [d, setD] = useState<Details>(emptyDetails);
  const [fin, setFin] = useState<Fin | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("balance");
  const [payMethod, setPayMethod] = useState("cash");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imageKey, setImageKey] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*, customers(name, phone, whatsapp)")
      .eq("id", id)
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    const e = data as unknown as EventRow;
    setEv(e);
    setD({
      venue_name: e.venue_name ?? "",
      venue_address: e.venue_address ?? "",
      venue_map_link: e.venue_map_link ?? "",
      venue_contact: e.venue_contact ?? "",
      design_summary: e.design_summary ?? "",
      colours: e.colours ?? "",
      backdrop_type: e.backdrop_type ?? "",
      special_instructions: e.special_instructions ?? "",
      vehicle: e.vehicle ?? "",
    });

    const { data: files } = await supabase
      .from("event_files")
      .select("storage_path")
      .eq("event_id", id)
      .eq("category", "design")
      .order("created_at", { ascending: false })
      .limit(1);
    if (files && files[0]) {
      const { data: s } = await supabase.storage
        .from("event-files")
        .createSignedUrl(files[0].storage_path, 3600);
      setImageUrl(s?.signedUrl ?? "");
    } else {
      setImageUrl("");
    }

    if (isOwner) {
      const { data: f } = await supabase
        .from("event_financials")
        .select("quotation_total, advance_required, total_received, balance_due, payment_status")
        .eq("event_id", id)
        .single();
      setFin(f as Fin | null);

      const { data: p } = await supabase
        .from("payments")
        .select("id, type, amount, method, received_on")
        .eq("event_id", id)
        .order("received_on", { ascending: true });
      setPayments((p ?? []) as Payment[]);
    }
  }, [id, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: string) {
    if (!ev) return;
    if (status === "closed" && fin && Number(fin.balance_due) > 0) {
      const ok = window.confirm(
        `There is still ${money(fin.balance_due)} outstanding. Close this event anyway?`
      );
      if (!ok) return;
    }
    const { error } = await supabase
      .from("events")
      .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
      .eq("id", ev.id);
    if (error) setError(error.message);
    else {
      setError("");
      setMsg(`Status changed to ${status.replace("_", " ")}`);
      load();
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!ev) return;
    const { error } = await supabase.from("events").update(d).eq("id", ev.id);
    if (error) setError(error.message);
    else {
      setError("");
      setMsg("Details saved");
      load();
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!ev) return;
    const { error } = await supabase.from("payments").insert({
      event_id: ev.id,
      type: payType,
      amount: Number(payAmount),
      method: payMethod,
    });
    if (error) setError(error.message);
    else {
      setError("");
      setMsg("Payment recorded");
      setPayAmount("");
      load();
    }
  }

  async function replaceImage() {
    if (!ev || !newImage) return;
    const safeName = newImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ev.id}/design/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("event-files").upload(path, newImage);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    const { error: rowErr } = await supabase.from("event_files").insert({
      event_id: ev.id,
      category: "design",
      storage_path: path,
      uploaded_by: profile?.id,
    });
    if (rowErr) {
      setError(rowErr.message);
      return;
    }
    await supabase.from("events").update({ design_approved: true }).eq("id", ev.id);
    setError("");
    setMsg("Design image updated");
    setNewImage(null);
    setImageKey(imageKey + 1);
    load();
  }

  if (error && !ev) return <p className="text-red-600">{error}</p>;
  if (!ev) return <p>Loading...</p>;

  const input = "w-full rounded border p-2";
  const label = "block text-sm font-medium mb-1";
  const field = (k: keyof Details, text: string, multiline = false) => (
    <div>
      <label className={label}>{text}</label>
      {multiline ? (
        <textarea
          rows={3}
          className={input}
          value={d[k]}
          onChange={(e) => setD({ ...d, [k]: e.target.value })}
        />
      ) : (
        <input
          className={input}
          value={d[k]}
          onChange={(e) => setD({ ...d, [k]: e.target.value })}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm underline">← All events</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {ev.event_code} | {ev.customers?.name} | {ev.event_type}
          </h1>
          <div className="flex items-center gap-2">
            <label className="text-sm">Status</label>
            <select
              className="rounded border p-2"
              value={ev.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Booking</h2>
          <p><strong>Date:</strong> {ev.event_date}</p>
          <p><strong>Team committed:</strong> {when(ev.block_start)} to {when(ev.block_end)}</p>
          <p><strong>Customer:</strong> {ev.customers?.name}</p>
          <p><strong>Phone:</strong> {ev.customers?.phone ?? "-"}</p>
          <p>
            <strong>Design approved:</strong>{" "}
            {ev.design_approved ? "Yes" : <span className="text-red-600">No, upload the final design</span>}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Final agreed design</h2>
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Final design" className="max-h-80 rounded border object-contain" />
            </a>
          ) : (
            <p className="text-gray-500">No design image yet.</p>
          )}
          <div className="flex items-center gap-2">
            <input
              key={imageKey}
              type="file"
              accept="image/*"
              onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={replaceImage}
              disabled={!newImage}
              className="rounded bg-black px-3 py-1 text-white disabled:opacity-40"
            >
              {imageUrl ? "Replace" : "Upload"}
            </button>
          </div>
        </div>
      </section>
      <EventInventory eventId={ev.id} blockStart={ev.block_start} blockEnd={ev.block_end} />
            <TaskBoard eventId={ev.id} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Job details</h2>
        <form onSubmit={saveDetails} className="grid gap-4 md:grid-cols-2">
          {field("venue_name", "Venue name")}
          {field("venue_contact", "Venue contact")}
          {field("venue_address", "Venue address")}
          {field("venue_map_link", "Map link")}
          {field("colours", "Colours")}
          {field("backdrop_type", "Backdrop type")}
          {field("vehicle", "Vehicle")}
          <div />
          {field("design_summary", "Design / package summary", true)}
          {field("special_instructions", "Special instructions", true)}
          <div>
            <button className="rounded bg-black px-4 py-2 text-white">Save details</button>
          </div>
        </form>
      </section>

      {isOwner && fin && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Payments</h2>
          <div className="mb-4 grid gap-4 sm:grid-cols-4">
            <div className="rounded border p-3">
              <p className="text-sm text-gray-500">Quotation</p>
              <p className="text-lg font-semibold">{money(fin.quotation_total)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-gray-500">Advance required</p>
              <p className="text-lg font-semibold">{money(fin.advance_required)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-gray-500">Received</p>
              <p className="text-lg font-semibold">{money(fin.total_received)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-gray-500">Balance due ({fin.payment_status})</p>
              <p className="text-lg font-semibold">{money(fin.balance_due)}</p>
            </div>
          </div>

          {payments.length > 0 && (
            <table className="mb-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Date</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.received_on}</td>
                    <td>{p.type}</td>
                    <td>{p.method}</td>
                    <td>{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={addPayment} className="flex flex-wrap items-end gap-3">
            <div>
              <label className={label}>Type</label>
              <select className="rounded border p-2" value={payType} onChange={(e) => setPayType(e.target.value)}>
                <option value="advance">Advance</option>
                <option value="balance">Balance</option>
              </select>
            </div>
            <div>
              <label className={label}>Amount</label>
              <input
                required
                type="number"
                min="1"
                className="rounded border p-2"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Method</label>
              <select className="rounded border p-2" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button className="rounded bg-black px-4 py-2 text-white">Record payment</button>
          </form>
        </section>
      )}
    </div>
  );
}