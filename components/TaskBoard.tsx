"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

type Task = {
  id: string;
  event_id: string | null;
  title: string;
  category: string | null;
  assigned_to: string;
  due_date: string;
  status: string;
  events: { event_code: string } | null;
  profiles: { full_name: string } | null;
};
type Person = { id: string; full_name: string };
type EventOpt = { id: string; event_code: string; event_type: string; customers: { name: string } | null };

const CATEGORIES = ["design", "purchase", "custom_work", "packing", "logistics", "setup", "return", "other"];
const STATUSES = ["todo", "in_progress", "done", "blocked"];

const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const label = (s: string) => s.replace("_", " ");

export default function TaskBoard({ eventId }: { eventId?: string }) {
  const profile = useProfile();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [filter, setFilter] = useState<"mine" | "all" | "overdue" | "done">(eventId ? "all" : "mine");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [taskEvent, setTaskEvent] = useState("");

  const load = useCallback(async () => {
    let q = supabase
      .from("tasks")
      .select(
        "id, event_id, title, category, assigned_to, due_date, status, events(event_code), profiles(full_name)"
      )
      .order("due_date", { ascending: true });
    if (eventId) q = q.eq("event_id", eventId);
    const { data, error } = await q;
    if (error) {
      setError(error.message);
      return;
    }
    setTasks((data ?? []) as unknown as Task[]);

    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name");
    setPeople((p ?? []) as Person[]);

    if (!eventId) {
      const { data: ev } = await supabase
        .from("events")
        .select("id, event_code, event_type, customers(name)")
        .not("status", "in", "(closed,cancelled)")
        .order("event_date");
      setEvents((ev ?? []) as unknown as EventOpt[]);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile && !assignee) setAssignee(profile.id);
  }, [profile, assignee]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      category,
      assigned_to: assignee,
      due_date: due,
      event_id: eventId ?? (taskEvent || null),
    });
    if (error) {
      setMsg("");
      setError(error.message);
      return;
    }
    setError("");
    setMsg("Task added");
    setTitle("");
    setDue("");
    setCategory("other");
    setTaskEvent("");
    load();
  }

  async function setStatus(t: Task, status: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) setError(error.message);
    else setError("");
    load();
  }

  async function remove(t: Task) {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) setError(error.message);
    load();
  }

  const today = todayStr();
  const isOverdue = (t: Task) => t.status !== "done" && t.due_date < today;

  const shown = tasks
    .filter((t) => {
      if (filter === "mine") return t.assigned_to === profile?.id && t.status !== "done";
      if (filter === "overdue") return isOverdue(t);
      if (filter === "done") return t.status === "done";
      return true;
    })
    .sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      return a.due_date.localeCompare(b.due_date);
    });

  const overdueCount = tasks.filter(isOverdue).length;
  const input = "rounded border p-2";
  const tabs: ["mine" | "all" | "overdue" | "done", string][] = [
    ["mine", "My tasks"],
    ["all", "All"],
    ["overdue", `Overdue (${overdueCount})`],
    ["done", "Done"],
  ];

  return (
    <section className="space-y-4">
      {eventId && <h2 className="text-lg font-semibold">Tasks</h2>}

      <form onSubmit={addTask} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Task</label>
          <input
            required
            className={`${input} w-64`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Buy balloons"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{label(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Assigned to</label>
          <select required className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Deadline</label>
          <input required type="date" className={input} value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        {!eventId && (
          <div>
            <label className="mb-1 block text-sm font-medium">Event (optional)</label>
            <select className={input} value={taskEvent} onChange={(e) => setTaskEvent(e.target.value)}>
              <option value="">No event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.event_code} {ev.customers?.name} {ev.event_type}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="rounded bg-black px-4 py-2 text-white">Add task</button>
      </form>

      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, text]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded border px-3 py-1 text-sm ${filter === key ? "bg-black text-white" : ""}`}
          >
            {text}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500">No tasks here.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Task</th>
              {!eventId && <th>Event</th>}
              <th>Category</th>
              <th>Owner</th>
              <th>Deadline</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="border-b">
                <td className={`py-2 ${t.status === "done" ? "text-gray-400 line-through" : "font-medium"}`}>
                  {t.title}
                </td>
                {!eventId && <td>{t.events?.event_code ?? "-"}</td>}
                <td>{t.category ? label(t.category) : "-"}</td>
                <td>{t.profiles?.full_name ?? "-"}</td>
                <td className={isOverdue(t) ? "font-semibold text-red-600" : ""}>
                  {t.due_date}
                  {isOverdue(t) && " (overdue)"}
                </td>
                <td>
                  <select
                    className="rounded border p-1"
                    value={t.status}
                    onChange={(e) => setStatus(t, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button onClick={() => remove(t)} className="text-red-600 underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}