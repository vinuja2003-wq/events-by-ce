"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

type Member = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "owner" | "member";
  active: boolean;
};

export default function TeamPage() {
  const profile = useProfile();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role, active")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setMembers((data ?? []) as Member[]);
  }, []);

  useEffect(() => {
    if (profile?.role === "owner") load();
  }, [profile, load]);

  if (profile?.role !== "owner") {
    return <p>Only the owner can manage the team.</p>;
  }

  async function save(id: string, changes: Partial<Member>) {
    const { error } = await supabase.from("profiles").update(changes).eq("id", id);
    if (error) {
      setMsg("");
      setError(error.message);
    } else {
      setError("");
      setMsg("Saved");
    }
    load();
  }

  const input = "rounded border p-1";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="text-sm text-gray-500">
        To add someone, create their login in Supabase (Authentication, Users, Add user), then set
        their name and role here. Members can see events, inventory and tasks but never payments,
        expenses or enquiries.
      </p>

      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Name</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isMe = m.id === profile.id;
            return (
              <tr key={m.id} className="border-b">
                <td className="py-2">
                  <input
                    key={`${m.id}-n-${m.full_name}`}
                    className={`${input} w-56`}
                    defaultValue={m.full_name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== m.full_name) save(m.id, { full_name: v });
                    }}
                  />
                </td>
                <td>
                  <input
                    key={`${m.id}-p-${m.phone}`}
                    className={`${input} w-40`}
                    defaultValue={m.phone ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (m.phone ?? "")) save(m.id, { phone: v || null });
                    }}
                  />
                </td>
                <td>
                  <select
                    className={input}
                    value={m.role}
                    disabled={isMe}
                    onChange={(e) => save(m.id, { role: e.target.value as Member["role"] })}
                  >
                    <option value="member">member</option>
                    <option value="owner">owner</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={m.active}
                    disabled={isMe}
                    onChange={() => save(m.id, { active: !m.active })}
                  />
                  {isMe && <span className="ml-2 text-gray-400">(you)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-sm text-gray-500">Edit a name or phone and click outside the box to save.</p>
    </div>
  );
}