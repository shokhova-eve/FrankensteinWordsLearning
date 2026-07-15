// Minimal hand-rolled cookie handling — avoids pulling in a dependency for
// something this small. Parses the raw `Cookie` header and builds `Set-Cookie`
// headers with the flags an auth-adjacent cookie needs.

function parseCookies(req){
  const header = req.headers.cookie;
  const cookies = {};
  if(!header) return cookies;
  for(const part of header.split(';')){
    const eq = part.indexOf('=');
    if(eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if(name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function setCookie(res, name, value, { maxAgeSeconds } = {}){
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if(maxAgeSeconds) parts.push(`Max-Age=${maxAgeSeconds}`);
  if(process.env.NODE_ENV === 'production') parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

module.exports = { parseCookies, setCookie };
