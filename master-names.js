(() => {
 const nameOf=t=>[t.tournamentName,t.tournament?.name,t.name].find(n=>typeof n==='string'&&n.trim())?.trim()||'';
 const render=App.renderMasterTournaments;
 App.renderMasterTournaments=()=>{
  const original=App.masterTournaments||[];
  App.masterTournaments=original.map(t=>({...t,tournamentName:nameOf(t)||'Sem nome definido',tournament:{...(t.tournament||{}),name:nameOf(t)||'Sem nome definido'}}));
  try{render();}finally{App.masterTournaments=original;}
  document.querySelectorAll('#master-tournaments-list .master-tournament-card').forEach(card=>{
   const id=card.querySelector('.master-card-header > span')?.textContent.replace(/^ID:\s*/, '').trim();
   const item=original.find(t=>(t.id||t.tournamentId)===id);if(!item)return;
   const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-chip';
   button.textContent=nameOf(item)?'✏️ Renomear':'✏️ Definir nome';
   button.onclick=async()=>{
    const value=prompt('Nome do torneio (até 90 caracteres):',nameOf(item));
    if(value===null)return;
    const name=value.trim();
    if(!name||name.length>90){alert('Informe um nome com 1 a 90 caracteres.');return;}
    if(name===nameOf(item))return;
    button.disabled=true;button.textContent='Salvando nome…';
    try{
     if(!db)throw new Error('offline');
     const ref=db.ref('tournaments/'+id);
     const current=(await ref.once('value')).val();
     if(!current)throw new Error('missing');
     // Update names only, leaving matches, results and tournament rules intact.
     const patch={tournamentName:name};
     if(current.tournament&&Array.isArray(current.tournament.rounds))patch['tournament/name']=name;
     await ref.update(patch);
     item.tournamentName=name;
     if(patch['tournament/name']&&item.tournament)item.tournament.name=name;
     App.saveToLocalTournamentsIndex(id,name,item.format);
     if(App.state.tournamentId===id){App.state.tournamentName=name;if(App.state.tournament)App.state.tournament.name=name;}
     App.renderMasterTournaments();
    }catch(error){button.disabled=false;button.textContent='✏️ Tentar renomear';alert('Não foi possível salvar o nome. Confira sua conexão e tente novamente.');}
   };
   card.querySelector('.master-card-actions')?.prepend(button);
  });
 };
})();
