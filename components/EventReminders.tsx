"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/components/AuthGate";

const COUNTRY_CODE = "94"; // Sri Lanka. Used to turn 077... into 9477...
const BUSINESS = "Events By CE";
const CURRENCY = "LKR";

export type ReminderEvent = {
  id: string;
  event_code: string;
  event_type: string;
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
  customers: { name: string; phone: string | null; whatsapp: string | null } | null;
};

const CHECKPOINTS = [
  {
    key: "d7",
    daysBefore: 7,
    title: "7 days before: planning",
    items: ["Design progress confirmed", "Custom work and purchases started"],
  },
  {
    key: "d2",
    daysBefore: 2,
    title: "48 hours before: job preparation",
    items: [
      "Inventory confirmed",
      "Custom work finished",
      "Materials bought",
      "Vehicle and driver confirmed",
    ],
  },
  {
    key: "d1",
    daysBefore: 1,
    title: "24 hours before: final check",
    items: [
      "Packing and tools verified",
      "Design checked against the approved image",
      "Venue details confirmed",
      "Team confirmed",
      "Payment arrangements confirmed",
    ],
  },
];

function waNumber(raw: string | null | undefined) {
  if (!raw) return "";
  let n = raw.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = COUNTRY_CODE + n.slice(1);
  else if (n.length === 9) n = COUNTRY_CODE + n;
  return n;
}

const waLink = (number: string, text: string) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

const calStamp = (s: string) =>
  new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const longDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const timeOf = (s: string) =>
  new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function minusDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}

type ResRow = {
  quantity: number;
  inventory_items: { item_code: string; name: string } | null;
};

