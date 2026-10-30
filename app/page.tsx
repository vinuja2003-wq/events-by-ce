"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

type Row = {
  id: string;
  event_code: string;
  event_type: string;
  event_date: string;
  status: string;
  customers: { name: string; phone: string | null } | null;
};
type Fin = { event_id: string; balance_due: number; payment_status: string };

export default function EventsPage() {
  const profile = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [fin, setFin] = useState<Record<string, Fin>>({});
  const [designs, setDesigns] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_code, event_type, event_date, status, customers(name, phone)")
        .neq("status", "cancelled")
        .order("event_date", { ascending: true });
      if (error) {
        setError(error.message);
        return;
      }
      const list = data as unknown as Row[];
      setRows(list);

      // Design images (signed links, valid for 1 hour)
      if (list.length > 0) {
        const { data: files } = await supabase
          .from("event_files")
          .select("event_id, storage_path")
          .eq("category", "design")
          .in("event_id", list.map((r) => r.id))
          .order("created_at", { ascending: false });

        if (files && files.length > 0) {
          const latest: Record<string, string> = {};
          files.forEach((x) => {
            if (!latest[x.event_id]) latest[x.event_id] = x.storage_path;
          });
          const paths = Object.values(latest);
          const { data: signed } = await supabase.storage
            .from("event-files")
            .createSignedUrls(paths, 3600);

          const urlByPath: Record<string, string> = {};
          (signed ?? []).forEach((s) => {
            if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
          });
          const map: Record<string, string> = {};
          Object.entries(latest).forEach(([eventId, p]) => {
            if (urlByPath[p]) map[eventId] = urlByPath[p];
          });
          setDesigns(map);
        }
      }

      if (profile?.role === "owner") {
        const { data: f } = await supabase
          .from("event_financials")
          .select("event_id, balance_due, payment_status");
        const map: Record<string, Fin> = {};
        (f ?? []).forEach((x: Fin) => (map[x.event_id] = x));
        setFin(map);
      }
    }
    load();
  }, [profile]);

  const isOwner = profile?.role === "owner";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Events</h1>
      {error && <p className="text-red-600">{error}</p>}
      {rows.length === 0 && !error && <p>No events yet.</p>}
      {rows.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">ID</th>
              <th>Design</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Date</th>
              <th>Status</th>
              {isOwner && <th>Balance due</th>}
              {isOwner && <th>Payment</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 font-medium">{r.event_code}</td>
                <td className="py-2">
                  {designs[r.id] ? (
                    <a href={designs[r.id]} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={designs[r.id]}
                        alt={`Design for ${r.event_code}`}
                        className="h-14 w-14 rounded object-cover"
                      />
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td>{r.customers?.name}</td>
                <td>{r.event_type}</td>
                <td>{r.event_date}</td>
                <td>{r.status}</td>
                {isOwner && <td>{fin[r.id]?.balance_due ?? "-"}</td>}
                {isOwner && <td>{fin[r.id]?.payment_status ?? "-"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}