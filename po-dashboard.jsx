import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────
   DESIGN SYSTEM  — Mineral Cartography (Minimal)
   BG:    #080c14   Off:   #0b1018
   Amber: #f59e0b   Dim:   #2a1800
   White: #e6e3de   Muted: #3a4a5a
   ───────────────────────────────────────────── */

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #080c14;
    --off:     #0b1018;
    --border:  #111820;
    --border2: #1a2535;
    --amber:   #f59e0b;
    --amber-d: #2a1800;
    --amber-g: #150d00;
    --white:   #e6e3de;
    --muted:   #3a4a5a;
    --dim:     #1c2838;
    --green:   #10b981;
    --red:     #ef4444;
    --blue:    #3b82f6;
    --font-mono: 'IBM Plex Mono', monospace;
    --font-sans: 'Instrument Sans', sans-serif;
  }

  html, body, #root { height: 100%; }

  body {
    background: var(--bg);
    color: var(--white);
    font-family: var(--font-sans);
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  /* scrollbar */
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* layout */
  .shell { display: flex; height: 100vh; }

  /* sidebar */
  .sidebar {
    width: 200px; flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    background: var(--off);
    position: relative; z-index: 10;
  }
  .sidebar-logo {
    padding: 28px 24px 24px;
    border-bottom: 1px solid var(--border);
  }
  .logo-mark {
    display: flex; align-items: center; gap: 9px; margin-bottom: 4px;
  }
  .logo-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--amber); flex-shrink: 0;
  }
  .logo-text {
    font-family: var(--font-mono);
    font-size: 11px; font-weight: 500;
    color: var(--amber); letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .logo-sub {
    font-family: var(--font-mono);
    font-size: 10px; color: var(--muted);
    padding-left: 15px; letter-spacing: 0.04em;
  }
  .nav { flex: 1; padding: 16px 0; }
  .nav-section {
    padding: 0 18px; margin-bottom: 4px;
    font-family: var(--font-mono); font-size: 9px;
    color: var(--muted); letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 18px; cursor: pointer;
    font-size: 12px; color: var(--muted);
    transition: color 0.15s;
    position: relative; user-select: none;
    border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { color: var(--white); }
  .nav-item.active { color: var(--white); }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 50%;
    transform: translateY(-50%);
    width: 2px; height: 14px; background: var(--amber);
    border-radius: 0 2px 2px 0;
  }
  .nav-icon { width: 14px; height: 14px; opacity: 0.6; flex-shrink: 0; }
  .nav-item.active .nav-icon { opacity: 1; }

  .sidebar-footer {
    padding: 16px 18px;
    border-top: 1px solid var(--border);
  }
  .role-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--amber-g); border: 1px solid var(--amber-d);
    color: var(--amber); padding: 4px 10px; border-radius: 2px;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase;
    margin-bottom: 10px;
  }
  .signout-btn {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--muted); background: none; border: none;
    cursor: pointer; padding: 0; letter-spacing: 0.06em;
    transition: color 0.15s;
  }
  .signout-btn:hover { color: var(--red); }

  /* main */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

  /* topbar */
  .topbar {
    height: 48px; flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
    padding: 0 28px; gap: 16px;
  }
  .topbar-title {
    font-family: var(--font-mono); font-size: 11px;
    color: var(--muted); letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .topbar-sep { width: 1px; height: 14px; background: var(--border2); }
  .topbar-date {
    font-family: var(--font-mono); font-size: 10px; color: var(--muted);
  }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .search-box {
    display: flex; align-items: center; gap: 8px;
    border: 1px solid var(--border2); border-radius: 2px;
    padding: 5px 10px; background: var(--off);
    transition: border-color 0.15s;
  }
  .search-box:focus-within { border-color: var(--amber); }
  .search-box input {
    background: none; border: none; outline: none;
    font-family: var(--font-mono); font-size: 11px;
    color: var(--white); width: 160px;
  }
  .search-box input::placeholder { color: var(--muted); }

  /* content */
  .content { flex: 1; overflow-y: auto; padding: 28px; }

  /* stat row */
  .stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; margin-bottom: 28px; border: 1px solid var(--border); }
  .stat-cell {
    padding: 22px 24px; background: var(--off);
    position: relative; overflow: hidden;
  }
  .stat-cell::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 1px; background: transparent; transition: background 0.2s;
  }
  .stat-cell:hover::after { background: var(--amber); }
  .stat-label {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--muted); letter-spacing: 0.14em;
    text-transform: uppercase; margin-bottom: 12px;
  }
  .stat-value {
    font-family: var(--font-mono); font-size: 28px; font-weight: 500;
    line-height: 1; margin-bottom: 6px;
  }
  .stat-sub {
    font-family: var(--font-mono); font-size: 10px; color: var(--muted);
  }

  /* section header */
  .section-head {
    display: flex; align-items: baseline; gap: 14px; margin-bottom: 12px;
  }
  .section-title {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase;
  }
  .section-rule { flex: 1; height: 1px; background: var(--border); }
  .section-count {
    font-family: var(--font-mono); font-size: 10px; color: var(--muted);
  }

  /* table */
  .tbl-wrap { border: 1px solid var(--border); overflow: hidden; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: var(--off); border-bottom: 1px solid var(--border); }
  th {
    padding: 9px 16px; text-align: left;
    font-family: var(--font-mono); font-size: 9px;
    color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 400;
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.1s;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--off); }
  td { padding: 12px 16px; }
  .td-mono { font-family: var(--font-mono); font-size: 11px; }
  .td-amber { color: var(--amber); }
  .td-muted { color: var(--muted); }
  .td-white { color: var(--white); }

  /* status */
  .status {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-mono); font-size: 9px;
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; }

  /* pill */
  .pill {
    font-family: var(--font-mono); font-size: 9px;
    padding: 3px 8px; border-radius: 2px;
    letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* detail panel */
  .detail-back {
    display: flex; align-items: center; gap: 8px; margin-bottom: 20px;
    background: none; border: none; cursor: pointer;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--muted); letter-spacing: 0.08em; padding: 0;
    transition: color 0.15s;
  }
  .detail-back:hover { color: var(--white); }
  .detail-card {
    border: 1px solid var(--border); max-width: 540px;
  }
  .detail-head {
    padding: 22px 24px; border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .detail-num {
    font-family: var(--font-mono); font-size: 16px;
    color: var(--amber); letter-spacing: 0.04em;
  }
  .detail-vendor { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .detail-body { padding: 24px; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border: 1px solid var(--border); margin-bottom: 24px; }
  .field-cell { padding: 14px 16px; background: var(--off); }
  .field-label {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--muted); letter-spacing: 0.12em;
    text-transform: uppercase; margin-bottom: 6px;
  }
  .field-val {
    font-family: var(--font-mono); font-size: 13px; color: var(--white);
  }
  .amt-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 11px 0; border-bottom: 1px solid var(--border);
  }
  .amt-row:last-child { border-bottom: none; }
  .amt-label { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
  .amt-val { font-family: var(--font-mono); font-size: 13px; color: var(--white); }
  .amt-total .amt-label { color: var(--white); font-weight: 500; }
  .amt-total .amt-val { color: var(--amber); font-size: 15px; }

  /* upload */
  .upload-zone {
    border: 1px dashed var(--border2); padding: 48px 24px;
    text-align: center; cursor: pointer; transition: border-color 0.2s;
    max-width: 440px; margin-bottom: 16px;
  }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--amber); }
  .upload-dot {
    width: 40px; height: 40px; border: 1px solid var(--border2);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px; transition: border-color 0.2s;
  }
  .upload-zone:hover .upload-dot, .upload-zone.drag .upload-dot { border-color: var(--amber); }
  .upload-title { font-family: var(--font-mono); font-size: 12px; color: var(--white); margin-bottom: 4px; }
  .upload-sub { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }

  /* processing steps */
  .proc-wrap { border: 1px solid var(--border); max-width: 440px; }
  .proc-head { padding: 14px 20px; border-bottom: 1px solid var(--border); }
  .proc-head-title { font-family: var(--font-mono); font-size: 10px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
  .proc-body { padding: 20px; }
  .proc-step { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .proc-step:last-child { margin-bottom: 0; }
  .proc-ind { width: 20px; height: 20px; border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .proc-ind.done { border-color: var(--green); background: rgba(16,185,129,0.05); }
  .proc-ind.active { border-color: var(--amber); background: rgba(245,158,11,0.05); }
  .proc-step-txt { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
  .proc-step-txt.active { color: var(--white); }

  /* success */
  .success-card { border: 1px solid var(--border); max-width: 440px; }
  .success-head { padding: 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .success-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
  .success-title { font-family: var(--font-mono); font-size: 11px; color: var(--white); letter-spacing: 0.06em; }
  .success-body { padding: 20px; }
  .success-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); }
  .success-row:last-child { border-bottom: none; }
  .success-key { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
  .success-val { font-family: var(--font-mono); font-size: 10px; color: var(--white); }
  .success-actions { display: flex; gap: 8px; margin-top: 16px; }
  .btn-ghost {
    flex: 1; padding: 9px; border: 1px solid var(--border2);
    background: none; color: var(--muted); cursor: pointer;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: all 0.15s;
  }
  .btn-ghost:hover { border-color: var(--white); color: var(--white); }
  .btn-amber {
    flex: 1; padding: 9px; border: 1px solid var(--amber);
    background: none; color: var(--amber); cursor: pointer;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: all 0.15s;
  }
  .btn-amber:hover { background: var(--amber); color: var(--bg); }

  /* vendor */
  .vendor-list { border: 1px solid var(--border); max-width: 680px; }
  .vendor-row {
    display: flex; align-items: center; padding: 14px 20px;
    border-bottom: 1px solid var(--border); gap: 16px;
    transition: background 0.1s;
  }
  .vendor-row:last-child { border-bottom: none; }
  .vendor-row:hover { background: var(--off); }
  .vendor-name { font-size: 13px; color: var(--white); flex: 1; }
  .vendor-gst { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
  .vendor-count { font-family: var(--font-mono); font-size: 12px; color: var(--muted); width: 48px; text-align: right; }

  /* template mapper */
  .mapper-card { border: 1px solid var(--border); max-width: 560px; }
  .mapper-head { padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .mapper-title { font-family: var(--font-mono); font-size: 10px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
  .mapper-vendor { font-size: 13px; color: var(--white); margin-top: 4px; }
  .mapper-body { padding: 20px; }
  .map-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .map-canonical {
    flex: 1; padding: 9px 12px; background: var(--off);
    border: 1px solid var(--border);
    font-family: var(--font-mono); font-size: 10px; color: var(--muted);
    letter-spacing: 0.06em;
  }
  .map-arrow { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
  .map-select {
    flex: 1; padding: 9px 12px; background: var(--off);
    border: 1px solid var(--border2); color: var(--white);
    font-family: var(--font-mono); font-size: 11px; cursor: pointer;
    transition: border-color 0.15s; outline: none; appearance: none;
  }
  .map-select:focus { border-color: var(--amber); }
  .map-select.mapped { border-color: var(--amber); color: var(--amber); }
  .mapper-foot { padding: 16px 20px; border-top: 1px solid var(--border); }

  /* users */
  .user-table-wrap { border: 1px solid var(--border); max-width: 640px; }

  /* login */
  .login-wrap {
    min-height: 100vh; display: flex;
    align-items: center; justify-content: center;
  }
  .login-box { width: 320px; }
  .login-logo { margin-bottom: 36px; }
  .login-mark { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .login-name { font-family: var(--font-mono); font-size: 13px; color: var(--white); letter-spacing: 0.08em; }
  .login-tagline { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
  .login-label { font-family: var(--font-mono); font-size: 9px; color: var(--muted); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 10px; }
  .login-roles { display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--border); }
  .login-role-btn {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px; background: none; border: none; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.15s; text-align: left;
  }
  .login-role-btn:last-child { border-bottom: none; }
  .login-role-btn:hover { background: var(--off); }
  .login-role-name { font-family: var(--font-mono); font-size: 11px; color: var(--white); text-transform: uppercase; letter-spacing: 0.1em; }
  .login-role-desc { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }

  /* mini chart bars */
  .chart-row { display: flex; align-items: flex-end; gap: 3px; height: 36px; }
  .chart-bar { flex: 1; background: var(--dim); position: relative; }
  .chart-bar-fill { position: absolute; bottom: 0; left: 0; right: 0; background: var(--amber); opacity: 0.6; transition: height 0.5s ease; }

  /* filter row */
  .filter-row { display: flex; gap: 6px; margin-bottom: 12px; align-items: center; }
  .filter-btn {
    font-family: var(--font-mono); font-size: 10px;
    padding: 5px 12px; border: 1px solid var(--border);
    background: none; color: var(--muted); cursor: pointer;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: all 0.15s; border-radius: 0;
  }
  .filter-btn:hover { color: var(--white); border-color: var(--border2); }
  .filter-btn.active { color: var(--amber); border-color: var(--amber); }
  .filter-right { margin-left: auto; }
  .export-btn {
    font-family: var(--font-mono); font-size: 10px;
    padding: 5px 12px; border: 1px solid var(--border2);
    background: none; color: var(--muted); cursor: pointer;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: all 0.15s;
  }
  .export-btn:hover { color: var(--amber); border-color: var(--amber); }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1.2s linear infinite; }
  @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .fade-in { animation: fade-in 0.3s ease forwards; }
`;

/* ─── DATA ─── */
const INVOICES = [
  { id:'I01', number:'TK/2024/1847',   vendor:'Tata Steel Ltd',       gst:'27AAACT2727Q1ZW', date:'15 Jan 2024', bg:245000, ag:289100, gst_pct:18, status:'processed', tmpl:true  },
  { id:'I02', number:'ULT/INV/0392',   vendor:'UltraTech Cement',     gst:'27AABCU9603R1ZP', date:'18 Jan 2024', bg:182500, ag:215350, gst_pct:18, status:'processed', tmpl:true  },
  { id:'I03', number:'JSW/2024/456',   vendor:'JSW Steel Ltd',         gst:'27AABCJ4849H1ZA', date:'22 Jan 2024', bg:318000, ag:375240, gst_pct:18, status:'review',    tmpl:false },
  { id:'I04', number:'ACC/01/2024/89', vendor:'ACC Ltd',               gst:'27AAACC8875D1Z5', date:'25 Jan 2024', bg:94500,  ag:111510, gst_pct:18, status:'processed', tmpl:true  },
  { id:'I05', number:'LNT/MH/24/12',  vendor:'L&T Construction',      gst:'27AAACL0582H1ZO', date:'28 Jan 2024', bg:520000, ag:613600, gst_pct:18, status:'processed', tmpl:true  },
  { id:'I06', number:'AMB/2024/778',   vendor:'Ambuja Cements',        gst:'27AAACA2641G1ZT', date:'02 Feb 2024', bg:156000, ag:184080, gst_pct:18, status:'processing',tmpl:true  },
  { id:'I07', number:'PIX/INV/24/45',  vendor:'Pidilite Industries',   gst:'27AAACP3844Q1ZQ', date:'05 Feb 2024', bg:43200,  ag:51216,  gst_pct:18, status:'review',    tmpl:false },
  { id:'I08', number:'TK/2024/1923',   vendor:'Tata Steel Ltd',        gst:'27AAACT2727Q1ZW', date:'08 Feb 2024', bg:198000, ag:233640, gst_pct:18, status:'processed', tmpl:true  },
  { id:'I09', number:'GRZ/24/INV/12',  vendor:'Groz-Beckert India',    gst:'27AABCG1234H1Z2', date:'10 Feb 2024', bg:28500,  ag:33630,  gst_pct:18, status:'processed', tmpl:false },
  { id:'I10', number:'ULT/INV/0441',   vendor:'UltraTech Cement',      gst:'27AABCU9603R1ZP', date:'12 Feb 2024', bg:210000, ag:247800, gst_pct:18, status:'processing',tmpl:true  },
];

const VENDORS = [
  { id:'V1', name:'Tata Steel Ltd',      gst:'27AAACT2727Q1ZW', count:24, tmpl:true  },
  { id:'V2', name:'UltraTech Cement',    gst:'27AABCU9603R1ZP', count:18, tmpl:true  },
  { id:'V3', name:'JSW Steel Ltd',        gst:'27AABCJ4849H1ZA', count:8,  tmpl:false },
  { id:'V4', name:'ACC Ltd',              gst:'27AAACC8875D1Z5', count:12, tmpl:true  },
  { id:'V5', name:'L&T Construction',    gst:'27AAACL0582H1ZO', count:31, tmpl:true  },
  { id:'V6', name:'Ambuja Cements',       gst:'27AAACA2641G1ZT', count:9,  tmpl:true  },
  { id:'V7', name:'Pidilite Industries',  gst:'27AAACP3844Q1ZQ', count:3,  tmpl:false },
];

const USERS = [
  { id:'U1', name:'Rajesh Sharma', email:'rajesh@buildco.in',  role:'admin'      },
  { id:'U2', name:'Priya Patel',   email:'priya@buildco.in',   role:'accountant' },
  { id:'U3', name:'Anil Kumar',    email:'anil@buildco.in',    role:'accountant' },
  { id:'U4', name:'Sunita Rao',    email:'sunita@buildco.in',  role:'viewer'     },
  { id:'U5', name:'Deepak Verma',  email:'deepak@buildco.in',  role:'viewer'     },
];

const BARS = [32,48,61,45,78,55,90,67,83,72,95,88];

const OCR_OPTS = ['—','Bill Date','Invoice Date','Dt.','Ref No.','Inv No.','Bill No.',
  'Party Name','Buyer','Bill To','Taxable Amt','Net Amount','Basic Value',
  'Total Payable','Grand Total','Invoice Total'];

const CANONICAL = [
  { key:'invoice_date',      label:'INVOICE DATE'      },
  { key:'invoice_number',    label:'INVOICE NUMBER'    },
  { key:'client_name',       label:'CLIENT NAME'       },
  { key:'amount_before_gst', label:'AMOUNT BEFORE GST' },
  { key:'amount_after_gst',  label:'AMOUNT AFTER GST'  },
];

const NAV_ITEMS = [
  { id:'dashboard', label:'Dashboard',     roles:['admin','accountant','viewer'] },
  { id:'invoices',  label:'Invoices',       roles:['admin','accountant','viewer'] },
  { id:'upload',    label:'Upload',         roles:['admin','accountant']          },
  { id:'vendors',   label:'Vendors',        roles:['admin','accountant']          },
  { id:'users',     label:'Users',          roles:['admin']                       },
];

/* ─── UTILS ─── */
const fmt = n => '₹' + new Intl.NumberFormat('en-IN').format(n);

function StatusBadge({ s }) {
  const map = { processed:['#10b981','PROCESSED'], processing:['#f59e0b','PROCESSING'], review:['#ef4444','REVIEW'] };
  const [col, label] = map[s] || ['#3a4a5a', s];
  return (
    <span className="status">
      <span className="status-dot" style={{ background: col }} />
      <span style={{ color: col, fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:'0.1em' }}>{label}</span>
    </span>
  );
}

function RoleBadge({ r }) {
  const col = { admin:'#ef4444', accountant:'#3b82f6', viewer:'#10b981' }[r] || '#3a4a5a';
  return <span className="pill" style={{ color: col, border:`1px solid ${col}22`, background:`${col}0d` }}>{r}</span>;
}

/* ─── SVG ICONS ─── */
const Icon = ({ name, size=14, color='currentColor' }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    invoices:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    upload:    <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    vendors:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    search:    <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    arrow_l:   <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    check:     <polyline points="20 6 9 11 4 13"/>,
    spin:      <><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></>,
    upload_ic: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

/* ─── LOGIN ─── */
function Login({ onLogin }) {
  const roles = [
    { r:'admin',      d:'Full access · Manage users'  },
    { r:'accountant', d:'Upload · Map fields · Edit'   },
    { r:'viewer',     d:'View · Export only'            },
  ];
  return (
    <div className="login-wrap fade-in">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-mark">
            <div className="logo-dot" />
            <span className="login-name">PO AUTOMATION</span>
          </div>
          <div className="login-tagline">BuildCo Infra Pvt. Ltd. · Invoice System</div>
        </div>
        <div className="login-label">Select role</div>
        <div className="login-roles">
          {roles.map(({ r, d }) => (
            <button key={r} className="login-role-btn" onClick={() => onLogin(r)}>
              <span className="login-role-name">{r}</span>
              <span className="login-role-desc">{d}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── DASHBOARD PAGE ─── */
function Dashboard({ setPage }) {
  const total = INVOICES.reduce((s, i) => s + i.ag, 0);
  const proc  = INVOICES.filter(i => i.status === 'processed').length;
  const rev   = INVOICES.filter(i => i.status === 'review').length;

  const stats = [
    { label:'Total invoices',  value: INVOICES.length, sub:'Feb 2024',                            col:'var(--white)' },
    { label:'Processed',       value: proc,             sub:`${Math.round(proc/INVOICES.length*100)}% auto-extracted`, col:'#10b981' },
    { label:'Needs review',    value: rev,              sub:'Pending manual map',                  col:'#ef4444'     },
    { label:'Total value',     value: fmt(total),       sub:'Incl. GST · Feb 2024',               col:'var(--amber)' },
  ];

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="stat-row">
        {stats.map(({ label, value, sub, col }) => (
          <div key={label} className="stat-cell">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color: col }}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Mini trend */}
      <div className="section-head">
        <span className="section-title">Volume · Feb 2024</span>
        <div className="section-rule" />
        <span className="section-count">{INVOICES.length} invoices</span>
      </div>
      <div style={{ border:'1px solid var(--border)', padding:'16px 20px', marginBottom:28, maxWidth:400 }}>
        <div className="chart-row">
          {BARS.map((h, i) => (
            <div key={i} className="chart-bar">
              <div className="chart-bar-fill" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--muted)' }}>Feb 1</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--muted)' }}>Feb 12</span>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="section-head">
        <span className="section-title">Recent invoices</span>
        <div className="section-rule" />
        <button onClick={() => setPage('invoices')}
          style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' }}>
          View all →
        </button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {['Invoice no.','Vendor','Date','After GST','Status'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {INVOICES.slice(0, 5).map(inv => (
              <tr key={inv.id}>
                <td className="td-mono td-amber">{inv.number}</td>
                <td className="td-white" style={{ fontSize:12 }}>{inv.vendor}</td>
                <td className="td-mono td-muted">{inv.date}</td>
                <td className="td-mono td-white">{fmt(inv.ag)}</td>
                <td><StatusBadge s={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── INVOICES PAGE ─── */
function InvoicesPage() {
  const [q, setQ]     = useState('');
  const [sf, setSf]   = useState('all');
  const [sel, setSel] = useState(null);

  const list = INVOICES.filter(i => {
    const mq = !q || i.number.toLowerCase().includes(q.toLowerCase()) || i.vendor.toLowerCase().includes(q.toLowerCase());
    const ms = sf === 'all' || i.status === sf;
    return mq && ms;
  });

  if (sel) return <InvoiceDetail inv={sel} onBack={() => setSel(null)} />;

  return (
    <div className="fade-in">
      <div className="filter-row">
        {['all','processed','processing','review'].map(f => (
          <button key={f} className={`filter-btn ${sf===f?'active':''}`} onClick={() => setSf(f)}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <div className="filter-right">
          <div className="search-box">
            <Icon name="search" size={12} color="var(--muted)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoices…" />
          </div>
        </div>
        <button className="export-btn">Export CSV</button>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {['#','Invoice no.','Vendor','Date','Before GST','After GST','Status'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((inv, i) => (
              <tr key={inv.id} onClick={() => setSel(inv)}>
                <td className="td-mono td-muted" style={{ width:32 }}>{String(i+1).padStart(2,'0')}</td>
                <td className="td-mono td-amber">{inv.number}</td>
                <td className="td-white" style={{ fontSize:12 }}>{inv.vendor}</td>
                <td className="td-mono td-muted">{inv.date}</td>
                <td className="td-mono td-muted">{fmt(inv.bg)}</td>
                <td className="td-mono td-white">{fmt(inv.ag)}</td>
                <td><StatusBadge s={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div style={{ padding:'32px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--muted)' }}>
            No invoices found
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── INVOICE DETAIL ─── */
function InvoiceDetail({ inv, onBack }) {
  const gst_amt = inv.ag - inv.bg;
  return (
    <div className="fade-in">
      <button className="detail-back" onClick={onBack}>
        <Icon name="arrow_l" size={12} /> Back
      </button>
      <div className="detail-card">
        <div className="detail-head">
          <div>
            <div className="detail-num">{inv.number}</div>
            <div className="detail-vendor">{inv.vendor}</div>
          </div>
          <StatusBadge s={inv.status} />
        </div>
        <div className="detail-body">
          <div className="field-grid">
            {[
              ['INVOICE DATE',   inv.date],
              ['INVOICE NUMBER', inv.number],
              ['CLIENT NAME',    inv.vendor],
              ['GST NUMBER',     inv.gst],
            ].map(([label, val]) => (
              <div key={label} className="field-cell">
                <div className="field-label">{label}</div>
                <div className="field-val">{val}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>
              Extracted amounts
            </div>
            {[
              ['Before GST',         fmt(inv.bg),   false],
              [`GST (${inv.gst_pct}%)`, fmt(gst_amt), true ],
            ].map(([label, val, dim]) => (
              <div key={label} className="amt-row">
                <span className="amt-label" style={{ color: dim ? 'var(--muted)' : undefined }}>{label}</span>
                <span className="amt-val"   style={{ color: dim ? 'var(--muted)' : undefined }}>{val}</span>
              </div>
            ))}
            <div className="amt-row amt-total">
              <span className="amt-label">After GST</span>
              <span className="amt-val" style={{ color:'var(--amber)', fontWeight:500 }}>{fmt(inv.ag)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── UPLOAD PAGE ─── */
function UploadPage({ setPage }) {
  const [stage, setStage] = useState('idle');
  const [step,  setStep]  = useState(0);
  const [fname, setFname] = useState('');
  const [drag,  setDrag]  = useState(false);
  const ref = useRef(null);

  const STEPS = ['Reading PDF','Running PaddleOCR','Detecting vendor','Matching template','Extracting fields'];

  const run = name => {
    setFname(name); setStage('processing'); setStep(0);
    let s = 0;
    const t = setInterval(() => { s++; setStep(s); if (s >= STEPS.length) { clearInterval(t); setTimeout(() => setStage('done'), 600); }}, 900);
  };

  const pick = f => { if (f?.type === 'application/pdf') run(f.name); };

  if (stage === 'done') return (
    <div className="fade-in">
      <div className="success-card">
        <div className="success-head">
          <div className="success-dot" />
          <span className="success-title">EXTRACTION COMPLETE</span>
        </div>
        <div className="success-body">
          {[
            ['INVOICE DATE',      '15 Feb 2024'],
            ['INVOICE NUMBER',    'TK/2024/2001'],
            ['CLIENT NAME',       'Tata Steel Ltd'],
            ['AMOUNT BEFORE GST', '₹2,45,000'],
            ['AMOUNT AFTER GST',  '₹2,89,100'],
          ].map(([k, v]) => (
            <div key={k} className="success-row">
              <span className="success-key">{k}</span>
              <span className="success-val">{v}</span>
            </div>
          ))}
          <div className="success-actions">
            <button className="btn-ghost" onClick={() => { setStage('idle'); setFname(''); }}>Upload another</button>
            <button className="btn-amber" onClick={() => setPage('invoices')}>View in invoices</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (stage === 'processing') return (
    <div className="fade-in">
      <div className="proc-wrap">
        <div className="proc-head">
          <div className="proc-head-title">Processing · {fname}</div>
        </div>
        <div className="proc-body">
          {STEPS.map((s, i) => (
            <div key={s} className="proc-step">
              <div className={`proc-ind ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                {i < step
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 13 4 11"/></svg>
                  : i === step
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" className="spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                  : <div style={{ width:4, height:4, background:'var(--muted)', borderRadius:'50%' }} />
                }
              </div>
              <span className={`proc-step-txt ${i <= step ? 'active' : ''}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div
        className={`upload-zone${drag ? ' drag' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}
      >
        <div className="upload-dot">
          <Icon name="upload_ic" size={16} color="var(--muted)" />
        </div>
        <div className="upload-title">Drop invoice PDF here</div>
        <div className="upload-sub" style={{ marginTop:4 }}>or click to browse</div>
        <input ref={ref} type="file" accept=".pdf" style={{ display:'none' }} onChange={e => pick(e.target.files[0])} />
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', lineHeight:1.7, maxWidth:440 }}>
        PaddleOCR extracts text → vendor matched via GST number → saved template applied → 5 fields extracted. New vendors flagged for one-time mapping.
      </div>
    </div>
  );
}

/* ─── VENDORS PAGE ─── */
function VendorsPage({ setPage, setVendor }) {
  return (
    <div className="fade-in">
      <div className="section-head" style={{ marginBottom:12 }}>
        <span className="section-title">All vendors</span>
        <div className="section-rule" />
        <span className="section-count">{VENDORS.filter(v=>v.tmpl).length}/{VENDORS.length} with templates</span>
      </div>
      <div className="vendor-list">
        {VENDORS.map(v => (
          <div key={v.id} className="vendor-row">
            <div style={{ flex:1 }}>
              <div className="vendor-name">{v.name}</div>
              <div className="vendor-gst">{v.gst}</div>
            </div>
            <div className="vendor-count">{v.count}</div>
            {v.tmpl
              ? <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#10b981', letterSpacing:'0.1em' }}>MAPPED</span>
              : <button className="btn-amber" style={{ padding:'4px 12px', fontSize:9 }}
                  onClick={() => { setVendor(v); setPage('template'); }}>
                  MAP →
                </button>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TEMPLATE MAPPER ─── */
function TemplatePage({ vendor, setPage }) {
  const [map, setMap] = useState({ invoice_date:'', invoice_number:'', client_name:'', amount_before_gst:'', amount_after_gst:'' });
  const [saved, setSaved] = useState(false);
  const done = Object.values(map).every(v => v && v !== '—');

  if (saved) return (
    <div className="fade-in">
      <div style={{ border:'1px solid var(--border)', maxWidth:440, padding:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--white)', letterSpacing:'0.06em' }}>TEMPLATE SAVED</span>
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--muted)', lineHeight:1.7, marginBottom:20 }}>
          Future invoices from <span style={{ color:'var(--white)' }}>{vendor?.name}</span> will be extracted automatically.
        </div>
        <button className="btn-amber" style={{ width:'100%', padding:'10px 0' }} onClick={() => setPage('vendors')}>Back to vendors</button>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <button className="detail-back" onClick={() => setPage('vendors')}>
        <Icon name="arrow_l" size={12} /> Back
      </button>
      <div className="mapper-card">
        <div className="mapper-head">
          <div className="mapper-title">Field mapping — one time only</div>
          <div className="mapper-vendor">{vendor?.name}</div>
        </div>
        <div className="mapper-body">
          {CANONICAL.map(({ key, label }) => (
            <div key={key} className="map-row">
              <div className="map-canonical">{label}</div>
              <span className="map-arrow">→</span>
              <select
                value={map[key]}
                onChange={e => setMap(m => ({ ...m, [key]: e.target.value }))}
                className={`map-select${map[key] && map[key] !== '—' ? ' mapped' : ''}`}
              >
                {OCR_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mapper-foot">
          <button
            className={done ? 'btn-amber' : 'btn-ghost'}
            disabled={!done}
            style={{ width:'100%', padding:'10px 0', cursor: done ? 'pointer' : 'not-allowed' }}
            onClick={() => setSaved(true)}
          >
            {done ? 'Save template' : `${Object.values(map).filter(v=>v&&v!=='—').length} / ${CANONICAL.length} mapped`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── USERS PAGE ─── */
function UsersPage() {
  return (
    <div className="fade-in">
      <div className="user-table-wrap">
        <table>
          <thead>
            <tr>{['User','Email','Role'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {USERS.map(u => (
              <tr key={u.id}>
                <td className="td-white" style={{ fontSize:12 }}>{u.name}</td>
                <td className="td-mono td-muted">{u.email}</td>
                <td><RoleBadge r={u.role} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── APP ─── */
export default function App() {
  const [role,   setRole]   = useState(null);
  const [page,   setPage]   = useState('dashboard');
  const [vendor, setVendor] = useState(null);
  const [q,      setQ]      = useState('');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  if (!role) return <Login onLogin={r => { setRole(r); setPage('dashboard'); }} />;

  const navItems = NAV_ITEMS.filter(n => n.roles.includes(role));
  const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-dot" />
            <span className="logo-text">PO · AUTO</span>
          </div>
          <div className="logo-sub">BuildCo Infra</div>
        </div>

        <nav className="nav">
          <div style={{ height:8 }} />
          {navItems.map(({ id, label }) => (
            <button key={id} className={`nav-item${page===id||page==='template'&&id==='vendors'?'  active':''}`}
              onClick={() => setPage(id)}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {id==='dashboard' && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>}
                {id==='invoices'  && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>}
                {id==='upload'    && <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>}
                {id==='vendors'   && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
                {id==='users'     && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
              </svg>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="role-badge">
            <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--amber)' }} />
            {role}
          </div>
          <br />
          <button className="signout-btn" onClick={() => { setRole(null); setPage('dashboard'); }}>
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <span className="topbar-title">
            {page === 'template' ? 'Vendors' : NAV_ITEMS.find(n=>n.id===page)?.label || 'Dashboard'}
          </span>
          <div className="topbar-sep" />
          <span className="topbar-date">{today}</span>
          <div className="topbar-right">
            <div className="search-box">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" />
            </div>
          </div>
        </div>

        <div className="content">
          {page === 'dashboard' && <Dashboard setPage={setPage} />}
          {page === 'invoices'  && <InvoicesPage />}
          {page === 'upload'    && <UploadPage setPage={setPage} />}
          {page === 'vendors'   && <VendorsPage setPage={setPage} setVendor={setVendor} />}
          {page === 'template'  && <TemplatePage vendor={vendor} setPage={setPage} />}
          {page === 'users'     && <UsersPage />}
        </div>
      </div>
    </div>
  );
}
