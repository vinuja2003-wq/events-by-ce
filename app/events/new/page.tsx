"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

const empty = {
  name: "",
  phone: "",
  eventType: "",
  eventDate: "",
  blockStart: "",
  blockEnd: "",
  venueName: "",
  venueAddress: "",
  quotation: "",
  advanceRequired: "",
  advanceReceived: "",
  method: "cash",
};

export default function NewBooking() {
  const profile = useProfile();
  const [f, setF] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  if (profile?.role !== "owner") {
    return <p>Only the owner can confirm bookings.</p>;
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setDone("");

    const { data, error } = await supabase.rpc("confirm_booking", {
      p_customer_name: f.name.trim(),
      p_customer_phone: f.phone.trim(),
      p_event_type: f.eventType.trim(),
      p_event_date: f.eventDate,
      p_block_start: new Date(f.blockStart).toISOString(),
      p_block_end: new Date(f.blockEnd).toISOString(),
      p_venue_name: f.venueName.trim(),
      p_venue_address: f.venueAddress.trim(),
      p_quotation_total: Number(f.quotation),
      p_advance_required: Number(f.advanceRequired || 0),
      p_advance_received: Number(f.advanceReceived || 0),
      p_method: f.method,
    });

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    // Upload the final agreed design image (if one was chosen)
    let uploadNote = "";
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${data.id}/design/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("event-files")
        .upload(path, file);

      if (upErr) {
        uploadNote = ` (image upload failed: ${upErr.message})`;
      } else {
        const { error: rowErr } = await supabase.from("event_files").insert({
          event_id: data.id,
          category: "design",
          storage_path: path,
          uploaded_by: profile?.id,
        });
        if (rowErr) {
          uploadNote = ` (image saved but not linked: ${rowErr.message})`;
        } else {
          await supabase.from("events").update({ design_approved: true }).eq("id", data.id);
        }
      }
    }

    setSaving(false);
    setDone(`Booking confirmed: ${data.event_code}${uploadNote}`);
    setF(empty);
    setFile(null);
    setFileKey(fileKey + 1);
  }

  const input = "w-full rounded border p-2";
  const label = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Confirm booking</h1>

      <div>
        <label className={label}>Customer name</label>
        <input required className={input} value={f.name} onChange={set("name")} />
      </div>
      <div>
        <label className={label}>Customer phone (repeat customers are matched by this)</label>
        <input required className={input} value={f.phone} onChange={set("phone")} />
      </div>
      <div>
        <label className={label}>Event type (Birthday, Wedding...)</label>
        <input required className={input} value={f.eventType} onChange={set("eventType")} />
      </div>
      <div>
        <label className={label}>Event date</label>
        <input required type="date" className={input} value={f.eventDate} onChange={set("eventDate")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Team leaves (block start)</label>
          <input required type="datetime-local" className={input} value={f.blockStart} onChange={set("blockStart")} />
        </div>
        <div>
          <label className={label}>Dismantle finished (block end)</label>
          <input required type="datetime-local" className={input} value={f.blockEnd} onChange={set("blockEnd")} />
        </div>
      </div>
      <div>
        <label className={label}>Venue name</label>
        <input className={input} value={f.venueName} onChange={set("venueName")} />
      </div>
      <div>
        <label className={label}>Venue address</label>
        <input className={input} value={f.venueAddress} onChange={set("venueAddress")} />
      </div>

      <div>
        <label className={label}>Final agreed event design (image)</label>
        <input
          key={fileKey}
          type="file"
          accept="image/*"
          className={input}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="mt-1 text-sm text-gray-500">Selected: {file.name}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label}>Quotation total</label>
          <input required type="number" min="0" className={input} value={f.quotation} onChange={set("quotation")} />
        </div>
        <div>
          <label className={label}>Advance required</label>
          <input type="number" min="0" className={input} value={f.advanceRequired} onChange={set("advanceRequired")} />
        </div>
        <div>
          <label className={label}>Advance received</label>
          <input type="number" min="0" className={input} value={f.advanceReceived} onChange={set("advanceReceived")} />
        </div>
      </div>
      <div>
        <label className={label}>Payment method</label>
        <select className={input} value={f.method} onChange={set("method")}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </div>

      <button disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {saving ? "Saving..." : "Confirm booking"}
      </button>

      {error && <p className="text-red-600">{error}</p>}
      {done && (
        <p className="text-green-600">
          {done}. <Link href="/" className="underline">View events</Link>
        </p>
      )}
    </form>
  );
}