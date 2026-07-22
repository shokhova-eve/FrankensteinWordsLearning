export function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Remembers the name a visitor chose on this browser, independent of the
// server-side cookie/user row — lets us offer it back if the server ever
// doesn't recognize them (cleared cookies, or an unrecognized-visitor edge case).
const PREFERRED_NAME_KEY = 'preferredUsername';

export function getPreferredName(){
  return localStorage.getItem(PREFERRED_NAME_KEY);
}

export function setPreferredName(name){
  localStorage.setItem(PREFERRED_NAME_KEY, name);
}

export function countWords(text){
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
