/** Read once, before starting PWA/navigation. The secret is never a route or
 * durable draft. Invalid invitation fragments are removed too. */
export function captureInvitation(location:Pick<Location,'hash'|'pathname'|'search'>,history:Pick<History,'replaceState'>):string|null{
 const params=new URLSearchParams(location.hash.slice(1));if(!params.has('invite'))return null;
 const values=params.getAll('invite'),token=values.length===1&&[...params.keys()].length===1&&/^[\w-]{43}$/.test(values[0])?values[0]:'invalid';
 history.replaceState(null,'',location.pathname+location.search);return token;
}
