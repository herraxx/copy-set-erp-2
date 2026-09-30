/* Test double for @hailer/app-sdk. The simulated Hailer host (host.html) owns the data. */
const H = window.parent.__hailer;
class HailerApi {
  constructor(o){ this.o = o; H.apps.push(this); setTimeout(() => o.connected && o.connected(), 20); }
  info(){ return {workspaceId:"ws1", outside:false}; }
  workflow = { list: async () => H.workflows };
  user = { current: async () => ({_id:"u1", firstname:"Test"}) };
  permission = { map: async () => ({u1:{workspace:{isAdmin:H.admin, isOwner:false}}}) };
  activity = {
    list: async (wf, ph, opt) => H.acts.filter(a => a.process === wf && a.currentPhase === ph).slice(opt.skip || 0, (opt.skip || 0) + (opt.limit || 50)).map(a => structuredClone(a)),
    get: async id => structuredClone(H.acts.find(a => a._id === id)),
    create: async (wf, list) => list.map(x => { const a = {_id:"a" + (++H.seq), process:wf, currentPhase:x.phaseId, name:x.name, fields:{...x.fields}}; H.acts.push(a); H.emit("activity.create", [a._id], wf); return structuredClone(a); }),
    update: async list => { list.forEach(x => { const a = H.acts.find(y => y._id === x._id); Object.assign(a.fields, x.fields); H.emit("activity.update", [a._id], a.process); }); return list.length; },
    remove: async ids => { ids.forEach(id => { const i = H.acts.findIndex(a => a._id === id); const wf = H.acts[i].process; H.acts.splice(i, 1); H.emit("activity.remove", [id], wf); }); return ids.length; }
  };
}
window.HailerApi = HailerApi;
