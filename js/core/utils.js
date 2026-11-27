/*
 * Small helpers shared by every screen. No business rules here.
 */
'use strict';

const $ = id => document.getElementById(id);

/* Escape text before putting it into HTML. Use it on every value that came from data or a form. */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();
const DAY_MS = 86400000;

/* Mock dates are relative to "today" so the demo never goes stale. */
function mockDate(offsetDays) { return new Date(Date.now() + offsetDays * DAY_MS).toISOString(); }
function mockDay(offsetDays) { return mockDate(offsetDays).slice(0, 10); }

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/* ---------- HTML building blocks ---------- */

const opt = (value, text, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(text)}</option>`;
const btn = (text, onclick, cls = '', attrs = '') => `<button class="${cls}" onclick="${onclick}" ${attrs}>${text}</button>`;

const BADGE_TONES = {
  good: ['Active', 'Approved', 'Closed', 'Imported', 'Resolved'],
  warn: ['Invited', 'Awaiting plan', 'Submitted', 'Draft', 'Data pending', 'Open', 'Read-only', 'Revision pending'],
  bad: ['Expired', 'Deactivated', 'Suspended', 'Returned', 'Invalid', 'Superseded', 'Archived', 'At limit']
};
function badge(status) {
  const tone = Object.keys(BADGE_TONES).find(k => BADGE_TONES[k].includes(status)) || '';
  return `<span class="tag ${tone}">${esc(status)}</span>`;
}

function table(headers, rows, empty = 'Nothing to show here yet.') {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="tablewrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const field = (label, inner, cls = '') => `<div class="field ${cls}"><label>${label}</label>${inner}</div>`;
const sel = (id, options, attrs = '') => `<select id="${id}" ${attrs}>${options}</select>`;
const inp = (id, value = '', attrs = '') => `<input id="${id}" value="${esc(value)}" ${attrs}>`;
const value = id => $(id)?.value.trim() || '';
const checkedValues = name => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);

/* A list of checkboxes, e.g. for picking facilities. items: [{id, label}] */
function checkboxes(name, items, checkedIds = []) {
  if (!items.length) return '<p class="muted">None available.</p>';
  return `<div class="checklist">${items.map(i =>
    `<label class="check"><input type="checkbox" name="${name}" value="${esc(i.id)}" ${checkedIds.includes(i.id) ? 'checked' : ''}> ${esc(i.label)}</label>`
  ).join('')}</div>`;
}

/* Page header with breadcrumb, title, description and action buttons. */
function pageHead(title, description, actions = '', eyebrow = '') {
  return `<div class="hero"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${title}</h1>` +
    `${description ? `<p>${description}</p>` : ''}</div><div class="row">${actions}</div></div>`;
}

function statCard(label, number, unit, note = '') {
  return `<div class="card"><small>${label}</small><div class="stat">${number} <span>${unit}</span></div>${note ? `<small>${note}</small>` : ''}</div>`;
}

/* ---------- Modal and toast ---------- */

function openModal(title, html) {
  $('mt').textContent = title;
  $('mc').innerHTML = html;
  $('shade').classList.add('open');
  $('mc').querySelector('input,select,textarea')?.focus();
}
function closeModal() { $('shade').classList.remove('open'); }
function formError(text) { $('formerr').textContent = text; }
function modalFoot(actionText, action) {
  return `<div id="formerr" class="err" role="alert"></div><div class="modalfoot">${btn('Cancel', 'closeModal()')}${btn(actionText, action, 'primary')}</div>`;
}

function toast(text) {
  $('toast').textContent = text;
  $('toast').style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { $('toast').style.display = 'none'; }, 3200);
}

function download(name, content, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvLine = cells => cells.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',');
