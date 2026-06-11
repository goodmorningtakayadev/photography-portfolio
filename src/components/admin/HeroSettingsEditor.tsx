"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings } from "@/lib/admin-api";

type PickPhoto = {
  id: string;
  caption: string | null;
  thumbUrl: string | null;
  fullUrl: string;
};

type Initial = {
  heroPhotoId: string | null;
  heroFocalX: number;
  heroFocalY: number;
};

export function HeroSettingsEditor({
  initial,
  photos,
}: {
  initial: Initial;
  photos: PickPhoto[];
}) {
  const router = useRouter();
  const [heroPhotoId, setHeroPhotoId] = useState<string | null>(
    initial.heroPhotoId,
  );
  const [focalX, setFocalX] = useState(initial.heroFocalX);
  const [focalY, setFocalY] = useState(initial.heroFocalY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const selected = photos.find((p) => p.id === heroPhotoId) ?? null;
  // Fall back to the first ready photo so the preview shows the same image the
  // public homepage would (it defaults to the first photo when none is set).
  const previewUrl = selected?.fullUrl ?? photos[0]?.fullUrl ?? null;

  const dirty =
    heroPhotoId !== initial.heroPhotoId ||
    focalX !== initial.heroFocalX ||
    focalY !== initial.heroFocalY;

  const setFromPointer = (clientX: number, clientY: number) => {
    const el = previewRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100)));
    setFocalX(x);
    setFocalY(y);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const result = await updateSiteSettings({
        heroPhotoId,
        heroFocalX: focalX,
        heroFocalY: focalY,
      });
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        return;
      }
      setMsg({ ok: true, text: "Saved — homepage hero updated." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    fontFamily: "var(--f-mono)",
    fontSize: "0.6rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--white-ghost)",
  };

  return (
    <div style={{ maxWidth: 1100, padding: "clamp(1.5rem, 3vw, 2.5rem)" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span style={labelStyle}>Settings</span>
        <h1
          style={{
            fontFamily: "var(--f-display)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            color: "var(--white)",
            margin: "0.4rem 0 0",
          }}
        >
          Homepage hero
        </h1>
        <p style={{ color: "var(--white-dim)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Choose the hero photo and drag the focal point to set its crop.
        </p>
      </header>

      {/* ── Live preview ── */}
      <span style={labelStyle}>Preview &amp; focal point</span>
      <div
        ref={previewRef}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={() => (dragging.current = false)}
        style={{
          position: "relative",
          aspectRatio: "16 / 7",
          marginTop: "0.6rem",
          background: "var(--black-surface)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          cursor: "crosshair",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${focalX}% ${focalY}%`,
              pointerEvents: "none",
            }}
          />
        ) : (
          <div style={{ ...labelStyle, padding: "2rem" }}>No ready photos available.</div>
        )}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${focalX}%`,
            top: `${focalY}%`,
            transform: "translate(-50%, -50%)",
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.55), 0 0 12px rgba(126, 20, 32,0.4)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Focal sliders (fallback / fine control) ── */}
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
        {([
          ["Horizontal", focalX, setFocalX],
          ["Vertical", focalY, setFocalY],
        ] as const).map(([label, val, set]) => (
          <label key={label} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: "1 1 220px" }}>
            <span style={labelStyle}>{label} — {val}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              style={{ accentColor: "var(--accent)" }}
            />
          </label>
        ))}
      </div>

      {/* ── Photo picker ── */}
      <div style={{ marginTop: "2rem" }}>
        <span style={labelStyle}>Hero photo ({photos.length} ready)</span>
        <div
          style={{
            marginTop: "0.6rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {photos.map((p) => {
            const isSel = p.id === heroPhotoId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setHeroPhotoId(p.id)}
                title={p.caption ?? undefined}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  overflow: "hidden",
                  border: isSel ? "2px solid var(--accent)" : "1px solid var(--border)",
                  padding: 0,
                  cursor: "pointer",
                  background: "var(--black-surface)",
                }}
              >
                {(p.thumbUrl ?? p.fullUrl) && (
                  <img
                    src={p.thumbUrl ?? p.fullUrl}
                    alt={p.caption ?? ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Save ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            padding: "0.85rem 2rem",
            background: dirty && !saving ? "var(--accent)" : "var(--black-elevated)",
            color: dirty && !saving ? "var(--on-accent)" : "var(--white-ghost)",
            border: "1px solid var(--border-strong)",
            cursor: dirty && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && (
          <span
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: "0.7rem",
              color: msg.ok ? "var(--accent)" : "#ff6b6b",
            }}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
