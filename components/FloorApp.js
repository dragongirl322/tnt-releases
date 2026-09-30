"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DISTRIBUTORS,
  FORMATS,
  READY_STATUSES,
  STAGES,
  stageByStatus,
  statusIndex,
} from "../lib/constants.js";

const EMPTY_FORM = {
  title: "",
  artist: "",
  distributor: "Alliance",
  format: "LP",
  streetDate: "",
  eta: "",
  qtyOrdered: 1,
  status: "Watch",
  notes: "",
};

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ago(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Date.now() - then) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function sortReleases(list) {
  return [...list].sort((a, b) => {
    const byStage = statusIndex(a.status) - statusIndex(b.status);
    if (byStage) return byStage;
    const byDate = (a.streetDate || "9999-99-99").localeCompare(b.streetDate || "9999-99-99");
    if (byDate) return byDate;
    return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
  });
}

async function errorMessage(response) {
  try {
    const data = await response.json();
    return data.error || "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function matchesQuery(release, query) {
  if (!query) return true;
  const haystack = `${release.title} ${release.artist} ${release.format} ${release.notes}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export default function FloorApp() {
  const [booting, setBooting] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [releases, setReleases] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [distributor, setDistributor] = useState("all");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function load({ silent = false } = {}) {
    const response = await fetch("/api/releases");
    if (response.status === 401) {
      setUnlocked(false);
      return;
    }
    if (!response.ok) {
      if (!silent) setLoadError(await errorMessage(response));
      return;
    }
    const data = await response.json();
    setReleases(sortReleases(data.releases || []));
    setLoadError("");
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const response = await fetch("/api/session");
        const session = await response.json();
        if (cancel) return;
        setPinRequired(Boolean(session.pinRequired));
        setUnlocked(Boolean(session.unlocked));
        if (session.unlocked) await load();
      } catch {
        if (!cancel) setLoadError("Could not reach the floor board.");
      } finally {
        if (!cancel) setBooting(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return undefined;
    const timer = window.setInterval(() => {
      if (!form) load({ silent: true });
    }, 20000);
    const onFocus = () => {
      if (!form) load({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [unlocked, form]);

  useEffect(() => {
    if (!sheet && !form) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") {
        setSheet(null);
        if (!saving) setForm(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet, form, saving]);

  const counts = useMemo(() => {
    const base = releases.filter((release) => matchesQuery(release, query));
    const forStatus = base.filter((release) => distributor === "all" || release.distributor === distributor);
    const forDistributor = base.filter((release) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "ready") return READY_STATUSES.includes(release.status);
      return release.status === statusFilter;
    });
    return {
      all: forStatus.length,
      ready: forStatus.filter((release) => READY_STATUSES.includes(release.status)).length,
      statuses: Object.fromEntries(STAGES.map((stage) => [
        stage.label,
        forStatus.filter((release) => release.status === stage.label).length,
      ])),
      distributors: Object.fromEntries(DISTRIBUTORS.map((name) => [
        name,
        forDistributor.filter((release) => release.distributor === name).length,
      ])),
    };
  }, [releases, query, distributor, statusFilter]);

  const visible = useMemo(() => {
    return releases.filter((release) => {
      if (!matchesQuery(release, query)) return false;
      if (distributor !== "all" && release.distributor !== distributor) return false;
      if (statusFilter === "ready") return READY_STATUSES.includes(release.status);
      if (statusFilter !== "all") return release.status === statusFilter;
      return true;
    });
  }, [releases, query, distributor, statusFilter]);

  async function unlock(event) {
    event.preventDefault();
    setPinBusy(true);
    setPinError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        setPinError(await errorMessage(response));
        return;
      }
      setUnlocked(true);
      setPin("");
      await load();
    } catch {
      setPinError("Could not check the PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  async function lockBoard() {
    await fetch("/api/auth", { method: "DELETE" });
    setUnlocked(false);
    setReleases([]);
    setSheet(null);
    setForm(null);
  }

  async function moveTo(release, status) {
    if (release.status === status) {
      setSheet(null);
      return;
    }
    const previous = releases;
    setReleases(sortReleases(releases.map((item) => (
      item.id === release.id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    ))));
    setSheet(null);
    const response = await fetch(`/api/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.status === 401) {
      setUnlocked(false);
      return;
    }
    if (!response.ok) {
      setReleases(previous);
      notify(await errorMessage(response));
      return;
    }
    const data = await response.json();
    setReleases((list) => sortReleases(list.map((item) => (
      item.id === data.release.id ? data.release : item
    ))));
  }

  function openCreate() {
    setFormError("");
    setConfirmDelete(false);
    setForm({ mode: "create", ...EMPTY_FORM });
  }

  function openEdit(release) {
    setFormError("");
    setConfirmDelete(false);
    setSheet(null);
    setForm({ mode: "edit", ...release });
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveForm(event) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError("");
    const payload = {
      title: form.title,
      artist: form.artist,
      distributor: form.distributor,
      format: form.format,
      streetDate: form.streetDate,
      eta: form.eta,
      qtyOrdered: Number(form.qtyOrdered),
      status: form.status,
      notes: form.notes,
    };
    const response = await fetch(form.mode === "create" ? "/api/releases" : `/api/releases/${form.id}`, {
      method: form.mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (response.status === 401) {
      setUnlocked(false);
      return;
    }
    if (!response.ok) {
      setFormError(await errorMessage(response));
      return;
    }
    const data = await response.json();
    setReleases((list) => {
      const without = list.filter((item) => item.id !== data.release.id);
      return sortReleases([...without, data.release]);
    });
    setForm(null);
    notify(form.mode === "create" ? "Release added." : "Release saved.");
  }

  async function removeRelease() {
    if (!form?.id) return;
    setSaving(true);
    const response = await fetch(`/api/releases/${form.id}`, { method: "DELETE" });
    setSaving(false);
    if (response.status === 401) {
      setUnlocked(false);
      return;
    }
    if (!response.ok && response.status !== 204) {
      setFormError(await errorMessage(response));
      return;
    }
    setReleases((list) => list.filter((item) => item.id !== form.id));
    setForm(null);
    notify("Release removed.");
  }

  if (booting) return <div className="boot">Opening the floor board…</div>;

  if (!unlocked) {
    return (
      <main className="pin">
        <form onSubmit={unlock}>
          <div className="mark" aria-hidden="true" />
          <h1><span>TNT</span> RELEASES</h1>
          <p>TNT Music Edmonds. Enter the store PIN to open the floor board.</p>
          {pinError ? <p className="banner">{pinError}</p> : null}
          <label>
            Store PIN
            <input
              type="password"
              inputMode="text"
              autoComplete="current-password"
              autoFocus
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={pinBusy || !pin.trim()}>
            {pinBusy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  const summary = statusFilter === "ready"
    ? `${visible.length} ready to advertise`
    : `${visible.length} on the board`;

  return (
    <main className="app">
      <header className="top">
        <div className="mark" aria-hidden="true" />
        <div className="brand">
          <h1><span>TNT</span> RELEASES</h1>
          <p>TNT Music Edmonds</p>
        </div>
        {pinRequired ? (
          <button className="icon-btn" type="button" onClick={lockBoard} aria-label="Lock board">
            ⌁
          </button>
        ) : null}
        <button className="icon-btn primary" type="button" onClick={openCreate} aria-label="Add release">
          +
        </button>
      </header>

      <input
        className="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title or artist"
        aria-label="Search title or artist"
      />

      <div className="filters">
        <div className="scroller" role="toolbar" aria-label="Filter by status">
          <button type="button" className={statusFilter === "all" ? "chip on" : "chip"} onClick={() => setStatusFilter("all")}>
            All {counts.all}
          </button>
          <button
            type="button"
            className={statusFilter === "ready" ? "chip ready on" : "chip ready"}
            onClick={() => setStatusFilter("ready")}
          >
            Ready to advertise {counts.ready}
          </button>
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={statusFilter === stage.label ? "chip on" : "chip"}
              onClick={() => setStatusFilter(stage.label)}
            >
              {stage.label} {counts.statuses[stage.label]}
            </button>
          ))}
        </div>
        <div className="scroller" role="toolbar" aria-label="Filter by distributor">
          <button type="button" className={distributor === "all" ? "chip on" : "chip"} onClick={() => setDistributor("all")}>
            All distributors
          </button>
          {DISTRIBUTORS.map((name) => (
            <button
              key={name}
              type="button"
              className={distributor === name ? "chip on" : "chip"}
              onClick={() => setDistributor(name)}
            >
              {name} {counts.distributors[name]}
            </button>
          ))}
        </div>
      </div>

      <p className="summary">{summary}</p>
      {loadError ? <p className="banner">{loadError}</p> : null}

      <section className="grid" aria-label="Releases">
        {visible.length === 0 ? (
          <div className="empty">
            <h2>Nothing in this lane</h2>
            <p>Clear the filters or add a release the floor is tracking.</p>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setDistributor("all");
                setQuery("");
              }}
            >
              Show everything
            </button>
          </div>
        ) : visible.map((release) => {
          const stage = stageByStatus(release.status);
          const stageNumber = statusIndex(release.status);
          return (
            <article
              key={release.id}
              className="card"
              data-stage={stage.id}
              role="button"
              tabIndex={0}
              onClick={() => setSheet(release)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSheet(release);
                }
              }}
            >
              <div className="spine" aria-hidden="true" />
              <div>
                <h2>{release.title}</h2>
                <p className="artist">{release.artist}</p>
                <div className="meta">
                  <span className="pill quiet">{release.format}</span>
                  <span className={`pill dist-${release.distributor === "Sub Pop" ? "subpop" : release.distributor.toLowerCase()}`}>
                    {release.distributor}
                  </span>
                  <span className="pill quiet">Qty {release.qtyOrdered}</span>
                </div>
                <div className="dates">
                  {release.streetDate ? <span className="pill quiet">Street {formatDate(release.streetDate)}</span> : null}
                  {release.eta ? <span className="pill quiet">ETA {formatDate(release.eta)}</span> : null}
                </div>
                {release.notes ? <p className="notes">{release.notes}</p> : null}
                <div className="pipes" aria-hidden="true">
                  {STAGES.map((item, index) => (
                    <span key={item.id} className={index <= stageNumber ? "on" : ""} />
                  ))}
                </div>
                <p className="when">Updated {ago(release.updatedAt)}</p>
              </div>
              <div className="side">
                <span className="status">{release.status}</span>
                <button
                  type="button"
                  className="edit"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(release);
                  }}
                >
                  Edit
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {sheet ? (
        <div className="overlay" onClick={() => setSheet(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grab" />
            <h2 id="stage-title">Move stage</h2>
            <p className="sub">{sheet.artist} — {sheet.title}</p>
            <div className="stage-list">
              {STAGES.map((stage, index) => {
                const current = sheet.status === stage.label;
                const next = index === statusIndex(sheet.status) + 1;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    className={`stage${current ? " current" : ""}${next ? " next" : ""}`}
                    onClick={() => moveTo(sheet, stage.label)}
                  >
                    <span>
                      <strong>{stage.label}</strong>
                      <small>{current ? "Current stage" : next ? "Next stage" : stage.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="sheet-links">
              <button className="btn secondary" type="button" onClick={() => setSheet(null)}>Close</button>
              <button className="btn" type="button" onClick={() => openEdit(sheet)}>Edit details</button>
            </div>
          </div>
        </div>
      ) : null}

      {form ? (
        <form className="form-sheet" onSubmit={saveForm}>
          <div className="form-head">
            <div>
              <h2>{form.mode === "create" ? "Add release" : "Edit release"}</h2>
              <p>{form.mode === "create" ? "Track it from watch through advertise." : form.artist}</p>
            </div>
            <button className="icon-btn" type="button" onClick={() => setForm(null)} aria-label="Close form">
              ×
            </button>
          </div>
          <div className="form-body">
            {formError ? <p className="banner">{formError}</p> : null}
            <label>
              Title
              <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required maxLength={160} />
            </label>
            <label>
              Artist
              <input value={form.artist} onChange={(event) => updateField("artist", event.target.value)} required maxLength={160} />
            </label>
            <label>
              Distributor
              <div className="seg" role="radiogroup" aria-label="Distributor">
                {DISTRIBUTORS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={form.distributor === name}
                    className={form.distributor === name ? "on" : ""}
                    onClick={() => updateField("distributor", name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Format
              <input
                list="formats"
                value={form.format}
                onChange={(event) => updateField("format", event.target.value)}
                required
                maxLength={40}
              />
              <datalist id="formats">
                {FORMATS.map((format) => <option key={format} value={format} />)}
              </datalist>
            </label>
            <label>
              Street date
              <input type="date" value={form.streetDate || ""} onChange={(event) => updateField("streetDate", event.target.value)} />
            </label>
            <label>
              ETA
              <input type="date" value={form.eta || ""} onChange={(event) => updateField("eta", event.target.value)} />
            </label>
            <label>
              Qty ordered
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={form.qtyOrdered}
                onChange={(event) => updateField("qtyOrdered", event.target.value)}
                required
              />
            </label>
            <label>
              Status
              <div className="stage-list" role="radiogroup" aria-label="Status">
                {STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    role="radio"
                    aria-checked={form.status === stage.label}
                    className={`stage${form.status === stage.label ? " current" : ""}`}
                    onClick={() => updateField("status", stage.label)}
                  >
                    <span>
                      <strong>{stage.label}</strong>
                      <small>{stage.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </label>
            <label>
              Notes
              <textarea value={form.notes || ""} maxLength={2000} onChange={(event) => updateField("notes", event.target.value)} />
            </label>
            {form.mode === "edit" ? (
              <div className="stamps">
                <span>Added {formatStamp(form.createdAt)}</span>
                <span>Updated {formatStamp(form.updatedAt)}</span>
              </div>
            ) : null}
            {form.mode === "edit" ? (
              confirmDelete ? (
                <div className="sheet-links">
                  <button className="btn secondary" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>
                  <button className="btn danger" type="button" onClick={removeRelease} disabled={saving}>Delete</button>
                </div>
              ) : (
                <button className="btn danger" type="button" onClick={() => setConfirmDelete(true)}>Delete release</button>
              )
            ) : null}
          </div>
          <div className="form-bar">
            <button className="btn secondary" type="button" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
