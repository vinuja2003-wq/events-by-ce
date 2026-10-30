"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Item = { id: string; item_code: string; name: string; category: string | null };
type Reservation = {
  id: string;
  item_id: string;
  quantity: number;
  packed: boolean;
  inventory_items: { item_code: string; name: string } | null;
};

export default function EventInventory({
  eventId,
  blockStart,
  blockEnd,
}: {
  eventId: string;
  blockStart: string;
  blockEnd: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [avail, setAvail] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Reservation[]>([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data: its } = await supabase
      .from("inventory_items")
      .select("id, item_code, name, category")
      .order("item_code");
    const list = (its ?? []) as Item[];
    setItems(list);

    const entries = await Promise.all(
      list.map(async (i) => {
        const { data } = await supabase.rpc("available_quantity", {
          p_item: i.id,
          p_start: blockStart,
          p_end: blockEnd,
          p_exclude_event: eventId,
        });
        return [i.id, Number(data ?? 0)] as const;
      })
    );
    setAvail(Object.fromEntries(entries));

    const { data: r } = await supabase
      .from("reservations")
      .select("id, item_id, quantity, packed, inventory_items(item_code, name)")
      .eq("event_id", eventId);
    setRes((r ?? []) as unknown as Reservation[]);
  }, [eventId, blockStart, blockEnd]);

  useEffect(() => {
    load();
  }, [load]);

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    const { error } = await supabase
      .from("reservations")
      .upsert(
        { event_id: eventId, item_id: itemId, quantity: Number(qty) },
        { onConflict: "event_id,item_id" }
      );
    if (error) {
      setMsg("");
      setError(error.message);
      return;
    }
    setError("");
    setMsg("Reserved");
    setQty("1");
    load();
  }

  async function togglePacked(r: Reservation) {
    const { error } = await supabase
      .from("reservations")
      .update({ packed: !r.packed })
      .eq("id", r.id);
    if (error) setError(error.message);
    load();
  }

  async function remove(r: Reservation) {
    const { error } = await supabase.from("reservations").delete().eq("id", r.id);
    if (error) setError(error.message);
    else setMsg("Removed");
    load();
  }

  const packedCount = res.filter((r) => r.packed).length;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        Inventory and packing{" "}
        {res.length > 0 && (
          <span className="text-sm font-normal text-gray-500">
            ({packedCount} of {res.length} packed)
          </span>
        )}
      </h2>

      {res.length > 0 && (
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Code</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Packed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {res.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 font-medium">{r.inventory_items?.item_code}</td>
                <td>{r.inventory_items?.name}</td>
                <td>{r.quantity}</td>
                <td>
                  <input type="checkbox" checked={r.packed} onChange={() => togglePacked(r)} />
                </td>
                <td>
                  <button onClick={() => remove(r)} className="text-red-600 underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Add items on the Inventory page first.</p>
      ) : (
        <form onSubmit={reserve} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Item</label>
            <select
              required
              className="rounded border p-2"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Choose item...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} {i.name} ({avail[i.id] ?? 0} free)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Quantity</label>
            <input
              required
              type="number"
              min="1"
              className="w-24 rounded border p-2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <button className="rounded bg-black px-4 py-2 text-white">Reserve</button>
        </form>
      )}

      {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}