export default function EventReminders({ event }: { event: ReminderEvent }) {
  const profile = useProfile();
  const isOwner = profile?.role === "owner";

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<string[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: e } = await supabase
      .from("events")
      .select("checkpoints")
      .eq("id", event.id)
      .single();
    setChecks((e?.checkpoints ?? {}) as Record<string, boolean>);

    const { data: r } = await supabase
      .from("reservations")
      .select("quantity, inventory_items(item_code, name)")
      .eq("event_id", event.id);
    const rows = (r ?? []) as unknown as ResRow[];
    setItems(
      rows.map((x) => `${x.quantity} x ${x.inventory_items?.item_code} ${x.inventory_items?.name}`)
    );

    if (isOwner) {
      const { data: f } = await supabase
        .from("event_financials")
        .select("balance_due")
        .eq("event_id", event.id)
        .single();
      setBalance(f ? Number(f.balance_due) : null);
    }
  }, [event.id, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(key: string) {
    const next = { ...checks, [key]: !checks[key] };
    const { error } = await supabase
      .from("events")
      .update({ checkpoints: next })
      .eq("id", event.id);
    if (error) setError(error.message);
    else {
      setError("");
      setChecks(next);
    }
  }

  const today = new Date().toLocaleDateString("en-CA");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const name = event.customers?.name ?? "there";
  const venue = event.venue_name || event.venue_address || "";
  const number = waNumber(event.customers?.whatsapp || event.customers?.phone);

  // --- Customer messages ---
  const messages: { label: string; text: string }[] = [
    {
      label: "Booking confirmation",
      text: `Hi ${name}, thank you for choosing ${BUSINESS}! Your booking ${event.event_code} for your ${event.event_type} on ${longDate(event.event_date)} is confirmed. We will keep you updated as the day gets closer. If anything changes, please let us know here.`,
    },
    {
      label: "Day-before reminder",
      text: `Hi ${name}, a reminder from ${BUSINESS} that we will be setting up for your ${event.event_type} tomorrow (${longDate(event.event_date)}).${venue ? ` Venue: ${venue}.` : ""} Please make sure the venue is accessible for our team and that the contact person is available. Thank you!`,
    },
  ];
  if (isOwner && balance !== null && balance > 0) {
    messages.push({
      label: "Balance reminder",
      text: `Hi ${name}, a friendly reminder from ${BUSINESS} that the balance of ${CURRENCY} ${balance.toLocaleString()} for booking ${event.event_code} is due. Please let us know once it has been paid. Thank you!`,
    });
  }
  messages.push({
    label: "Thank you and feedback",
    text: `Hi ${name}, thank you for letting ${BUSINESS} be part of your ${event.event_type}! We hope everything was perfect. We would love to hear your feedback, and a photo or review means a lot to us.`,
  });

  // --- Team brief (paste into the team WhatsApp group) ---
  const brief = [
    `${event.event_code} | ${name} | ${event.event_type}`,
    `Date: ${longDate(event.event_date)}`,
    `Team leaves: ${timeOf(event.block_start)} | Finish and return by: ${timeOf(event.block_end)}`,
    venue && `Venue: ${venue}`,
    event.venue_address && event.venue_name && `Address: ${event.venue_address}`,
    event.venue_map_link && `Map: ${event.venue_map_link}`,
    event.venue_contact && `Venue contact: ${event.venue_contact}`,
    event.vehicle && `Vehicle: ${event.vehicle}`,
    event.colours && `Colours: ${event.colours}`,
    event.backdrop_type && `Backdrop: ${event.backdrop_type}`,
    event.design_summary && `Design: ${event.design_summary}`,
    event.special_instructions && `Instructions: ${event.special_instructions}`,
    items.length > 0 && `Items:\n${items.map((i) => `- ${i}`).join("\n")}`,
    origin && `Full details: ${origin}/events/${event.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy. Select the text and copy it manually.");
    }
  }

  // --- Google Calendar link ---
  const calDetails = [
    `Event ID: ${event.event_code}`,
    `Customer: ${name}${event.customers?.phone ? ` (${event.customers.phone})` : ""}`,
    venue && `Venue: ${venue}`,
    event.venue_contact && `Venue contact: ${event.venue_contact}`,
    `Customer's event date: ${longDate(event.event_date)}`,
    event.design_summary && `Design: ${event.design_summary}`,
    event.vehicle && `Vehicle: ${event.vehicle}`,
    event.special_instructions && `Instructions: ${event.special_instructions}`,
    origin && `Full details: ${origin}/events/${event.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const calendarUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(`${event.event_code} | ${name} | ${event.event_type}`)}` +
    `&dates=${calStamp(event.block_start)}/${calStamp(event.block_end)}` +
    `&details=${encodeURIComponent(calDetails)}` +
    `&location=${encodeURIComponent(event.venue_address || event.venue_name || "")}`;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Reminders and messages</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        <h3 className="font-medium">Preparation checkpoints</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {CHECKPOINTS.map((c) => {
            const due = minusDays(event.event_date, c.daysBefore);
            const done = !!checks[c.key];
            const state = done
              ? "done"
              : due < today
                ? "overdue"
                : due === today
                  ? "due today"
                  : "upcoming";
            const color =
              state === "done"
                ? "text-green-600"
                : state === "overdue"
                  ? "text-red-600"
                  : state === "due today"
                    ? "text-orange-600"
                    : "text-gray-500";
            return (
              <div key={c.key} className="rounded border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{c.title}</p>
                  <input type="checkbox" checked={done} onChange={() => toggle(c.key)} />
                </div>
                <p className={`text-sm ${color}`}>
                  {due} ({state})
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                  {c.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Calendar</h3>
        <a
          href={calendarUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded bg-black px-4 py-2 text-white"
        >
          Add to Google Calendar
        </a>
        <p className="text-sm text-gray-500">
          Opens Google Calendar with the title, time block, venue and details filled in. Pick your
          EVENTS BY CE BOOKINGS calendar, add team members as guests, and save.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">WhatsApp to customer</h3>
        {number ? (
          <div className="flex flex-wrap gap-2">
            {messages.map((m) => (
              <a
                key={m.label}
                href={waLink(number, m.text)}
                target="_blank"
                rel="noreferrer"
                className="rounded border px-3 py-2 text-sm"
              >
                {m.label}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No phone number on this customer, so WhatsApp links are unavailable.
          </p>
        )}
        <p className="text-sm text-gray-500">
          Opens WhatsApp with the message written for you. Read it, edit it if you like, and press
          send yourself.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Team brief</h3>
        <textarea
          readOnly
          rows={Math.min(14, brief.split("\n").length + 1)}
          className="w-full rounded border p-2 text-sm"
          value={brief}
        />
        <button onClick={copyBrief} className="rounded bg-black px-4 py-2 text-white">
          {copied ? "Copied" : "Copy team brief"}
        </button>
        <p className="text-sm text-gray-500">
          Paste into your team WhatsApp group. Save the job details and reserve inventory first so
          the brief is complete.
        </p>
      </div>
    </section>
  );
}