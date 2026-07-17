export function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function countWords(text){
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
