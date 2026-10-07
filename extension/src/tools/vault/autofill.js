// Injected into the active tab with chrome.scripting (activeTab). Must be self-contained.
// Refuses to fill unless the page is on the saved site, so a login can't leak to another origin.
export function fillLogin(username, password, site) {
  const here = location.hostname.replace(/^www\./, '');
  if (!site || (here !== site && !here.endsWith(`.${site}`))) return 'mismatch';

  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const usable = [...document.querySelectorAll('input')].filter((i) => !i.disabled && !i.readOnly && visible(i));
  const pass = usable.find((i) => i.type === 'password');
  const textual = usable.filter((i) => /^(text|email|tel|)$/i.test(i.getAttribute('type') ?? ''));
  const hinted = (i) => /user|mail|login|account|identifier/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.type} ${i.placeholder}`);
  // Username: the last text-like field before the password, else the most login-looking field (step-one forms).
  const user = pass
    ? textual.filter((i) => i.compareDocumentPosition(pass) & Node.DOCUMENT_POSITION_FOLLOWING).pop()
    : textual.find(hinted);

  // Native setter + events so React/Vue/Angular forms register the value.
  const setValue = (el, value) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  if (user && username) setValue(user, username);
  if (pass) setValue(pass, password);
  return pass ? 'filled' : user && username ? 'user' : 'none';
}
