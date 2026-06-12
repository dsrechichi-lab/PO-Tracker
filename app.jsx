import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://quwvxsyndzohcejlwpro.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsYXdldW1jdXBzbmtwbHllbm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzI5MjksImV4cCI6MjA5NjgwODkyOX0.9FEHb9S7baoZklx3N1lJGS_teYm-pN4IizzyqmXQzic";

const hdrs = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation",
};

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: hdrs, ...opts });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const MACHINES = ["Machine A", "Machine B", "Machine C", "Machine D"];
const MONTHS   = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
const MC = {
  "Machine A": { bg:"#EBF5FF", dot:"#2E75B6", text:"#1A4A7A", light:"#DBEAFE" },
  "Machine B": { bg:"#ECFDF5", dot:"#059669", text:"#065F46", light:"#D1FAE5" },
  "Machine C": { bg:"#FFF7ED", dot:"#EA580C", text:"#7C2D12", light:"#FED7AA" },
  "Machine D": { bg:"#F5F3FF", dot:"#7C3AED", text:"#4C1D95", light:"#EDE9FE" },
};

function fmt(n) { return Number(n||0).toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}); }
function getMY(d) {
  if (!d) return { month:"", year:"" };
  const dt = new Date(d+"T00:00:00");
  return { month: MONTHS[dt.getMonth()], year: dt.getFullYear() };
}
function uid() { return Math.random().toString(36).slice(2,9); }
const emptyItem = () => ({ id:uid(), part_no:"", name:"", qty:"", unit_cost:"" });
const emptyForm = () => ({ po:"", date:"", machine:MACHINES[0], description:"", items:[emptyItem()] });

