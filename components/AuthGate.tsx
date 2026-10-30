"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; full_name: string; role: "owner" | "member" };

const ProfileContext = createContext<Profile | null>(null);
export const useProfile = () => useContext(ProfileContext);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();
    if (error) setMessage(error.message);
    else setProfile(data as Profile);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else {
      setMessage("");
      loadProfile();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  if (loading) return <p className="p-8">Loading...</p>;

  if (!profile) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="mb-6 text-2xl font-bold">Events By CE</h1>
        <form onSubmit={signIn} className="space-y-3">
          <input
            className="w-full rounded border p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded border p-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full rounded bg-black px-4 py-2 text-white">Sign in</button>
        </form>
        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </main>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-6">
          <span className="font-bold">Events By CE</span>
          <Link href="/" className="hover:underline">Events</Link>
                    <Link href="/inventory" className="hover:underline">Inventory</Link>
          {profile.role === "owner" && (
            <Link href="/events/new" className="hover:underline">New booking</Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span>{profile.full_name} ({profile.role})</span>
          <button onClick={signOut} className="rounded border px-3 py-1">Sign out</button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl p-6">{children}</div>
    </ProfileContext.Provider>
  );
}