"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

type Ev = {
  id: string;
  event_code: string;
  event_type: string;
  event_date: string;
  status: string;
  design_approved: boolean;
  block_start: string;
  venue_name: string | null;
  customers: { name: string } | null;
};
type Res = {
  event_id: string;
  quantity: number;
  packed: boolean;
  inventory_items: { item_code: string; name: string } | null;
};
type Task = {
  id: string;
  title: string;
  due_date: string;
  assigned_to: string;
  events: { event_code: string } | null;
  profiles: { full_name: string } | null;
};
type Fin = { event_id: string; balance_due: number };

const dateStr = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
};

const prettyDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const money = (n: number) => Number(n).toLocaleString();

export default function Dashboard() {
  const profile = useProfile();
  const isOwner = profile?.role === "owner";

  const [events, setEvents] = useState<Ev[]>([]);
  const [reservations, setReservations] = useState<Res[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fin, setFin] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const today = dateStr(0);
  const tomorrow = dateStr(1);
  const in3 = dateStr(3);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      // Open events from the past up to 3 days ahead
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select(
          "id, event_code, event_type, event_date, status, design_approved, block_start, venue_name, customers(name)"
        )
        .not("status", "in", "(closed,cancelled)")
        .lte("event_date", in3)
        .order("event_date", { ascending: true })
        .order("block_start", { ascending: true });
      if (evErr) {
        setError(evErr.message);
        return;
      }
      const list = (ev ?? []) as unknown as Ev[];
      setEvents(list);

      if (list.length > 0) {
        const ids = list.map((e) => e.id);
        const { data: r } = await supabase
          .from("reservations")
          .select("event_id, quantity, packed, inventory_items(item_code, name)")
          .in("event_id", ids);
        setReservations((r ?? []) as unknown as Res[]);

        if (profile?.role === "owner") {
          const { data: f } = await supabase
            .from("event_financials")
            .select("event_id, balance_due")
            .in("event_id", ids);
          const map: Record<string, number> = {};
          (f ?? []).forEach((x: Fin) => (map[x.event_id] = Number(x.balance_due)));
          setFin(map);
        }
      }

      // Unfinished tasks due by tomorrow (includes overdue)
      const { data: t } = await supabase
        .from("tasks")
        .select("id, title, due_date, assigned_to, events(event_code), profiles(full_name)")
        .neq("status", "done")
        .lte("due_date", tomorrow)
        .order("due_date", { ascending: true });
      setTasks((t ?? []) as unknown as Task[]);
      setLoaded(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!loaded) return <p>Loading...</p>;

  const upcoming = events.filter((e) => e.event_date >= today);
  const needsClosing = events.filter((e) => e.event_date < today);
  const myTasks = isOwner ? tasks : tasks.filter((t) => t.assigned_to === profile?.id);
  const overdue = myTasks.filter((t) => t.due_date < today);
  const dueSoon = myTasks.filter((t) => t.due_date >= today);

  const resFor = (id: string) => reservations.filter((r) => r.event_id === id);
  const balanceRows = events.filter((e) => (fin[e.id] ?? 0) > 0);
  const totalOutstanding = balanceRows.reduce((s, e) => s + (fin[e.id] ?? 0), 0);

  const dayLabel = (d: string) =>
    d === today ? "Today" : d === tomorrow ? "Tomorrow" : prettyDate(d);

  const card = "rounded border p-4";
  const stat = (text: string, value: string | number, bad = false) => (
    <div className={card}>
      <p className="text-sm text-gray-500">{text}</p>
      <p className={`text-2xl font-bold ${bad ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Morning check</h1>
        <p className="text-gray-500">{prettyDate(today)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stat("Events, next 3 days", upcoming.length)}
        {stat("Overdue tasks", overdue.length, overdue.length > 0)}
        {stat("Past events to close", needsClosing.length, needsClosing.length > 0)}
        {isOwner && stat("Outstanding balances", money(totalOutstanding), totalOutstanding > 0)}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Events, today and the next 3 days</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-500">Nothing scheduled.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((e) => {
              const rs = resFor(e.id);
              const packed = rs.filter((r) => r.packed).length;
              return (
                <div key={e.id} className={card}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/events/${e.id}`} className="font-semibold underline">
                        {e.event_code}
                      </Link>{" "}
                      {e.customers?.name} | {e.event_type}
                    </div>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {dayLabel(e.event_date)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {e.venue_name || "Venue not set"} | team leaves{" "}
                    {new Date(e.block_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    | {e.status.replace("_", " ")}
                  </p>

                  {!e.design_approved && (
                    <p className="mt-2 text-sm text-red-600">No approved design uploaded</p>
                  )}

                  {rs.length === 0 ? (
                    <p className="mt-2 text-sm text-orange-600">No inventory reserved</p>
                  ) : (
                    <div className="mt-2 text-sm">
                      <p className={packed === rs.length ? "text-green-600" : "text-orange-600"}>
                        Packed {packed} of {rs.length}
                      </p>
                      <ul className="mt-1 text-gray-600">
                        {rs.map((r, i) => (
                          <li key={i}>
                            {r.packed ? "[x]" : "[ ]"} {r.inventory_items?.item_code}{" "}
                            {r.inventory_items?.name} x{r.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isOwner && (fin[e.id] ?? 0) > 0 && (
                    <p className="mt-2 text-sm text-red-600">
                      Balance due: {money(fin[e.id])}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Past events not closed (items to check back in)
        </h2>
        {needsClosing.length === 0 ? (
          <p className="text-gray-500">All past events are closed.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Event</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items reserved</th>
                {isOwner && <th>Balance due</th>}
              </tr>
            </thead>
            <tbody>
              {needsClosing.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2">
                    <Link href={`/events/${e.id}`} className="font-medium underline">
                      {e.event_code}
                    </Link>
                  </td>
                  <td>{e.customers?.name}</td>
                  <td>{e.event_date}</td>
                  <td>{e.status.replace("_", " ")}</td>
                  <td>{resFor(e.id).length}</td>
                  {isOwner && (
                    <td className={(fin[e.id] ?? 0) > 0 ? "text-red-600" : ""}>
                      {money(fin[e.id] ?? 0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {isOwner ? "Tasks, overdue and due by tomorrow" : "Your tasks, overdue and due by tomorrow"}
        </h2>
        {myTasks.length === 0 ? (
          <p className="text-gray-500">No urgent tasks.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Task</th>
                <th>Event</th>
                <th>Owner</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {[...overdue, ...dueSoon].map((t) => {
                const late = t.due_date < today;
                return (
                  <tr key={t.id} className="border-b">
                    <td className="py-2 font-medium">{t.title}</td>
                    <td>{t.events?.event_code ?? "-"}</td>
                    <td>{t.profiles?.full_name ?? "-"}</td>
                    <td className={late ? "font-semibold text-red-600" : ""}>
                      {t.due_date}
                      {late ? " (overdue)" : t.due_date === today ? " (today)" : " (tomorrow)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Balances to collect</h2>
          {balanceRows.length === 0 ? (
            <p className="text-gray-500">No outstanding balances on open events.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Event</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Balance due</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">
                      <Link href={`/events/${e.id}`} className="font-medium underline">
                        {e.event_code}
                      </Link>
                    </td>
                    <td>{e.customers?.name}</td>
                    <td>
                      {e.event_date}
                      {e.event_date < today && (
                        <span className="text-red-600"> (event passed)</span>
                      )}
                    </td>
                    <td className="font-semibold text-red-600">{money(fin[e.id])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}