function Hl({ text, q }) {
  if (!q||!text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx===-1) return <>{text}</>;
  return <>{text.slice(0,idx)}<mark style={{background:"#FDE68A",borderRadius:2,padding:"0 1px"}}>{text.slice(idx,idx+q.length)}</mark>{text.slice(idx+q.length)}</>;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [pos, setPOs]               = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dbError, setDbError]       = useState(null);
  const [view, setView]             = useState("log");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm());
  const [editId, setEditId]         = useState(null);
  const [errors, setErrors]         = useState({});
  const [deleteId, setDeleteId]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [expandedPO, setExpandedPO] = useState(null);
  const [search, setSearch]         = useState("");
  const [filterMachine, setFilterMachine] = useState("All");
  const [filterMonth, setFilterMonth]     = useState("All");
  const searchRef = useRef();

  // ── load all POs + their line items ──────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setDbError(null);
    try {
      const [poRows, itemRows] = await Promise.all([
        sbFetch("/purchase_orders?select=*&order=date.desc"),
        sbFetch("/line_items?select=*&order=created_at.asc"),
      ]);
      const itemsByPO = {};
      (itemRows||[]).forEach(it => {
        if (!itemsByPO[it.po_id]) itemsByPO[it.po_id] = [];
        itemsByPO[it.po_id].push(it);
      });
      setPOs((poRows||[]).map(p => ({ ...p, items: itemsByPO[p.id] || [] })));
    } catch(e) {
      setDbError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg, type="success") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3000);
  }

  // ── computed ──────────────────────────────────────────────────────────────
  const grandTotal = useMemo(()=>pos.reduce((s,p)=>s+(Number(p.total)||0),0),[pos]);

  const searchResults = useMemo(()=>{
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    const out = [];
    pos.forEach(p => {
      (p.items||[]).forEach(it => {
        if (
          (it.part_no||"").toLowerCase().includes(q) ||
          (it.name||"").toLowerCase().includes(q)    ||
          (p.po||"").toLowerCase().includes(q)       ||
          (p.description||"").toLowerCase().includes(q)
        ) out.push({po:p, item:it});
      });
    });
    return out;
  },[pos,search]);

  const filteredPOs = useMemo(()=>
    pos.filter(p=>{
      const {month} = getMY(p.date);
      return (filterMachine==="All"||p.machine===filterMachine) &&
             (filterMonth==="All"||month===filterMonth);
    })
  ,[pos,filterMachine,filterMonth]);

  const monthlyData = useMemo(()=>{
    const map={};
    pos.forEach(p=>{
      const {month,year}=getMY(p.date);
      const k=`${year}-${String(MONTHS.indexOf(month)).padStart(2,"0")}`;
      if(!map[k]) map[k]={month,year,total:0,count:0,items:0};
      map[k].total+=Number(p.total)||0;
      map[k].count+=1;
      map[k].items+=(p.items||[]).length;
    });
    return Object.entries(map).sort((a,b)=>a[0]<b[0]?-1:1).map(([,v])=>v);
  },[pos]);

  const machineData = useMemo(()=>MACHINES.map(m=>{
    const mp=pos.filter(p=>p.machine===m);
    const byMonth={};
    mp.forEach(p=>{ const {month}=getMY(p.date); byMonth[month]=(byMonth[month]||0)+(Number(p.total)||0); });
    return { machine:m, total:mp.reduce((s,p)=>s+(Number(p.total)||0),0), count:mp.length, items:mp.reduce((s,p)=>s+(p.items||[]).length,0), byMonth };
  }),[pos]);

  const maxMonthly = Math.max(...monthlyData.map(m=>m.total),1);

  // ── form helpers ──────────────────────────────────────────────────────────
  function setField(k,v){ setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:""})); }
  function setItem(idx,k,v){ setForm(f=>{ const it=[...f.items]; it[idx]={...it[idx],[k]:v}; return {...f,items:it}; }); }
  function addItem(){ setForm(f=>({...f,items:[...f.items,emptyItem()]})); }
  function removeItem(idx){ setForm(f=>{ const it=f.items.filter((_,i)=>i!==idx); return {...f,items:it.length?it:[emptyItem()]}; }); }

  function validate(){
    const e={};
    if(!form.po.trim()) e.po="Required";
    if(!form.date) e.date="Required";
    if(!form.description.trim()) e.description="Required";
    form.items.forEach((it,i)=>{
      if(!it.name.trim()) e[`n${i}`]="Required";
      if(!it.qty||isNaN(it.qty)||Number(it.qty)<=0) e[`q${i}`]="Invalid";
      if(!it.unit_cost||isNaN(it.unit_cost)||Number(it.unit_cost)<=0) e[`c${i}`]="Invalid";
    });
    return e;
  }

  // ── SAVE to Supabase ──────────────────────────────────────────────────────
  async function handleSubmit() {
    const e=validate();
    if(Object.keys(e).length){setErrors(e);return;}
    setSaving(true);
    try {
      const items = form.items.map(it=>({...it, qty:Number(it.qty), unit_cost:Number(it.unit_cost)}));
      const total = items.reduce((s,it)=>s+it.qty*it.unit_cost,0);
      const poPayload = { po:form.po, date:form.date, machine:form.machine, description:form.description, total };

      if (editId) {
        // update PO row
        await sbFetch(`/purchase_orders?id=eq.${editId}`, {
          method:"PATCH", body: JSON.stringify(poPayload)
        });
        // delete old items, reinsert
        await sbFetch(`/line_items?po_id=eq.${editId}`, { method:"DELETE" });
        await sbFetch("/line_items", {
          method:"POST",
          body: JSON.stringify(items.map(it=>({ po_id:editId, part_no:it.part_no||"", name:it.name, qty:it.qty, unit_cost:it.unit_cost })))
        });
        showToast("PO updated.");
      } else {
        // insert PO
        const [newPO] = await sbFetch("/purchase_orders", { method:"POST", body: JSON.stringify(poPayload) });
        // insert items
        await sbFetch("/line_items", {
          method:"POST",
          body: JSON.stringify(items.map(it=>({ po_id:newPO.id, part_no:it.part_no||"", name:it.name, qty:it.qty, unit_cost:it.unit_cost })))
        });
        showToast("PO saved to database.");
      }
      await loadData();
      setForm(emptyForm()); setEditId(null); setShowForm(false); setErrors({});
    } catch(err) {
      showToast("Error: "+err.message, "error");
    }
    setSaving(false);
  }

  function startEdit(p){
    setForm({
      po:p.po, date:p.date, machine:p.machine, description:p.description,
      items:(p.items||[]).map(it=>({...it, qty:String(it.qty), unit_cost:String(it.unit_cost)}))
    });
    setEditId(p.id); setShowForm(true); setView("log");
    setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),50);
  }

  function cancelForm(){ setForm(emptyForm()); setEditId(null); setShowForm(false); setErrors({}); }

  async function doDelete(){
    setSaving(true);
    try {
      await sbFetch(`/purchase_orders?id=eq.${deleteId}`, { method:"DELETE" });
      setDeleteId(null);
      await loadData();
      showToast("PO deleted.", "error");
    } catch(err) {
      showToast("Error: "+err.message, "error");
    }
    setSaving(false);
  }

  useEffect(()=>{
    function onKey(e){
      if(e.key==="/"&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA"){
        e.preventDefault(); setView("search"); setTimeout(()=>searchRef.current?.focus(),60);
      }
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);

  const formTotal = form.items.reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit_cost)||0),0);

  // ── styles ────────────────────────────────────────────────────────────────
  const inp = (err) => ({
    width:"100%", padding:"9px 12px", borderRadius:8,
    border:`1.5px solid ${err?"#FCA5A5":"#E2E8F0"}`,
    fontSize:13, outline:"none", boxSizing:"border-box",
    fontFamily:"inherit", background:err?"#FFF5F5":"#FAFAFA",
  });
  const card = { background:"#fff", borderRadius:16, boxShadow:"0 2px 12px rgba(0,0,0,0.07)", border:"1px solid #E2E8F0" };
  const lbl  = { display:"block", fontSize:11, fontWeight:700, color:"#64748B", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.6px" };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"#F0F4F8",fontFamily:"'Inter','Segoe UI',system-ui,sans-serif"}}>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,
          background:toast.type==="error"?"#FEE2E2":"#D1FAE5",
          color:toast.type==="error"?"#991B1B":"#065F46",
          border:`1px solid ${toast.type==="error"?"#FCA5A5":"#6EE7B7"}`,
          borderRadius:10,padding:"12px 20px",fontWeight:600,fontSize:14,
          boxShadow:"0 4px 16px rgba(0,0,0,0.14)"}}>
          {toast.msg}
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:"32px 36px",maxWidth:320,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:36,marginBottom:10}}>🗑️</div>
            <div style={{fontWeight:700,fontSize:17,marginBottom:6,color:"#1E293B"}}>Delete this PO?</div>
            <div style={{color:"#64748B",fontSize:13,marginBottom:24}}>All line items will be permanently removed.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDeleteId(null)} style={{padding:"10px 22px",borderRadius:9,border:"1.5px solid #E2E8F0",background:"#fff",fontWeight:600,cursor:"pointer",fontSize:14}}>Cancel</button>
              <button onClick={doDelete} disabled={saving} style={{padding:"10px 22px",borderRadius:9,border:"none",background:"#EF4444",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14,opacity:saving?0.6:1}}>
                {saving?"Deleting…":"Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#1E3A5F 0%,#2E75B6 100%)",padding:"22px 28px 20px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:44,height:44,borderRadius:11,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>⚙️</div>
          <div>
            <div style={{color:"#fff",fontWeight:800,fontSize:21,letterSpacing:"-0.3px"}}>Destruction PO Tracker</div>
            <div style={{color:"#93C5FD",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:dbError?"#F87171":loading?"#FCD34D":"#34D399",display:"inline-block"}}></span>
              {dbError ? "Database error" : loading ? "Connecting…" : "Live — Supabase"}
            </div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>{setView("search");setTimeout(()=>searchRef.current?.focus(),60);}}
              style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.12)",border:"1.5px solid rgba(255,255,255,0.25)",borderRadius:22,padding:"8px 18px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
              🔍 Search parts <kbd style={{background:"rgba(255,255,255,0.15)",borderRadius:5,padding:"1px 6px",fontSize:11,fontFamily:"monospace"}}>/</kbd>
            </button>
            <div style={{background:"rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 20px",textAlign:"center"}}>
              <div style={{color:"#93C5FD",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total Spent</div>
              <div style={{color:"#fff",fontWeight:800,fontSize:20}}>{fmt(grandTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px"}}>

        {/* DB error banner */}
        {dbError && (
          <div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:12,padding:"14px 20px",marginBottom:20,color:"#991B1B",fontSize:13}}>
            <strong>Database connection error:</strong> {dbError}
            <br/><span style={{fontSize:12,opacity:0.8}}>Make sure you've run setup_tables.sql in your Supabase SQL Editor.</span>
            <button onClick={loadData} style={{marginLeft:16,padding:"5px 14px",borderRadius:7,border:"1px solid #FCA5A5",background:"#fff",color:"#991B1B",fontWeight:700,cursor:"pointer",fontSize:12}}>Retry</button>
          </div>
        )}

        {/* NAV */}
        <div style={{display:"flex",gap:4,background:"#E2E8F0",borderRadius:12,padding:4,marginBottom:24,width:"fit-content",flexWrap:"wrap"}}>
          {[["log","📋 PO Log"],["search","🔍 Search"],["monthly","📅 Monthly"],["machines","🔧 By Machine"]].map(([k,label])=>(
            <button key={k} onClick={()=>setView(k)} style={{
              padding:"8px 18px",borderRadius:9,border:"none",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all 0.15s",
              background:view===k?"#fff":"transparent",color:view===k?"#1E3A5F":"#64748B",
              boxShadow:view===k?"0 1px 6px rgba(0,0,0,0.10)":"none"
            }}>{label}</button>
          ))}
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{...card,padding:"60px 20px",textAlign:"center",color:"#94A3B8"}}>
            <div style={{fontSize:32,marginBottom:12,animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</div>
            <div style={{fontWeight:600}}>Loading from database…</div>
          </div>
        )}

        {!loading && (
          <>
          {/* ══ PO LOG ══ */}
          {view==="log" && (
            <div>
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={()=>{ if(showForm&&!editId){cancelForm();}else{cancelForm();setShowForm(true);} }}
                  style={{padding:"10px 20px",borderRadius:9,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",
                    background:"linear-gradient(135deg,#1E3A5F,#2E75B6)",color:"#fff",boxShadow:"0 2px 8px rgba(30,58,95,0.22)"}}>
                  {showForm&&!editId?"✕ Cancel":"➕ New PO"}
                </button>
                <select value={filterMachine} onChange={e=>setFilterMachine(e.target.value)}
                  style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                  <option value="All">All Machines</option>
                  {MACHINES.map(m=><option key={m}>{m}</option>)}
                </select>
                <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
                  style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                  <option value="All">All Months</option>
                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                </select>
                <button onClick={loadData} style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,cursor:"pointer",color:"#64748B",fontWeight:600}}>↻ Refresh</button>
                <span style={{marginLeft:"auto",color:"#64748B",fontSize:13}}>
                  {filteredPOs.length} PO{filteredPOs.length!==1?"s":""} · {filteredPOs.reduce((s,p)=>s+(p.items||[]).length,0)} items
                </span>
              </div>

              {/* FORM */}
              {showForm && (
                <div style={{...card,padding:28,marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:16,color:"#1E293B",marginBottom:20}}>{editId?"✏️ Edit PO":"➕ New Purchase Order"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:18}}>
                    <div>
                      <label style={lbl}>PO Number</label>
                      <input value={form.po} onChange={e=>setField("po",e.target.value)} placeholder="PO-0099" style={inp(errors.po)} />
                      {errors.po&&<div style={{color:"#EF4444",fontSize:11,marginTop:3}}>{errors.po}</div>}
                    </div>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" value={form.date} onChange={e=>setField("date",e.target.value)} style={inp(errors.date)} />
                      {errors.date&&<div style={{color:"#EF4444",fontSize:11,marginTop:3}}>{errors.date}</div>}
                    </div>
                    <div style={{gridColumn:"span 2"}}>
                      <label style={lbl}>PO Description</label>
                      <input value={form.description} onChange={e=>setField("description",e.target.value)} placeholder="e.g. Bearing replacement batch" style={inp(errors.description)} />
                      {errors.description&&<div style={{color:"#EF4444",fontSize:11,marginTop:3}}>{errors.description}</div>}
                    </div>
                  </div>
                  <div style={{marginBottom:20}}>
                    <label style={lbl}>Allocate to Machine</label>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {MACHINES.map(m=>{ const c=MC[m],sel=form.machine===m; return (
                        <button key={m} onClick={()=>setField("machine",m)} style={{padding:"8px 16px",borderRadius:9,border:`2px solid ${sel?c.dot:"#E2E8F0"}`,background:sel?c.bg:"#FAFAFA",cursor:"pointer",fontWeight:sel?700:500,fontSize:13,color:sel?c.text:"#64748B",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:c.dot,display:"inline-block"}}></span>{m}
                        </button>
                      );})}
                    </div>
                  </div>
                  <div style={{marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <label style={{...lbl,margin:0}}>Line Items</label>
                      <button onClick={addItem} style={{padding:"5px 14px",borderRadius:8,border:"1.5px solid #BFDBFE",background:"#EFF6FF",color:"#2E75B6",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Add Item</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"160px 1fr 72px 110px 100px 34px",gap:8,marginBottom:6,padding:"0 4px"}}>
                      {["Part No.","Item Description","Qty","Unit Cost ($)","Total",""].map((h,i)=>(
                        <div key={i} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",textAlign:i>=2?"center":"left"}}>{h}</div>
                      ))}
                    </div>
                    {form.items.map((it,idx)=>{
                      const lt=(Number(it.qty)||0)*(Number(it.unit_cost)||0);
                      return (
                        <div key={it.id} style={{display:"grid",gridTemplateColumns:"160px 1fr 72px 110px 100px 34px",gap:8,marginBottom:8,alignItems:"center"}}>
                          <input value={it.part_no} onChange={e=>setItem(idx,"part_no",e.target.value)} placeholder="BRG-6205" style={{...inp(false),fontSize:12,fontFamily:"monospace"}} />
                          <input value={it.name} onChange={e=>setItem(idx,"name",e.target.value)} placeholder="Item description" style={{...inp(!!errors[`n${idx}`]),fontSize:12}} />
                          <input type="number" min="1" value={it.qty} onChange={e=>setItem(idx,"qty",e.target.value)} placeholder="1" style={{...inp(!!errors[`q${idx}`]),fontSize:12,textAlign:"center"}} />
                          <input type="number" min="0.01" step="0.01" value={it.unit_cost} onChange={e=>setItem(idx,"unit_cost",e.target.value)} placeholder="0.00" style={{...inp(!!errors[`c${idx}`]),fontSize:12,textAlign:"right"}} />
                          <div style={{background:"#F1F5F9",borderRadius:8,padding:"9px 10px",fontSize:12,fontWeight:700,color:"#1E3A5F",textAlign:"right"}}>{fmt(lt)}</div>
                          <button onClick={()=>removeItem(idx)} style={{width:32,height:32,borderRadius:8,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",fontWeight:700,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,paddingTop:10,borderTop:"1.5px solid #F1F5F9",marginTop:4}}>
                      <span style={{fontSize:13,color:"#64748B",fontWeight:600}}>PO Total:</span>
                      <span style={{fontSize:20,fontWeight:800,color:"#1E3A5F"}}>{fmt(formTotal)}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={handleSubmit} disabled={saving} style={{padding:"11px 28px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#1E3A5F,#2E75B6)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",boxShadow:"0 2px 8px rgba(30,58,95,0.22)",opacity:saving?0.7:1}}>
                      {saving?"Saving…": editId?"Save Changes":"Add PO"}
                    </button>
                    <button onClick={cancelForm} style={{padding:"11px 22px",borderRadius:9,border:"1.5px solid #E2E8F0",background:"#fff",fontWeight:600,fontSize:14,cursor:"pointer",color:"#64748B"}}>Cancel</button>
                  </div>
                </div>
              )}

              {/* PO CARDS */}
              {filteredPOs.length===0&&!showForm && (
                <div style={{...card,padding:"60px 20px",textAlign:"center",color:"#94A3B8"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📋</div>
                  <div style={{fontWeight:600,fontSize:15}}>No POs yet. Add your first one above.</div>
                </div>
              )}
              {filteredPOs.map(p=>{
                const c=MC[p.machine], exp=expandedPO===p.id;
                return (
                  <div key={p.id} style={{...card,marginBottom:10,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",padding:"13px 18px",gap:10,cursor:"pointer",userSelect:"none",flexWrap:"wrap"}} onClick={()=>setExpandedPO(exp?null:p.id)}>
                      <span style={{color:"#94A3B8",fontSize:12,transition:"transform 0.2s",display:"inline-block",transform:exp?"rotate(90deg)":"rotate(0deg)",flexShrink:0}}>▶</span>
                      <div style={{fontWeight:700,color:"#1E3A5F",fontSize:14,minWidth:85,flexShrink:0}}>{p.po}</div>
                      <div style={{color:"#64748B",fontSize:13,flex:1,minWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.description}</div>
                      <div style={{color:"#94A3B8",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>{new Date(p.date+"T00:00:00").toLocaleDateString("en-US",{day:"2-digit",month:"short",year:"numeric"})}</div>
                      <span style={{background:c.bg,color:c.text,borderRadius:20,padding:"3px 12px",fontWeight:600,fontSize:12,display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",flexShrink:0}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:c.dot}}></span>{p.machine}
                      </span>
                      <span style={{background:"#F1F5F9",borderRadius:8,padding:"3px 10px",fontSize:12,color:"#64748B",whiteSpace:"nowrap",flexShrink:0}}>{(p.items||[]).length} item{(p.items||[]).length!==1?"s":""}</span>
                      <div style={{fontWeight:800,color:"#1E3A5F",fontSize:14,minWidth:80,textAlign:"right",flexShrink:0}}>{fmt(p.total)}</div>
                      <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>startEdit(p)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#EFF6FF",color:"#2E75B6",fontWeight:700,fontSize:12,cursor:"pointer"}}>Edit</button>
                        <button onClick={()=>setDeleteId(p.id)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#FEF2F2",color:"#EF4444",fontWeight:700,fontSize:12,cursor:"pointer"}}>Del</button>
                      </div>
                    </div>
                    {exp && (
                      <div style={{borderTop:"1px solid #F1F5F9",padding:"4px 18px 16px"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead>
                            <tr style={{background:"#F8FAFC"}}>
                              {["Part Number","Description","Qty","Unit Cost","Line Total"].map((h,i)=>(
                                <th key={h} style={{padding:"8px 12px",textAlign:i>=2?"right":"left",fontWeight:700,color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.4px",borderBottom:"1px solid #E2E8F0"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(p.items||[]).map((it,i)=>(
                              <tr key={it.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F1F5F9"}}>
                                <td style={{padding:"9px 12px"}}>
                                  {it.part_no
                                    ? <span style={{background:c.light,color:c.text,borderRadius:6,padding:"2px 9px",fontWeight:700,fontSize:12,fontFamily:"monospace"}}>{it.part_no}</span>
                                    : <span style={{color:"#CBD5E1",fontSize:12}}>—</span>}
                                </td>
                                <td style={{padding:"9px 12px",color:"#334155"}}>{it.name}</td>
                                <td style={{padding:"9px 12px",textAlign:"right",color:"#334155"}}>{it.qty}</td>
                                <td style={{padding:"9px 12px",textAlign:"right",color:"#334155"}}>{fmt(it.unit_cost)}</td>
                                <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:"#1E3A5F"}}>{fmt(it.qty*it.unit_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{background:"#EFF6FF",borderTop:"2px solid #BFDBFE"}}>
                              <td colSpan={4} style={{padding:"9px 12px",fontWeight:700,color:"#1E3A5F",textAlign:"right"}}>PO Total</td>
                              <td style={{padding:"9px 12px",fontWeight:800,color:"#1E3A5F",textAlign:"right",fontSize:14}}>{fmt(p.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ SEARCH ══ */}
          {view==="search" && (
            <div>
              <div style={{...card,padding:24,marginBottom:20}}>
                <div style={{fontWeight:700,fontSize:16,color:"#1E293B",marginBottom:14}}>🔍 Search Parts & POs</div>
                <div style={{position:"relative"}}>
                  <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Type a part number, description, or PO number…"
                    style={{...inp(false),fontSize:15,padding:"13px 44px",borderRadius:12,border:"2px solid #2E75B6",background:"#fff"}} />
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:18,pointerEvents:"none"}}>🔍</span>
                  {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94A3B8",lineHeight:1}}>×</button>}
                </div>
                {search&&<div style={{marginTop:8,color:"#64748B",fontSize:13}}><strong style={{color:"#1E3A5F"}}>{searchResults.length}</strong> result{searchResults.length!==1?"s":""} for <strong>"{search}"</strong></div>}
              </div>
              {!search && (
                <div style={{...card,padding:"60px 20px",textAlign:"center",color:"#94A3B8"}}>
                  <div style={{fontSize:52,marginBottom:14}}>🔎</div>
                  <div style={{fontWeight:700,fontSize:16,color:"#475569",marginBottom:8}}>Find any part instantly</div>
                  <div style={{fontSize:13,maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
                    Search by part number (e.g. <code style={{background:"#F1F5F9",borderRadius:5,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>BRG-6205</code>), item name, or PO number.
                    <br/>Press <kbd style={{background:"#E2E8F0",borderRadius:5,padding:"2px 8px",fontSize:12,fontFamily:"monospace"}}>/</kbd> anywhere to jump here.
                  </div>
                </div>
              )}
              {search&&searchResults.length===0 && (
                <div style={{...card,padding:"50px 20px",textAlign:"center",color:"#94A3B8"}}>
                  <div style={{fontSize:36,marginBottom:10}}>😶</div>
                  <div style={{fontWeight:600,fontSize:15,color:"#475569"}}>No results for "{search}"</div>
                </div>
              )}
              {search&&searchResults.length>0 && (
                <div style={{...card,overflow:"hidden"}}>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead>
                        <tr style={{background:"#1E3A5F"}}>
                          {["Part Number","Item Description","PO","Date","Machine","Qty","Unit Cost","Line Total"].map(h=>(
                            <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.4px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map(({po:p,item:it},i)=>{
                          const c=MC[p.machine];
                          return (
                            <tr key={`${p.id}-${it.id}`} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"#fff":"#FAFBFC"}}>
                              <td style={{padding:"11px 14px"}}>
                                {it.part_no
                                  ? <span style={{background:c.light,color:c.text,borderRadius:6,padding:"3px 9px",fontWeight:700,fontSize:12,fontFamily:"monospace"}}><Hl text={it.part_no} q={search}/></span>
                                  : <span style={{color:"#CBD5E1"}}>—</span>}
                              </td>
                              <td style={{padding:"11px 14px",color:"#334155"}}><Hl text={it.name} q={search}/></td>
                              <td style={{padding:"11px 14px"}}>
                                <button onClick={()=>{setView("log");setExpandedPO(p.id);}} style={{background:"none",border:"none",color:"#2E75B6",fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"underline",padding:0}}>
                                  <Hl text={p.po} q={search}/>
                                </button>
                              </td>
                              <td style={{padding:"11px 14px",color:"#64748B",whiteSpace:"nowrap"}}>{new Date(p.date+"T00:00:00").toLocaleDateString("en-US",{day:"2-digit",month:"short",year:"numeric"})}</td>
                              <td style={{padding:"11px 14px"}}>
                                <span style={{background:c.bg,color:c.text,borderRadius:20,padding:"3px 10px",fontWeight:600,fontSize:12,display:"inline-flex",alignItems:"center",gap:4}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:c.dot}}></span>{p.machine}
                                </span>
                              </td>
                              <td style={{padding:"11px 14px",color:"#334155",textAlign:"center"}}>{it.qty}</td>
                              <td style={{padding:"11px 14px",color:"#334155",textAlign:"right"}}>{fmt(it.unit_cost)}</td>
                              <td style={{padding:"11px 14px",fontWeight:700,color:"#1E3A5F",textAlign:"right"}}>{fmt(it.qty*it.unit_cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{background:"#F0F4F8",borderTop:"2px solid #E2E8F0"}}>
                          <td colSpan={7} style={{padding:"11px 14px",fontWeight:700,color:"#1E3A5F",textAlign:"right"}}>Results Total</td>
                          <td style={{padding:"11px 14px",fontWeight:800,color:"#1E3A5F",textAlign:"right",fontSize:14}}>{fmt(searchResults.reduce((s,{item:it})=>s+it.qty*it.unit_cost,0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MONTHLY ══ */}
          {view==="monthly" && (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
                {[
                  {label:"Total Spent",value:fmt(grandTotal),icon:"💰"},
                  {label:"Total POs",value:pos.length,icon:"📋"},
                  {label:"Total Items",value:pos.reduce((s,p)=>s+(p.items||[]).length,0),icon:"🔩"},
                  {label:"Active Months",value:monthlyData.length,icon:"📅"},
                  {label:"Avg / Month",value:monthlyData.length?fmt(grandTotal/monthlyData.length):"—",icon:"📊"},
                ].map(s=>(
                  <div key={s.label} style={{...card,padding:"18px 20px"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                    <div style={{fontSize:19,fontWeight:800,color:"#1E3A5F"}}>{s.value}</div>
                    <div style={{color:"#94A3B8",fontSize:12,marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{...card,padding:24,marginBottom:20}}>
                <div style={{fontWeight:700,fontSize:15,color:"#1E293B",marginBottom:20}}>Monthly Spending</div>
                {monthlyData.length===0&&<div style={{color:"#94A3B8",textAlign:"center",padding:40}}>No data yet.</div>}
                {monthlyData.map((m,i)=>(
                  <div key={i} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <div>
                        <span style={{fontWeight:700,color:"#1E293B",fontSize:14}}>{m.month} {m.year}</span>
                        <span style={{marginLeft:10,fontSize:12,color:"#94A3B8"}}>{m.count} PO{m.count!==1?"s":""} · {m.items} items</span>
                      </div>
                      <span style={{fontWeight:700,color:"#1E3A5F",fontSize:14}}>{fmt(m.total)}</span>
                    </div>
                    <div style={{background:"#F1F5F9",borderRadius:100,height:10,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:100,background:"linear-gradient(90deg,#1E3A5F,#60A5FA)",width:`${Math.max(2,m.total/maxMonthly*100)}%`,transition:"width 0.5s ease"}}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{...card,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{background:"#1E3A5F"}}>
                    {["Month","Year","POs","Line Items","Total Cost"].map(h=>(
                      <th key={h} style={{padding:"12px 18px",color:"#fff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.4px",textAlign:"left"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {monthlyData.map((m,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"#fff":"#FAFBFC"}}>
                        <td style={{padding:"12px 18px",fontWeight:600,color:"#334155"}}>{m.month}</td>
                        <td style={{padding:"12px 18px",color:"#64748B"}}>{m.year}</td>
                        <td style={{padding:"12px 18px",color:"#334155"}}>{m.count}</td>
                        <td style={{padding:"12px 18px",color:"#334155"}}>{m.items}</td>
                        <td style={{padding:"12px 18px",fontWeight:700,color:"#0F5132"}}>{fmt(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{background:"#F0F4F8",borderTop:"2px solid #E2E8F0"}}>
                    <td colSpan={2} style={{padding:"12px 18px",fontWeight:700,color:"#1E3A5F"}}>Grand Total</td>
                    <td style={{padding:"12px 18px",fontWeight:700,color:"#1E3A5F"}}>{pos.length}</td>
                    <td style={{padding:"12px 18px",fontWeight:700,color:"#1E3A5F"}}>{pos.reduce((s,p)=>s+(p.items||[]).length,0)}</td>
                    <td style={{padding:"12px 18px",fontWeight:800,color:"#1E3A5F",fontSize:14}}>{fmt(grandTotal)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ══ BY MACHINE ══ */}
          {view==="machines" && (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:24}}>
                {machineData.map(m=>{
                  const c=MC[m.machine],pct=grandTotal?((m.total/grandTotal)*100).toFixed(1):0;
                  return (
                    <div key={m.machine} style={{...card,padding:"20px 22px",border:`2px solid ${c.dot}33`}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <div style={{width:38,height:38,borderRadius:10,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{width:14,height:14,borderRadius:"50%",background:c.dot,display:"inline-block"}}></span>
                        </div>
                        <div>
                          <div style={{fontWeight:700,color:c.text,fontSize:14}}>{m.machine}</div>
                          <div style={{color:"#94A3B8",fontSize:11}}>{m.count} POs · {m.items} items</div>
                        </div>
                      </div>
                      <div style={{fontWeight:800,fontSize:22,color:"#1E293B",marginBottom:6}}>{fmt(m.total)}</div>
                      <div style={{background:"#F1F5F9",borderRadius:100,height:7,overflow:"hidden",marginBottom:5}}>
                        <div style={{height:"100%",borderRadius:100,background:c.dot,width:`${pct}%`,transition:"width 0.5s"}}></div>
                      </div>
                      <div style={{color:"#94A3B8",fontSize:11}}>{pct}% of total spend</div>
                    </div>
                  );
                })}
              </div>
              <div style={{...card,overflow:"hidden"}}>
                <div style={{padding:"16px 22px",borderBottom:"1px solid #F1F5F9",fontWeight:700,fontSize:14,color:"#1E293B"}}>Cost per Machine per Month</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead><tr style={{background:"#F8FAFC"}}>
                      <th style={{padding:"10px 18px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:11,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0",position:"sticky",left:0,background:"#F8FAFC",zIndex:1}}>Machine</th>
                      {monthlyData.map(m=>(
                        <th key={`${m.month}-${m.year}`} style={{padding:"10px 12px",textAlign:"center",fontWeight:700,color:"#475569",fontSize:11,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0",whiteSpace:"nowrap"}}>{m.month.slice(0,3)} {m.year}</th>
                      ))}
                      <th style={{padding:"10px 12px",textAlign:"center",fontWeight:700,color:"#1E3A5F",fontSize:11,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0",background:"#EFF6FF"}}>Total</th>
                    </tr></thead>
                    <tbody>
                      {machineData.map((m,ri)=>{
                        const c=MC[m.machine];
                        return (
                          <tr key={m.machine} style={{borderBottom:"1px solid #F1F5F9"}}>
                            <td style={{padding:"12px 18px",position:"sticky",left:0,background:ri%2===0?"#fff":"#FAFBFC",zIndex:1}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:8,fontWeight:700,color:c.text}}>
                                <span style={{width:9,height:9,borderRadius:"50%",background:c.dot,display:"inline-block"}}></span>{m.machine}
                              </span>
                            </td>
                            {monthlyData.map(md=>{
                              const val=m.byMonth[md.month]||0;
                              return <td key={`${md.month}-${md.year}`} style={{padding:"12px 12px",textAlign:"center",color:val?c.text:"#CBD5E1",fontWeight:val?600:400}}>{val?fmt(val):"—"}</td>;
                            })}
                            <td style={{padding:"12px 12px",textAlign:"center",fontWeight:800,color:"#1E3A5F",background:"#EFF6FF"}}>{fmt(m.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr style={{background:"#1E3A5F"}}>
                      <td style={{padding:"12px 18px",fontWeight:700,color:"#fff",position:"sticky",left:0,background:"#1E3A5F",zIndex:1}}>Grand Total</td>
                      {monthlyData.map(md=>{
                        const t=pos.filter(p=>getMY(p.date).month===md.month).reduce((s,p)=>s+(Number(p.total)||0),0);
                        return <td key={`${md.month}-${md.year}`} style={{padding:"12px 12px",textAlign:"center",fontWeight:700,color:"#93C5FD"}}>{fmt(t)}</td>;
                      })}
                      <td style={{padding:"12px 12px",textAlign:"center",fontWeight:800,color:"#fff",fontSize:14}}>{fmt(grandTotal)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
