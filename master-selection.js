(() => {
 const render=App.renderMasterTournaments;
 App.renderMasterTournaments=()=>{
  render();
  document.getElementById('master-bulk-actions')?.remove();
  const list=document.getElementById('master-tournaments-list');if(!list)return;
  const cards=[...list.querySelectorAll('.master-tournament-card')];if(!cards.length)return;
  const bar=document.createElement('div');bar.id='master-bulk-actions';bar.style.cssText='display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0';
  const label=document.createElement('label');label.style.cssText='display:flex;gap:8px;align-items:center;min-height:44px';
  const all=document.createElement('input');all.type='checkbox';all.style.cssText='width:22px;height:22px';
  label.append(all,document.createTextNode('Selecionar todos os exibidos'));
  const remove=document.createElement('button');remove.type='button';remove.className='btn btn-secondary btn-chip btn-danger-chip';
  const status=document.createElement('span');status.setAttribute('role','status');
  bar.append(label,remove,status);list.before(bar);
  const entries=cards.map(card=>{
   const id=card.querySelector('.master-card-header > span')?.textContent.replace(/^ID:\s*/,'').trim();
   const title=card.querySelector('.master-card-title')?.textContent||'Sem nome definido';
   const check=document.createElement('input');check.type='checkbox';check.style.cssText='width:22px;height:22px;margin-right:10px;flex-shrink:0';check.setAttribute('aria-label','Selecionar '+title+' (ID '+id+')');
   card.querySelector('.master-card-header')?.prepend(check);
   return {id,title,check};
  }).filter(e=>e.id);
  const selected=()=>entries.filter(e=>e.check.checked);
  function refresh(){const n=selected().length;remove.disabled=!n;remove.textContent='Excluir selecionados ('+n+')';all.checked=n===entries.length&&n>0;all.indeterminate=n>0&&n<entries.length;}
  all.onchange=()=>{entries.forEach(e=>e.check.checked=all.checked);refresh();};entries.forEach(e=>e.check.onchange=refresh);refresh();
  remove.onclick=async()=>{
   const chosen=selected();if(!chosen.length)return;
   const names=chosen.map(e=>'• '+e.title+' (ID '+e.id+')').join('\n');
   if(!confirm('Excluir permanentemente '+chosen.length+' torneio(s)?\n\n'+names+'\n\nTodos os jogos e resultados desses torneios serão apagados. Esta ação não pode ser desfeita.'))return;
   remove.disabled=true;all.disabled=true;entries.forEach(e=>e.check.disabled=true);status.textContent='Excluindo…';
   let saved=false;
   try{
    if(!db)throw new Error('offline');
    const patch=Object.fromEntries(chosen.map(e=>[e.id,null]));
    await db.ref('tournaments').update(patch);saved=true;
    const ids=new Set(chosen.map(e=>e.id));
    App.masterTournaments=(App.masterTournaments||[]).filter(t=>!ids.has(t.id||t.tournamentId));
    try{
     localStorage.setItem('super8bt_tournaments_index',JSON.stringify(App.getLocalTournamentsIndex().filter(t=>!ids.has(t.id||t.tournamentId))));
     if(ids.has(localStorage.getItem('super8bt_recent_admin')))localStorage.removeItem('super8bt_recent_admin');
    }catch(error){/* Cloud deletion succeeded; local cache is optional. */}
    if(ids.has(App.state.tournamentId)){location.href=location.pathname;return;}
    App.renderMasterTournaments();
    alert(chosen.length+' torneio(s) excluído(s).');
   }catch(error){
    status.textContent=saved?'Exclusão realizada. Atualize o painel.':'Não foi possível confirmar a exclusão. Atualize o painel antes de tentar novamente.';
    all.disabled=false;entries.forEach(e=>e.check.disabled=false);refresh();
   }
  };
 };
})();
