"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Item = {
  id: string;
  item_code: string;
  name: string;
  category: string | null;
  total_quantity: number;
  damaged_quantity: number;
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState("1");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, item_code, name, category, total_quantity, damaged_quantity")
      .order("item_code", { ascending: true });
    if (error) setError(error.message);
    else setItems((data ?? []) as Item[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name: name.trim(),
        category: category.trim() || null,
        total_quantity: Number(qty),
      })
      .select("item_code")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setMsg(`${name.trim()} added as ${data.item_code}`);
    setName("");
    setCategory("");
    setQty("1");
    load();
  }

  async function updateField(
    id: string,
    field: "total_quantity" | "damaged_quantity",
    value: string,
    current: number
  ) {
    const n = Number(value);
    if (Number.isNaN(n) || n === current) return;
    const { error } = await supabase
      .from("inventory_items")
      .update({ [field]: n })
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setError("");
      setMsg("Saved");
    }
    load();
  }

  const q = search.trim().toLowerCase();
  const shown = q
    ? items.filter(
        (i) =>
          i.item_code.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q)
      )
    : items;

  const input = "rounded border p-2";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>

      <form onSubmit={addItem} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Item name</label>
          <input required className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Round arch (gold)" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <input className={input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Arches" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Quantity owned</label>
          <input required type="number" min="0" className={`${input} w-28`} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <button className="rounded bg-black px-4 py-2 text-white">Add item</button>
      </form>

      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <input
        className={`${input} w-full max-w-sm`}
        placeholder="Search by code, name or category"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {shown.length === 0 ? (
        <p>{items.length === 0 ? "No items yet. Add your first one above." : "No matching items."}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Code</th>
              <th>Item</th>
              <th>Category</th>
              <th>Total owned</th>
              <th>Damaged</th>
              <th>Usable</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-2 font-medium">{i.item_code}</td>
                <td>{i.name}</td>
                <td>{i.category ?? "-"}</td>
                <td>
                  <input
                    key={`${i.id}-t-${i.total_quantity}`}
                    type="number"
                    min="0"
                    className="w-24 rounded border p-1"
                    defaultValue={i.total_quantity}
                    onBlur={(e) => updateField(i.id, "total_quantity", e.target.value, i.total_quantity)}
                  />
                </td>
                <td>
                  <input
                    key={`${i.id}-d-${i.damaged_quantity}`}
                    type="number"
                    min="0"
                    className="w-24 rounded border p-1"
                    defaultValue={i.damaged_quantity}
                    onBlur={(e) => updateField(i.id, "damaged_quantity", e.target.value, i.damaged_quantity)}
                  />
                </td>
                <td>{i.total_quantity - i.damaged_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-sm text-gray-500">Edit a number and click outside the box to save it.</p>
    </div>
  );
}