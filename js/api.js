async function request(url, options){
  const res = await fetch(url, options);
  if(!res.ok) throw new Error(`${options?.method || 'GET'} ${url} failed: ${res.status}`);
  if(res.status === 204) return null;
  return res.json();
}

export const api = {
  getWords: () => request('/api/words'),
  createWord: (word) => request('/api/words', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(word)
  }),
  setMastered: (id, mastered) => request(`/api/words/${id}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({mastered})
  }),
  deleteWord: (id) => request(`/api/words/${id}`, {method: 'DELETE'}),

  getWildcards: () => request('/api/wildcards'),

  getTexts: () => request('/api/texts'),
  createText: (text) => request('/api/texts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(text)
  })
};
