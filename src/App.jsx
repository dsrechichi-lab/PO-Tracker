import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const hdrs = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: "return=representation",
};
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: hdrs,
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLOR_PALETTE = [
  "#2E75B6", "#059669", "#EA580C", "#7C3AED",
  "#DC2626", "#0891B2", "#D97706", "#16A34A",
  "#9333EA", "#DB2777", "#0284C7", "#65A30D",
];

function getMachineColor(machines, name) {
  return machines.find((m) => m.name === name)?.color || "#64748B";
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}
function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
}

function Toast({ toasts }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === "success" ? "#059669" : "#DC2626",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            fontSize: 14,
            fontWeight: 500,
            minWidth: 240,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function Modal({ po, onConfirm, onCancel, saving }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          maxWidth: 400,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
        <h3 style={{ margin: "0 0 8px", color: "#1E293B", fontSize: 20 }}>
          Delete PO?
        </h3>
        <p style={{ color: "#64748B", margin: "0 0 24px" }}>
          Delete <strong>{po?.po}</strong>? This will also remove all{" "}
          {po?.items?.length || 0} line items. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: "#DC2626",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 500,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, term }) {
  if (!term || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{ background: "#FDE68A", borderRadius: 2, padding: "0 2px" }}
      >
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function MachineForm({ editMachine, onSave, onCancel, saving }) {
  const [name, setName] = useState(editMachine?.name || "");
  const [color, setColor] = useState(editMachine?.color || COLOR_PALETTE[0]);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Machine name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({ name: name.trim(), color });
  }

  const inp = {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    marginBottom: 4,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const err = { color: "#DC2626", fontSize: 12, marginTop: 3 };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
      }}
    >
      <h3 style={{ margin: "0 0 20px", color: "#1E293B", fontSize: 18 }}>
        {editMachine ? "Edit Machine" : "New Machine"}
      </h3>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Machine Name *</label>
        <input
          style={inp}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Machine E"
        />
        {errors.name && <div style={err}>{errors.name}</div>}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Color</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: c,
                border: color === c ? "3px solid #1E293B" : "3px solid transparent",
                cursor: "pointer",
                padding: 0,
                outline: "none",
                boxShadow: color === c ? "0 0 0 2px #fff inset" : "none",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Preview</label>
        <span
          style={{
            background: color + "20",
            color,
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {name || "Machine Name"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            padding: "11px 28px",
            borderRadius: 10,
            border: "none",
            background: "#2E75B6",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : editMachine ? "Save Changes" : "Add Machine"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "11px 24px",
            borderRadius: 10,
            border: "1px solid #E2E8F0",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TabMachines({ machines, pos, onSave, onDelete, saving }) {
  const [showForm, setShowForm] = useState(false);
  const [editMachine, setEditMachine] = useState(null);
  const [deleteMachine, setDeleteMachine] = useState(null);
  const [delSaving, setDelSaving] = useState(false);

  const poCountByMachine = useMemo(() => {
    const counts = {};
    pos.forEach((p) => {
      counts[p.machine] = (counts[p.machine] || 0) + 1;
    });
    return counts;
  }, [pos]);

  async function handleDelete() {
    setDelSaving(true);
    await onDelete(deleteMachine.id);
    setDelSaving(false);
    setDeleteMachine(null);
  }

  function startEdit(machine) {
    setEditMachine(machine);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      {deleteMachine && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", color: "#1E293B", fontSize: 20 }}>
              Delete Machine?
            </h3>
            <p style={{ color: "#64748B", margin: "0 0 8px" }}>
              Delete <strong>{deleteMachine.name}</strong>? This cannot be undone.
            </p>
            {(poCountByMachine[deleteMachine.name] || 0) > 0 && (
              <p
                style={{
                  background: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#92400E",
                  fontSize: 13,
                  margin: "0 0 16px",
                }}
              >
                ⚠️ {poCountByMachine[deleteMachine.name]} PO
                {poCountByMachine[deleteMachine.name] !== 1 ? "s" : ""} reference
                this machine and will lose their machine color.
              </p>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
              <button
                onClick={() => setDeleteMachine(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={delSaving}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  cursor: delSaving ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  opacity: delSaving ? 0.7 : 1,
                }}
              >
                {delSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => {
            setShowForm((s) => !s);
            setEditMachine(null);
          }}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            background: "#2E75B6",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {showForm && !editMachine ? "✕ Cancel" : "➕ New Machine"}
        </button>
        <span style={{ color: "#64748B", fontSize: 13, marginLeft: "auto" }}>
          {machines.length} machine{machines.length !== 1 ? "s" : ""}
        </span>
      </div>
      {showForm && (
        <MachineForm
          editMachine={editMachine}
          saving={saving}
          onSave={async (data) => {
            await onSave(data, editMachine);
            setShowForm(false);
            setEditMachine(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditMachine(null);
          }}
        />
      )}
      {machines.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
          <div style={{ fontSize: 16 }}>No machines yet. Add your first machine above.</div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {machines.map((m) => {
            const count = poCountByMachine[m.name] || 0;
            return (
              <div
                key={m.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "20px 24px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: m.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontWeight: 700, color: "#1E293B", fontSize: 16, flex: 1 }}
                  >
                    {m.name}
                  </span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <span
                    style={{
                      background: m.color + "20",
                      color: m.color,
                      padding: "3px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {m.name}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
                  {count} PO{count !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => startEdit(m)}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#2E75B6",
                      fontWeight: 500,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteMachine(m)}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "#FEE2E2",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#DC2626",
                      fontWeight: 500,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SupplierForm({ editSupplier, onSave, onCancel, saving }) {
  const [name, setName] = useState(editSupplier?.name || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Supplier name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({ name: name.trim() });
  }

  const inp = {
    padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
    fontSize: 14, color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4,
    display: "block", textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const err = { color: "#DC2626", fontSize: 12, marginTop: 3 };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #E2E8F0" }}>
      <h3 style={{ margin: "0 0 20px", color: "#1E293B", fontSize: 18 }}>
        {editSupplier ? "Edit Supplier" : "New Supplier"}
      </h3>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Supplier Name *</label>
        <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Industrial" autoFocus />
        {errors.name && <div style={err}>{errors.name}</div>}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={submit} disabled={saving} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "#2E75B6", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : editSupplier ? "Save Changes" : "Add Supplier"}
        </button>
        <button onClick={onCancel} style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TabSuppliers({ suppliers, pos, onSave, onDelete, saving }) {
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [deleteSupplier, setDeleteSupplier] = useState(null);
  const [delSaving, setDelSaving] = useState(false);

  const poCountBySupplier = useMemo(() => {
    const counts = {};
    pos.forEach((p) => { if (p.supplier) counts[p.supplier] = (counts[p.supplier] || 0) + 1; });
    return counts;
  }, [pos]);

  async function handleDelete() {
    setDelSaving(true);
    await onDelete(deleteSupplier.id);
    setDelSaving(false);
    setDeleteSupplier(null);
  }

  function startEdit(s) {
    setEditSupplier(s);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      {deleteSupplier && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", color: "#1E293B", fontSize: 20 }}>Delete Supplier?</h3>
            <p style={{ color: "#64748B", margin: "0 0 8px" }}>
              Delete <strong>{deleteSupplier.name}</strong>? This cannot be undone.
            </p>
            {(poCountBySupplier[deleteSupplier.name] || 0) > 0 && (
              <p style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", color: "#92400E", fontSize: 13, margin: "0 0 16px" }}>
                ⚠️ {poCountBySupplier[deleteSupplier.name]} PO{poCountBySupplier[deleteSupplier.name] !== 1 ? "s" : ""} reference this supplier.
              </p>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
              <button onClick={() => setDeleteSupplier(null)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
              <button onClick={handleDelete} disabled={delSaving} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", cursor: delSaving ? "not-allowed" : "pointer", fontWeight: 500, opacity: delSaving ? 0.7 : 1 }}>
                {delSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <button
          onClick={() => { setShowForm((s) => !s); setEditSupplier(null); }}
          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#2E75B6", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          {showForm && !editSupplier ? "✕ Cancel" : "➕ New Supplier"}
        </button>
        <span style={{ color: "#64748B", fontSize: 13, marginLeft: "auto" }}>
          {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
        </span>
      </div>
      {showForm && (
        <SupplierForm
          editSupplier={editSupplier}
          saving={saving}
          onSave={async (data) => { await onSave(data, editSupplier); setShowForm(false); setEditSupplier(null); }}
          onCancel={() => { setShowForm(false); setEditSupplier(null); }}
        />
      )}
      {suppliers.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 16 }}>No suppliers yet. Add your first supplier above.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {suppliers.map((s) => {
            const count = poCountBySupplier[s.name] || 0;
            return (
              <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🏭</span>
                  <span style={{ fontWeight: 700, color: "#1E293B", fontSize: 16, flex: 1 }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
                  {count} PO{count !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(s)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", fontSize: 13, color: "#2E75B6", fontWeight: 500 }}>Edit</button>
                  <button onClick={() => setDeleteSupplier(s)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "#FEE2E2", cursor: "pointer", fontSize: 13, color: "#DC2626", fontWeight: 500 }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function POForm({ editPO, onSave, onCancel, saving, machines, suppliers }) {
  const [po, setPo] = useState(editPO?.po || "");
  const [date, setDate] = useState(editPO?.date || "");
  const [desc, setDesc] = useState(editPO?.description || "");
  const [machine, setMachine] = useState(editPO?.machine || "");
  const [supplier, setSupplier] = useState(editPO?.supplier || "");
  const [items, setItems] = useState(
    editPO?.items?.length
      ? editPO.items.map((i) => ({
          part_no: i.part_no || "",
          name: i.name,
          qty: String(i.qty),
          unit_cost: String(i.unit_cost),
        }))
      : [{ part_no: "", name: "", qty: "", unit_cost: "" }],
  );
  const [errors, setErrors] = useState({});

  const total = useMemo(
    () =>
      items.reduce(
        (s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unit_cost) || 0),
        0,
      ),
    [items],
  );

  function validate() {
    const e = {};
    if (!po.trim()) e.po = "PO number is required";
    if (!date) e.date = "Date is required";
    if (!desc.trim()) e.desc = "Description is required";
    if (!machine) e.machine = "Select a machine";
    items.forEach((item, i) => {
      if (!item.name.trim()) e[`item_name_${i}`] = "Name required";
      if (!(parseFloat(item.qty) > 0)) e[`item_qty_${i}`] = "Qty > 0";
      if (!(parseFloat(item.unit_cost) > 0)) e[`item_cost_${i}`] = "Cost > 0";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({
      po,
      date,
      machine,
      supplier,
      description: desc,
      total,
      items: items.map((i) => ({
        part_no: i.part_no,
        name: i.name,
        qty: parseFloat(i.qty),
        unit_cost: parseFloat(i.unit_cost),
      })),
    });
  }

  function updateItem(i, field, val) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)),
    );
  }
  function removeItem(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      { part_no: "", name: "", qty: "", unit_cost: "" },
    ]);
  }

  const inp = {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    marginBottom: 4,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const err = { color: "#DC2626", fontSize: 12, marginTop: 3 };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
      }}
    >
      <h3 style={{ margin: "0 0 20px", color: "#1E293B", fontSize: 18 }}>
        {editPO ? "Edit PO" : "New Purchase Order"}
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={lbl}>PO Number *</label>
          <input
            style={inp}
            value={po}
            onChange={(e) => setPo(e.target.value)}
            placeholder="e.g. PO-2026-001"
          />
          {errors.po && <div style={err}>{errors.po}</div>}
        </div>
        <div>
          <label style={lbl}>Date *</label>
          <input
            type="date"
            style={inp}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {errors.date && <div style={err}>{errors.date}</div>}
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>PO Description *</label>
          <input
            style={inp}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Bearing replacement batch"
          />
          {errors.desc && <div style={err}>{errors.desc}</div>}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Machine *</label>
        {machines.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13 }}>
            No machines configured. Add machines in the Machines tab first.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {machines.map((m) => (
              <button
                key={m.id}
                onClick={() => setMachine(m.name)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 20,
                  border: `2px solid ${m.color}`,
                  background: machine === m.name ? m.color : "#fff",
                  color: machine === m.name ? "#fff" : m.color,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
        {errors.machine && <div style={err}>{errors.machine}</div>}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Supplier</label>
        {suppliers.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13 }}>
            No suppliers configured. Add suppliers in the Suppliers tab.
          </div>
        ) : (
          <select
            style={inp}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">— No supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Line Items</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, i) => {
            const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_cost) || 0);
            return (
              <div
                key={i}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 14,
                  background: "#FAFBFC",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Item {i + 1}
                  </span>
                  <button
                    onClick={() => removeItem(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1, padding: "0 4px" }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Item Description *</label>
                  <input
                    style={inp}
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    placeholder="e.g. Bearing, Belt, Filter…"
                  />
                  {errors[`item_name_${i}`] && <div style={err}>{errors[`item_name_${i}`]}</div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Part No.</label>
                    <input
                      style={{ ...inp, fontFamily: "monospace" }}
                      value={item.part_no}
                      onChange={(e) => updateItem(i, "part_no", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Qty *</label>
                    <input
                      type="number"
                      style={inp}
                      value={item.qty}
                      onChange={(e) => updateItem(i, "qty", e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                    {errors[`item_qty_${i}`] && <div style={err}>{errors[`item_qty_${i}`]}</div>}
                  </div>
                  <div>
                    <label style={lbl}>Unit Cost *</label>
                    <input
                      type="number"
                      style={inp}
                      value={item.unit_cost}
                      onChange={(e) => updateItem(i, "unit_cost", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    {errors[`item_cost_${i}`] && <div style={err}>{errors[`item_cost_${i}`]}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#1E293B", fontSize: 14 }}>
                  {fmt(lineTotal)}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <button
            onClick={addItem}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px dashed #CBD5E1",
              background: "#F8FAFC",
              cursor: "pointer",
              color: "#64748B",
              fontSize: 13,
            }}
          >
            + Add Item
          </button>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#1E293B" }}>
            PO Total: {fmt(total)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            padding: "11px 28px",
            borderRadius: 10,
            border: "none",
            background: "#2E75B6",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : editPO ? "Save Changes" : "Add PO"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "11px 24px",
            borderRadius: 10,
            border: "1px solid #E2E8F0",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function POCard({ po, onEdit, onDelete, expanded, onToggle, machines }) {
  const color = getMachineColor(machines, po.machine);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        marginBottom: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          cursor: "pointer",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: "#94A3B8",
            fontSize: 12,
            transition: "transform 0.2s",
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontWeight: 700,
            color: "#1E293B",
            fontSize: 15,
            minWidth: 110,
          }}
        >
          {po.po}
        </span>
        <span
          style={{ flex: 1, color: "#64748B", fontSize: 14, minWidth: 120 }}
        >
          {po.description}
        </span>
        <span style={{ color: "#94A3B8", fontSize: 13, whiteSpace: "nowrap" }}>
          {fmtDate(po.date)}
        </span>
        <span
          style={{
            background: color + "20",
            color,
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {po.machine}
        </span>
        {po.supplier && (
          <span
            style={{
              background: "#F1F5F9",
              color: "#475569",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            🏭 {po.supplier}
          </span>
        )}
        <span style={{ color: "#94A3B8", fontSize: 13, whiteSpace: "nowrap" }}>
          {po.items?.length || 0} items
        </span>
        <span
          style={{
            fontWeight: 700,
            color: "#1E293B",
            fontSize: 15,
            whiteSpace: "nowrap",
          }}
        >
          {fmt(po.total)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(po);
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            cursor: "pointer",
            fontSize: 13,
            color: "#2E75B6",
            fontWeight: 500,
          }}
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(po);
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 7,
            border: "none",
            background: "#FEE2E2",
            cursor: "pointer",
            fontSize: 13,
            color: "#DC2626",
            fontWeight: 500,
          }}
        >
          Delete
        </button>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid #E2E8F0", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {[
                  "Part Number",
                  "Description",
                  "Qty",
                  "Unit Cost",
                  "Line Total",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748B",
                      borderBottom: "1px solid #E2E8F0",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 14px" }}>
                    {item.part_no ? (
                      <span
                        style={{
                          fontFamily: "monospace",
                          background: color + "15",
                          color,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {item.part_no}
                      </span>
                    ) : (
                      <span style={{ color: "#CBD5E1" }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#1E293B",
                      fontSize: 14,
                    }}
                  >
                    {item.name}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#64748B",
                      fontSize: 14,
                    }}
                  >
                    {item.qty}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#64748B",
                      fontSize: 14,
                    }}
                  >
                    {fmt(item.unit_cost)}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontWeight: 600,
                      color: "#1E293B",
                      fontSize: 14,
                    }}
                  >
                    {fmt(item.qty * item.unit_cost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F8FAFC" }}>
                <td
                  colSpan={4}
                  style={{
                    padding: "10px 14px",
                    fontWeight: 700,
                    color: "#1E293B",
                    textAlign: "right",
                    fontSize: 14,
                  }}
                >
                  PO Total
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    fontWeight: 700,
                    color: "#1E293B",
                    fontSize: 15,
                  }}
                >
                  {fmt(po.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function TabPOLog({
  pos,
  loading,
  onRefresh,
  onSave,
  onDelete,
  saving,
  jumpTo,
  setJumpTo,
  machines,
  suppliers,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editPO, setEditPO] = useState(null);
  const [filterMachine, setFilterMachine] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [deletePO, setDeletePO] = useState(null);
  const [delSaving, setDelSaving] = useState(false);

  useEffect(() => {
    if (jumpTo) {
      setExpandedId(jumpTo);
      setJumpTo(null);
    }
  }, [jumpTo, setJumpTo]);

  const filtered = useMemo(() => {
    return pos.filter((p) => {
      if (filterMachine && p.machine !== filterMachine) return false;
      if (filterMonth) {
        const m = parseInt(p.date?.split("-")[1]) - 1;
        if (MONTHS[m] !== filterMonth) return false;
      }
      return true;
    });
  }, [pos, filterMachine, filterMonth]);

  const totalItems = filtered.reduce((s, p) => s + (p.items?.length || 0), 0);

  async function handleDelete() {
    setDelSaving(true);
    await onDelete(deletePO.id);
    setDelSaving(false);
    setDeletePO(null);
  }

  function startEdit(po) {
    setEditPO(po);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selStyle = {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    background: "#fff",
    fontSize: 13,
    color: "#1E293B",
    cursor: "pointer",
  };

  return (
    <div>
      {deletePO && (
        <Modal
          po={deletePO}
          onConfirm={handleDelete}
          onCancel={() => setDeletePO(null)}
          saving={delSaving}
        />
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => {
            setShowForm((s) => !s);
            setEditPO(null);
          }}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            background: "#2E75B6",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {showForm && !editPO ? "✕ Cancel" : "➕ New PO"}
        </button>
        <select
          style={selStyle}
          value={filterMachine}
          onChange={(e) => setFilterMachine(e.target.value)}
        >
          <option value="">All Machines</option>
          {machines.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          style={selStyle}
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          style={{ ...selStyle, padding: "8px 16px" }}
        >
          ↻ Refresh
        </button>
        <span style={{ color: "#64748B", fontSize: 13, marginLeft: "auto" }}>
          {filtered.length} POs · {totalItems} items
        </span>
      </div>
      {showForm && (
        <POForm
          editPO={editPO}
          saving={saving}
          machines={machines}
          suppliers={suppliers}
          onSave={async (data) => {
            await onSave(data, editPO);
            setShowForm(false);
            setEditPO(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditPO(null);
          }}
        />
      )}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#64748B",
            fontSize: 18,
          }}
        >
          ⏳ Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16 }}>No purchase orders found</div>
        </div>
      ) : (
        filtered.map((p) => (
          <POCard
            key={p.id}
            po={p}
            machines={machines}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId((id) => (id === p.id ? null : p.id))}
            onEdit={startEdit}
            onDelete={(po) => setDeletePO(po)}
          />
        ))
      )}
    </div>
  );
}

function TabSearch({ pos, onNavigateToPO, machines }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (
        e.key === "/" &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const lq = q.toLowerCase();
    const rows = [];
    pos.forEach((p) => {
      (p.items || []).forEach((item) => {
        if (
          (item.part_no || "").toLowerCase().includes(lq) ||
          item.name.toLowerCase().includes(lq) ||
          p.po.toLowerCase().includes(lq) ||
          p.description.toLowerCase().includes(lq)
        ) {
          rows.push({
            ...item,
            _po: p.po,
            _poId: p.id,
            _date: p.date,
            _machine: p.machine,
          });
        }
      });
    });
    return rows;
  }, [q, pos]);

  const totalCost = useMemo(
    () => results.reduce((s, r) => s + r.qty * r.unit_cost, 0),
    [results],
  );
  const color = (m) => getMachineColor(machines, m);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 24 }}>
        <span
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 20,
          }}
        >
          🔍
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search parts, descriptions, PO numbers…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px 14px 48px",
            borderRadius: 12,
            border: "2px solid #E2E8F0",
            fontSize: 16,
            color: "#1E293B",
            outline: "none",
          }}
          autoFocus
        />
      </div>
      {!q.trim() ? (
        <div
          style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔎</div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>
            Search across all purchase orders
          </div>
          <div style={{ fontSize: 14 }}>
            Type to search part numbers, descriptions, PO numbers, or press{" "}
            <kbd
              style={{
                background: "#F1F5F9",
                border: "1px solid #CBD5E1",
                borderRadius: 4,
                padding: "2px 6px",
                fontFamily: "monospace",
              }}
            >
              /
            </kbd>{" "}
            anywhere
          </div>
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 16 }}>No results for "{q}"</div>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {[
                    "Part Number",
                    "Item Description",
                    "PO",
                    "Date",
                    "Machine",
                    "Qty",
                    "Unit Cost",
                    "Line Total",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748B",
                        borderBottom: "1px solid #E2E8F0",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 14px" }}>
                      {r.part_no ? (
                        <span
                          style={{
                            fontFamily: "monospace",
                            background: color(r._machine) + "15",
                            color: color(r._machine),
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 13,
                          }}
                        >
                          <Highlight text={r.part_no} term={q} />
                        </span>
                      ) : (
                        <span style={{ color: "#CBD5E1" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#1E293B",
                        fontSize: 14,
                      }}
                    >
                      <Highlight text={r.name} term={q} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => onNavigateToPO(r._poId)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#2E75B6",
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: "underline",
                          padding: 0,
                        }}
                      >
                        <Highlight text={r._po} term={q} />
                      </button>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748B",
                        fontSize: 13,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(r._date)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          background: color(r._machine) + "20",
                          color: color(r._machine),
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {r._machine}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748B",
                        fontSize: 14,
                      }}
                    >
                      {r.qty}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748B",
                        fontSize: 14,
                      }}
                    >
                      {fmt(r.unit_cost)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: "#1E293B",
                        fontSize: 14,
                      }}
                    >
                      {fmt(r.qty * r.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F0F4F8" }}>
                  <td
                    colSpan={7}
                    style={{
                      padding: "12px 14px",
                      fontWeight: 700,
                      color: "#1E293B",
                      textAlign: "right",
                    }}
                  >
                    Total ({results.length} items)
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontWeight: 700,
                      color: "#1E293B",
                      fontSize: 15,
                    }}
                  >
                    {fmt(totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TabMonthly({ pos }) {
  const data = useMemo(() => {
    const map = {};
    pos.forEach((p) => {
      if (!p.date) return;
      const [y, m] = p.date.split("-");
      const key = `${y}-${m}`;
      if (!map[key])
        map[key] = { year: y, month: parseInt(m), pos: 0, items: 0, total: 0 };
      map[key].pos++;
      map[key].items += p.items?.length || 0;
      map[key].total += parseFloat(p.total) || 0;
    });
    return Object.values(map).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );
  }, [pos]);

  const grandTotal = data.reduce((s, d) => s + d.total, 0);
  const grandPOs = data.reduce((s, d) => s + d.pos, 0);
  const grandItems = data.reduce((s, d) => s + d.items, 0);
  const avgSpend = data.length ? grandTotal / data.length : 0;
  const maxSpend = data.length ? Math.max(...data.map((d) => d.total)) : 1;

  const card = (label, value) => (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #E2E8F0",
        flex: "1 1 160px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748B",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1E293B" }}>
        {value}
      </div>
    </div>
  );

  return (
    <div>
      <div
        style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}
      >
        {card("Total Spent", fmt(grandTotal))}
        {card("Total POs", grandPOs)}
        {card("Total Line Items", grandItems)}
        {card("Active Months", data.length)}
        {card("Avg / Month", fmt(avgSpend))}
      </div>
      {data.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#94A3B8",
            fontSize: 16,
          }}
        >
          No data yet
        </div>
      ) : (
        <>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0",
              marginBottom: 24,
            }}
          >
            <h3 style={{ margin: "0 0 20px", color: "#1E293B", fontSize: 16 }}>
              Monthly Spend
            </h3>
            {data.map((d) => (
              <div
                key={`${d.year}-${d.month}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div
                    style={{ fontWeight: 600, color: "#1E293B", fontSize: 14 }}
                  >
                    {MONTHS[d.month - 1]} {d.year}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    {d.pos} POs · {d.items} items
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#F1F5F9",
                    borderRadius: 6,
                    height: 28,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(d.total / maxSpend) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #1E3A5F, #2E75B6)",
                      borderRadius: 6,
                      minWidth: 4,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 110,
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1E293B",
                    fontSize: 14,
                  }}
                >
                  {fmt(d.total)}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Month", "Year", "POs", "Line Items", "Total Cost"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#64748B",
                          borderBottom: "1px solid #E2E8F0",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "#fff" : "#FAFBFC",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#1E293B",
                        fontWeight: 500,
                      }}
                    >
                      {MONTHS[d.month - 1]}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>
                      {d.year}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>
                      {d.pos}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>
                      {d.items}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        color: "#1E293B",
                      }}
                    >
                      {fmt(d.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background: "#F0F4F8",
                    borderTop: "2px solid #E2E8F0",
                  }}
                >
                  <td
                    colSpan={2}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: "#1E293B",
                    }}
                  >
                    Grand Total
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: "#1E293B",
                    }}
                  >
                    {grandPOs}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: "#1E293B",
                    }}
                  >
                    {grandItems}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: "#1E293B",
                      fontSize: 15,
                    }}
                  >
                    {fmt(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TabByMachine({ pos, machines }) {
  const machineData = useMemo(() => {
    const grand = pos.reduce((s, p) => s + parseFloat(p.total || 0), 0);
    return machines.map((m) => {
      const mpos = pos.filter((p) => p.machine === m.name);
      const total = mpos.reduce((s, p) => s + parseFloat(p.total || 0), 0);
      return {
        machine: m.name,
        color: m.color,
        pos: mpos.length,
        items: mpos.reduce((s, p) => s + (p.items?.length || 0), 0),
        total,
        pct: grand > 0 ? (total / grand) * 100 : 0,
      };
    });
  }, [pos, machines]);

  const monthCols = useMemo(() => {
    const keys = new Set();
    pos.forEach((p) => {
      if (p.date) keys.add(p.date.slice(0, 7));
    });
    return Array.from(keys).sort();
  }, [pos]);

  const grid = useMemo(() => {
    const g = {};
    machines.forEach((m) => {
      g[m.name] = {};
      monthCols.forEach((k) => {
        g[m.name][k] = 0;
      });
    });
    pos.forEach((p) => {
      if (!p.date || !p.machine) return;
      const k = p.date.slice(0, 7);
      if (g[p.machine])
        g[p.machine][k] = (g[p.machine][k] || 0) + parseFloat(p.total || 0);
    });
    return g;
  }, [pos, monthCols, machines]);

  function fmtColHeader(k) {
    const [y, m] = k.split("-");
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
  }

  return (
    <div>
      <div
        style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}
      >
        {machineData.map((d) => {
          const color = d.color;
          return (
            <div
              key={d.machine}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "20px 24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                border: "1px solid #E2E8F0",
                flex: "1 1 200px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontWeight: 700, color: "#1E293B", fontSize: 15 }}
                >
                  {d.machine}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                {d.pos} POs · {d.items} items
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#1E293B",
                  marginBottom: 12,
                }}
              >
                {fmt(d.total)}
              </div>
              <div
                style={{
                  background: "#F1F5F9",
                  borderRadius: 6,
                  height: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: `${d.pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 6,
                    minWidth: d.pct > 0 ? 4 : 0,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                {d.pct.toFixed(1)}% of total spend
              </div>
            </div>
          );
        })}
      </div>
      {machines.length === 0 || monthCols.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#94A3B8",
            fontSize: 16,
          }}
        >
          No data yet
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid #E2E8F0",
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1E293B",
                    borderBottom: "1px solid #E2E8F0",
                    position: "sticky",
                    left: 0,
                    background: "#F8FAFC",
                    zIndex: 2,
                    minWidth: 130,
                  }}
                >
                  Machine
                </th>
                {monthCols.map((k) => (
                  <th
                    key={k}
                    style={{
                      padding: "12px 14px",
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748B",
                      borderBottom: "1px solid #E2E8F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtColHeader(k)}
                  </th>
                ))}
                <th
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1E293B",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m, mi) => {
                const color = m.color;
                return (
                  <tr
                    key={m.name}
                    style={{
                      background: mi % 2 === 0 ? "#fff" : "#FAFBFC",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        position: "sticky",
                        left: 0,
                        background: mi % 2 === 0 ? "#fff" : "#FAFBFC",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            color: "#1E293B",
                            fontSize: 14,
                          }}
                        >
                          {m.name}
                        </span>
                      </div>
                    </td>
                    {monthCols.map((k) => (
                      <td
                        key={k}
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          color: (grid[m.name][k] || 0) > 0 ? "#1E293B" : "#CBD5E1",
                          fontSize: 14,
                          fontWeight: (grid[m.name][k] || 0) > 0 ? 500 : 400,
                        }}
                      >
                        {(grid[m.name][k] || 0) > 0 ? fmt(grid[m.name][k]) : "—"}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: color,
                        fontSize: 14,
                      }}
                    >
                      {fmt(
                        machineData.find((d) => d.machine === m.name)?.total || 0,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                style={{
                  background: "#F0F4F8",
                  borderTop: "2px solid #E2E8F0",
                }}
              >
                <td
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "#1E293B",
                    position: "sticky",
                    left: 0,
                    background: "#F0F4F8",
                  }}
                >
                  Grand Total
                </td>
                {monthCols.map((k) => {
                  const colTotal = machines.reduce(
                    (s, m) => s + (grid[m.name][k] || 0),
                    0,
                  );
                  return (
                    <td
                      key={k}
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#1E293B",
                        fontSize: 14,
                      }}
                    >
                      {colTotal > 0 ? fmt(colTotal) : "—"}
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1E293B",
                    fontSize: 15,
                  }}
                >
                  {fmt(machineData.reduce((s, d) => s + d.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [pos, setPos] = useState([]);
  const [machines, setMachines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState("loading");
  const [tab, setTab] = useState("log");
  const [saving, setSaving] = useState(false);
  const [machineSaving, setMachineSaving] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [jumpTo, setJumpTo] = useState(null);

  function addToast(message, type = "success") {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setDbStatus("loading");
    try {
      const [orders, items, machineRows, supplierRows] = await Promise.all([
        sbFetch("/purchase_orders?select=*&order=date.desc"),
        sbFetch("/line_items?select=*&order=created_at.asc"),
        sbFetch("/machines?select=*&order=created_at.asc"),
        sbFetch("/suppliers?select=*&order=created_at.asc"),
      ]);
      const itemMap = {};
      (items || []).forEach((i) => {
        if (!itemMap[i.po_id]) itemMap[i.po_id] = [];
        itemMap[i.po_id].push(i);
      });
      setPos((orders || []).map((p) => ({ ...p, items: itemMap[p.id] || [] })));
      setMachines(machineRows || []);
      setSuppliers(supplierRows || []);
      setDbStatus("connected");
      setError(null);
    } catch (e) {
      setError(e.message);
      setDbStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave(data, editPO) {
    setSaving(true);
    try {
      let poId;
      const total = data.items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      if (editPO) {
        await sbFetch(`/purchase_orders?id=eq.${editPO.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            po: data.po,
            date: data.date,
            machine: data.machine,
            supplier: data.supplier || null,
            description: data.description,
            total,
          }),
        });
        await sbFetch(`/line_items?po_id=eq.${editPO.id}`, {
          method: "DELETE",
        });
        poId = editPO.id;
      } else {
        const [newPO] = await sbFetch("/purchase_orders", {
          method: "POST",
          body: JSON.stringify({
            po: data.po,
            date: data.date,
            machine: data.machine,
            supplier: data.supplier || null,
            description: data.description,
            total,
          }),
        });
        poId = newPO.id;
      }
      if (data.items.length > 0) {
        await sbFetch("/line_items", {
          method: "POST",
          body: JSON.stringify(
            data.items.map((i) => ({
              po_id: poId,
              part_no: i.part_no || "",
              name: i.name,
              qty: i.qty,
              unit_cost: i.unit_cost,
            })),
          ),
        });
      }
      addToast(
        editPO ? "PO updated successfully" : "PO added successfully",
        "success",
      );
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await sbFetch(`/purchase_orders?id=eq.${id}`, { method: "DELETE" });
      addToast("PO deleted", "success");
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
      throw e;
    }
  }

  async function handleSaveMachine(data, editMachine) {
    setMachineSaving(true);
    try {
      if (editMachine) {
        await sbFetch(`/machines?id=eq.${editMachine.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: data.name, color: data.color }),
        });
        addToast("Machine updated", "success");
      } else {
        await sbFetch("/machines", {
          method: "POST",
          body: JSON.stringify({ name: data.name, color: data.color }),
        });
        addToast("Machine added", "success");
      }
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
    } finally {
      setMachineSaving(false);
    }
  }

  async function handleDeleteMachine(id) {
    try {
      await sbFetch(`/machines?id=eq.${id}`, { method: "DELETE" });
      addToast("Machine deleted", "success");
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
      throw e;
    }
  }

  async function handleSaveSupplier(data, editSupplier) {
    setSupplierSaving(true);
    try {
      if (editSupplier) {
        await sbFetch(`/suppliers?id=eq.${editSupplier.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: data.name }),
        });
        addToast("Supplier updated", "success");
      } else {
        await sbFetch("/suppliers", {
          method: "POST",
          body: JSON.stringify({ name: data.name }),
        });
        addToast("Supplier added", "success");
      }
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
    } finally {
      setSupplierSaving(false);
    }
  }

  async function handleDeleteSupplier(id) {
    try {
      await sbFetch(`/suppliers?id=eq.${id}`, { method: "DELETE" });
      addToast("Supplier deleted", "success");
      await loadData();
    } catch (e) {
      addToast("Error: " + e.message, "error");
      throw e;
    }
  }

  function navigateToPO(id) {
    setTab("log");
    setJumpTo(id);
  }

  const grandTotal = useMemo(
    () => pos.reduce((s, p) => s + parseFloat(p.total || 0), 0),
    [pos],
  );
  const tabs = [
    { id: "log", label: "📋 PO Log" },
    { id: "search", label: "🔍 Search" },
    { id: "monthly", label: "📅 Monthly" },
    { id: "machine", label: "🔧 By Machine" },
    { id: "machines", label: "⚙️ Machines" },
    { id: "suppliers", label: "🏭 Suppliers" },
  ];

  const statusColor =
    dbStatus === "connected"
      ? "#10B981"
      : dbStatus === "loading"
        ? "#F59E0B"
        : "#EF4444";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F0F4F8",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <Toast toasts={toasts} />
      <div
        style={{
          background: "linear-gradient(135deg, #1E3A5F 0%, #2E75B6 100%)",
          padding: "20px 24px",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 22 }}>⚙️</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>
                PO Tracker
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusColor,
                  display: "inline-block",
                  boxShadow: `0 0 6px ${statusColor}`,
                }}
                title={dbStatus}
              />
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Purchase order management
            </div>
          </div>
          <button
            onClick={() => {
              setTab("search");
            }}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            🔍 Search parts{" "}
            <kbd
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 4,
                padding: "1px 5px",
                fontFamily: "monospace",
                fontSize: 11,
              }}
            >
              /
            </kbd>
          </button>
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 12,
              padding: "10px 18px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                opacity: 0.7,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total Spent
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {fmt(grandTotal)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "12px 0",
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "9px 20px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: "nowrap",
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? "#1E293B" : "#64748B",
                boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ color: "#DC2626", fontSize: 16 }}>⚠️</span>
            <span style={{ color: "#991B1B", flex: 1, fontSize: 14 }}>
              Connection error: {error}
            </span>
            <button
              onClick={loadData}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                background: "#DC2626",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div style={{ paddingBottom: 40 }}>
          {tab === "log" && (
            <TabPOLog
              pos={pos}
              loading={loading}
              onRefresh={loadData}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={saving}
              jumpTo={jumpTo}
              setJumpTo={setJumpTo}
              machines={machines}
              suppliers={suppliers}
            />
          )}
          {tab === "search" && (
            <TabSearch pos={pos} onNavigateToPO={navigateToPO} machines={machines} />
          )}
          {tab === "monthly" && <TabMonthly pos={pos} />}
          {tab === "machine" && <TabByMachine pos={pos} machines={machines} />}
          {tab === "machines" && (
            <TabMachines
              machines={machines}
              pos={pos}
              onSave={handleSaveMachine}
              onDelete={handleDeleteMachine}
              saving={machineSaving}
            />
          )}
          {tab === "suppliers" && (
            <TabSuppliers
              suppliers={suppliers}
              pos={pos}
              onSave={handleSaveSupplier}
              onDelete={handleDeleteSupplier}
              saving={supplierSaving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
