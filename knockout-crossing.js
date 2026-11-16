(function(root){
 function crossGroups(round,groups){
  const groupOf=new Map(groups.flatMap(g=>g.participants.map(p=>[p.id,g.id])));
  const matches=round.matches;
  const playable=matches.filter(m=>m.t1.id!=='BYE'&&m.t2.id!=='BYE');
  const opponents=playable.map(m=>m.t2),assigned=new Map();
  function place(i,seen){
   const order=opponents.map((_,j)=>j).sort((a,b)=>(a===i?-1:b===i?1:Math.abs(a-i)-Math.abs(b-i)));
   for(const j of order){
    if(seen.has(j)||groupOf.get(playable[i].t1.id)===groupOf.get(opponents[j].id))continue;
    seen.add(j);
    if(!assigned.has(j)||place(assigned.get(j),seen)){assigned.set(j,i);return true;}
   }
   return false;
  }
  for(let i=0;i<playable.length;i++)if(!place(i,new Set()))throw new Error('Não é possível cruzar grupos com estes classificados. Escolha outra quantidade de duplas.');
  for(const [j,i] of assigned)playable[i].t2=opponents[j];
  // With six qualifiers, separate group partners into opposite semifinal halves too.
  if(matches.length===4&&matches.filter(m=>m.t2.id==='BYE').length===2){
   const slots=[];matches.forEach((m,i)=>{if(m.t2.id!=='BYE')slots.push([i,'t1'],[i,'t2']);});
   const pairs=slots.map(([i,k])=>matches[i][k]);let best=null,bestCost=Infinity;
   function permute(left,order){
    if(left.length){for(let i=0;i<left.length;i++)permute(left.filter((_,j)=>j!==i),[...order,left[i]]);return;}
    const trial=matches.map(m=>({...m}));slots.forEach(([i,k],j)=>trial[i][k]=order[j]);
    if(trial.some(m=>m.t2.id!=='BYE'&&groupOf.get(m.t1.id)===groupOf.get(m.t2.id)))return;
    let cost=0;
    for(let half=0;half<2;half++){
     const gs=trial.slice(half*2,half*2+2).flatMap(m=>[m.t1,m.t2]).filter(p=>p.id!=='BYE').map(p=>groupOf.get(p.id));
     cost+=(gs.length-new Set(gs).size)*100;
    }
    cost+=order.filter((p,i)=>p.id!==pairs[i].id).length;
    if(cost<bestCost){bestCost=cost;best=trial;}
   }
   permute(pairs,[]);if(best)matches.splice(0,matches.length,...best);
  }
  matches.forEach(m=>{if(m.t1.id==='BYE'||m.t2.id==='BYE')m.isBye=true;});
  return round;
 }
 if(typeof module!=='undefined')module.exports={crossGroups};
 if(typeof App==='undefined'||typeof GroupsMode==='undefined')return;
 const generate=GroupsMode.generateKnockout;
 GroupsMode.generateKnockout=(stats,groups,count)=>{
  const total=groups.reduce((n,g)=>n+g.participants.length,0);
  if(![2,4,6,8,16].includes(count)||count>total)throw new Error('Escolha uma quantidade de classificados que não ultrapasse o total de duplas.');
  return crossGroups(generate(stats,groups,count),groups);
 };
 function ready(){
  const rounds=App.state.tournament?.rounds||[];
  if(App.isViewMode)return false;
  if(rounds.some(r=>r.isKnockout)){alert('O mata-mata já foi gerado para este torneio.');return false;}
  if(!rounds.length||rounds.some(r=>r.matches.some(m=>!m.finished))){alert('Finalize todos os jogos dos grupos antes de gerar o mata-mata.');return false;}
  return true;
 }
 const open=App.generateKnockout,confirm=App.confirmGenerateKnockout;
 App.generateKnockout=()=>{
  if(!ready())return;
  const total=App.state.tournament.groups.reduce((n,g)=>n+g.participants.length,0);
  document.querySelectorAll('.ko-option-btn').forEach(b=>b.disabled=Number(b.dataset.count)>total);
  if(App.selectedKnockoutCount>total)App.selectedKnockoutCount=total>=4?4:2;
  document.querySelectorAll('.ko-option-btn').forEach(b=>b.classList.toggle('selected',Number(b.dataset.count)===App.selectedKnockoutCount));
  open();
 };
 App.confirmGenerateKnockout=()=>{if(!ready())return;try{confirm();}catch(error){alert(error.message);}};
 const isBye=m=>m.isBye||m.t1?.id==='BYE'||m.t2?.id==='BYE';
 const render=App.renderRounds;
 App.renderRounds=()=>{
  render();
  (App.state.tournament?.rounds||[]).flatMap(r=>r.matches).filter(isBye).forEach(m=>{
   const card=document.getElementById(m.id);if(!card)return;
   const pill=card.querySelector('.match-status-pill'),center=card.querySelector('.match-center-score');
   const round=App.state.tournament.rounds.find(r=>r.matches.includes(m));
   const next=round.matches.length===4?'a semifinal':round.matches.length===2?'a final':round.matches.length===8?'as quartas de final':'a próxima fase';
   card.classList.add('is-bye');
   if(pill)pill.textContent='BYE · avanço direto';
   if(center)center.textContent='Sem partida';
   const note=document.createElement('p');note.className='bye-explanation';
   note.textContent='Classificada diretamente para '+next+'. Não disputa jogo nesta fase e não precisa de resultado.';
   card.append(note);
   card.querySelectorAll('.match-card-footer').forEach(el=>el.remove());
   card.querySelectorAll('button,select').forEach(el=>el.remove());
  });
  document.querySelectorAll('.round-block').forEach(block=>{
   const byes=block.querySelectorAll('.match-card.is-bye').length;
   if(!byes)return;
   const games=block.querySelectorAll('.match-card:not(.is-bye)').length;
   const count=block.querySelector('.round-header > span');
   if(count)count.textContent=games+' '+(games===1?'jogo':'jogos')+' · '+byes+' '+(byes===1?'bye':'byes');
  });
 };
 const score=App.openScoreModal;
 App.openScoreModal=(id,r)=>{const m=App.state.tournament?.rounds.flatMap(r=>r.matches).find(m=>m.id===id);if(m&&isBye(m))return;score(id,r);};
})(typeof window==='undefined'?globalThis:window);
