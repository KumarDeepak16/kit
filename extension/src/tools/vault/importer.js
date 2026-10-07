// CSV import for password exports from Chrome/Edge, Firefox, Bitwarden, 1Password, LastPass, etc.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') field += '"', i++;
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim()));
}

const COLUMNS = {
  url: ['url', 'login_uri', 'website', 'web site', 'uri', 'origin', 'hostname', 'login url'],
  name: ['name', 'title'],
  username: ['username', 'login_username', 'user name', 'user', 'email', 'login', 'email address'],
  password: ['password', 'login_password', 'pass'],
};

const hostOf = (url) => {
  try {
    const u = new URL(url.trim());
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

/** rows (first row = header) -> [{ site, username, password }] */
export function toEntries(rows) {
  const [head = [], ...data] = rows;
  const names = head.map((h) => h.trim().toLowerCase());
  const col = (key) => COLUMNS[key].map((n) => names.indexOf(n)).find((i) => i >= 0) ?? -1;
  const [url, name, user, pass] = ['url', 'name', 'username', 'password'].map(col);
  if (pass < 0) throw new Error("This file doesn't have a password column");
  return data
    .map((r) => ({
      site: hostOf(r[url] ?? '') || (r[name] ?? '').trim(),
      username: (r[user] ?? '').trim(),
      password: r[pass] ?? '',
    }))
    .filter((e) => e.site && e.password);
}

/** Adds what isn't already there (same site + username + password). */
export function merge(existing, incoming) {
  const key = (e) => `${e.site.toLowerCase()}\n${e.username.toLowerCase()}\n${e.password}`;
  const seen = new Set(existing.map(key));
  const fresh = [];
  for (const e of incoming) {
    if (seen.has(key(e))) continue;
    seen.add(key(e));
    fresh.push({ ...e, id: crypto.randomUUID(), updated: Date.now() });
  }
  return { list: [...existing, ...fresh], added: fresh.length, skipped: incoming.length - fresh.length };
}
