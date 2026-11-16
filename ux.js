(() => {
 const initial=JSON.parse(JSON.stringify(App.state)), drafts={}, byId=id=>document.getElementById(id);
 let home,saveBox,pending=null,saveSequence=0,displayedDraftKey=null;
 const cache={};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const all=()=>cache;
 const rows=()=>App.state.tournament?.rounds.flatMap(r=>r.matches)||[];
 const toast=message=>{byId('ux-message').textContent=message;byId('ux-message').hidden=false;};
 const fieldKey=el=>el.dataset.team!==undefined ? (el.classList.contains('team-name-input')?'name':el.classList.contains('team-color-input')?'color':'pair'+el.dataset.pair)+'-'+el.dataset.team : 'player-'+el.dataset.index;
 const key=()=>App.state.format+'-'+(App.state.fixedRegistrationMode||'individual');
 function capture(){
  if(!displayedDraftKey)return;
  drafts[displayedDraftKey]={fields:Object.fromEntries([...byId('players-list').querySelectorAll('input')].map(el=>[fieldKey(el),{value:el.value}])),seeds:[...byId('players-list').querySelectorAll('.seed-toggle')].map(el=>el.classList.contains('is-seed'))};
 }
 const renderInputs=App.renderPlayerInputs;
 App.renderPlayerInputs=()=>{capture();renderInputs();displayedDraftKey=key();const d=drafts[displayedDraftKey];if(d){byId('players-list').querySelectorAll('input').forEach((el,i)=>{if(d.fields[fieldKey(el)])el.value=d.fields[fieldKey(el)].value;});byId('players-list').querySelectorAll('.seed-toggle').forEach((el,i)=>el.classList.toggle('is-seed',!!d.seeds[i]));}App.validatePlayers();};
 const selectFormat=App.selectFormat;
 App.selectFormat=format=>{capture();selectFormat(format);document.querySelector('.format-options').classList.add('ux-collapsed');byId('ux-change-format').hidden=false;byId('ux-rules').hidden=false;byId('ux-format-step').textContent='1. Formato ✓';};
 const switchScreen=App.switchScreen;
 App.switchScreen=id=>{if(home)home.hidden=true;document.querySelectorAll('.screen').forEach(el=>el.style.display='');switchScreen(id);const step=id==='setup-format-screen'?1:id==='tournament-screen'?3:2;document.querySelectorAll('.ux-steps li').forEach((li,i)=>{li.classList.toggle('current',i===step-1);li.setAttribute('aria-current',i===step-1?'step':'false');});byId('ux-steps').hidden=false;byId('ux-message').hidden=true;if(step===3)updateTitle();};
 function updateTitle(){byId('ux-title').textContent=App.state.tournamentName||'Torneio';byId('ux-title').hidden=!App.state.tournament;}
 function saveStatus(message,error=false){if(!saveBox)return;saveBox.classList.toggle('error',error);saveBox.replaceChildren();const text=document.createElement('span');text.textContent=message;saveBox.append(text);if(error){const b=document.createElement('button');b.textContent='Tentar novamente';b.onclick=()=>persist(pending);saveBox.append(b);}}
 async function persist(snapshot){
  const sequence=++saveSequence;pending=snapshot;saveStatus('Salvando na nuvem…');
  try{await db.ref('tournaments/'+snapshot.tournamentId).set(snapshot);cache[snapshot.tournamentId]=snapshot;try{App.saveToLocalTournamentsIndex(snapshot.tournamentId,snapshot.tournamentName,snapshot.format);localStorage.setItem('super8bt_recent_admin',snapshot.tournamentId);}catch(e){}if(sequence===saveSequence){pending=null;saveStatus('✓ Salvo na nuvem · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));}}
  catch(e){if(sequence===saveSequence)saveStatus('Não foi possível salvar. Mantenha esta página aberta e tente novamente.',true);}
 }
 App.saveState=()=>{if(App.isViewMode||!App.state.tournamentId)return;return persist(JSON.parse(JSON.stringify(App.state)));};
 const startTournament=App.startTournament;
 App.startTournament=()=>{App.state.tournamentName=byId('ux-name').value.trim()||'Torneio';App.state.scoreRules={games:Number(byId('ux-games').value),tiebreak:Number(byId('ux-tb').value),advantage:byId('ux-advantage').checked};startTournament();};
 const saveScore=App.saveModalScore;
 App.saveModalScore=()=>{
  const a=byId('modal-score1-input').value,b=byId('modal-score2-input').value;
  const tbVisible=!byId('modal-tiebreak-section').classList.contains('hidden'),ta=byId('modal-tb1-input').value,tb=byId('modal-tb2-input').value;
  const message=!a.trim()||!b.trim()?'Informe o placar das duas duplas.':ScoreRules.validate(Number(a),Number(b),tbVisible&&ta!==''?Number(ta):null,tbVisible&&tb!==''?Number(tb):null,App.state.scoreRules||null);
  if(message){byId('modal-score-error').textContent=message;return;}
  saveScore();
 };
 const openScore=App.openScoreModal;
 App.openScoreModal=(id,r)=>{openScore(id,r);const rule=App.state.scoreRules;if(!rule){byId('ux-score-rule').textContent='Confira o placar conforme as regras deste torneio. As regras anteriores foram preservadas.';document.querySelectorAll('.score-pill').forEach(b=>b.hidden=false);return;}byId('ux-score-rule').textContent=`Até ${rule.games} games · em ${rule.games-1} × ${rule.games-1}, tie-break até ${rule.tiebreak}${rule.advantage?', com diferença de 2 pontos':', sem vantagem'}.`;document.querySelectorAll('.score-pill').forEach(b=>b.hidden=Number(b.dataset.val)>rule.games);};
 const assignCourt=App.assignCourt;
 App.assignCourt=(id,c)=>{
  if(App.isViewMode)return;
  const match=rows().find(m=>m.id===id);if(!match||match.finished)return;
  if(c>0){
   if(!Number.isInteger(c)||c>App.state.numCourts){toast('Selecione uma quadra válida.');App.renderRounds();return;}
   const occupied=rows().find(m=>m.id!==id&&!m.finished&&m.court===c);
   if(occupied){toast(`A quadra ${c} já está ocupada. Finalize o jogo ou use “Devolver à fila” antes de chamar outro.`);App.renderRounds();return;}
  }
  assignCourt(id,c);
 };
 App.callMatchToFirstFreeCourt=id=>{const c=Array.from({length:App.state.numCourts},(_,i)=>i+1).find(c=>!rows().some(m=>!m.finished&&m.court===c));if(!c){toast('Todas as quadras estão ocupadas. Nenhum jogo foi movido.');return;}App.assignCourt(id,c);};
 App.renderRounds= () => {
        App.renderKPIs();
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();

        const container = document.getElementById('rounds-container');
        if (!container || !App.state.tournament || !App.state.tournament.rounds) return;
        container.innerHTML = '';

        const dummyAlert = document.getElementById('individual-dummy-alert');
        if (dummyAlert) {
            let hasDummies = false;
            if (App.state.format === 'individual' && App.state.tournament && App.state.tournament.rounds) {
                hasDummies = App.state.tournament.rounds.some(r => r.matches.some(m => m.dummies && m.dummies.length > 0));
            }
            dummyAlert.style.display = hasDummies ? 'block' : 'none';
        }

        const numCourts = App.state.numCourts || 0;
        let busyCourtsCount = 0;
        App.state.tournament.rounds.forEach(r => {
            r.matches.forEach(m => {
                if (!m.finished && m.court && m.court > 0 && m.court <= numCourts) {
                    busyCourtsCount++;
                }
            });
        });
        const hasFreeCourt = numCourts > 0 && busyCourtsCount < numCourts;

        let globalMatchIndex = 0;
        let anyVisibleMatch = false;

        App.state.tournament.rounds.forEach(round => {
            let roundMatchesHtml = [];

            round.matches.forEach((match) => {
                globalMatchIndex++;
                const info = App.getMatchDisplayInfo(match, globalMatchIndex);

                // Filtragem por status
                const isInCourt = !match.finished && numCourts > 0 && match.court && match.court > 0;
                const isQueue = !match.finished && !isInCourt;

                if (App.filterStatus === 'finished' && !match.finished) return;
                if (App.filterStatus === 'court' && !isInCourt) return;
                if (App.filterStatus === 'queue' && !isQueue) return;

                // Filtragem por participante/dupla/equipe
                if (App.filterParticipant && App.filterParticipant !== 'all') {
                    if (!info.participantTokens.includes(App.filterParticipant)) return;
                }

                anyVisibleMatch = true;

                let statusPillHtml = '';
                if (match.finished) {
                    const courtSuffix = (numCourts > 0 && match.court) ? ` · Q${match.court}` : '';
                    statusPillHtml = `<span class="match-status-pill status-done">Concluído${courtSuffix}</span>`;
                } else if (isInCourt) {
                    statusPillHtml = `<span class="match-status-pill status-court">🎾 Quadra ${match.court}</span>`;
                } else {
                    statusPillHtml = `<span class="match-status-pill status-queue">Na fila</span>`;
                }

                const groupBadgeHtml = match.groupName
                    ? `<span class="match-group-tag">${match.groupName}</span>`
                    : '';

                const s1 = match.score1 !== null && match.score1 !== undefined ? parseInt(match.score1) : null;
                const s2 = match.score2 !== null && match.score2 !== undefined ? parseInt(match.score2) : null;
                const t1Won = match.finished && s1 !== null && s2 !== null && s1 > s2;
                const t2Won = match.finished && s1 !== null && s2 !== null && s2 > s1;

                let centerHtml = '';
                if (match.finished && s1 !== null && s2 !== null) {
                    const hasTb = match.tb1 !== null && match.tb1 !== undefined && match.tb1 !== '' &&
                                  match.tb2 !== null && match.tb2 !== undefined && match.tb2 !== '';
                    centerHtml = `
                        <div class="match-center-score">
                            <div class="score-display-box">
                                <span class="${t1Won ? 'score-winner' : ''}">${s1}</span>
                                <span class="score-sep">×</span>
                                <span class="${t2Won ? 'score-winner' : ''}">${s2}</span>
                            </div>
                            ${hasTb ? `<div class="tb-badge">TB ${match.tb1} × ${match.tb2}</div>` : ''}
                        </div>
                    `;
                } else {
                    centerHtml = `
                        <div class="match-center-score">
                            <div class="vs-badge">×</div>
                        </div>
                    `;
                }

                // Rodapé administrativo do card
                let footerHtml = '';
                if (!App.isViewMode) {
                    let leftControlHtml = '';
                    if (!match.finished && numCourts > 0) {
                        let optionsHtml = `<option value="0" ${!match.court ? "selected" : ""}>${match.court ? 'Devolver à fila' : 'Quadra…'}</option>`;
                        for (let c = 1; c <= numCourts; c++) {
                            const isSel = match.court === c ? "selected" : "";
                            optionsHtml += `<option value="${c}" ${isSel}>🎾 Quadra ${c}</option>`;
                        }
                        leftControlHtml = `
                            <select class="court-select-input ${match.court ? 'assigned' : ''}" data-mid="${match.id}" aria-label="Selecionar quadra">
                                ${optionsHtml}
                            </select>
                        `;
                    } else if (match.finished) {
                        leftControlHtml = `<span style="font-size: 0.78rem; color: var(--sand-secondary);">Resultado registrado</span>`;
                    } else {
                        leftControlHtml = `<span style="font-size: 0.78rem; color: var(--sand-secondary);">Aguardando resultado</span>`;
                    }

                    let rightActionsHtml = '';
                    if (!match.finished) {
                        if (numCourts > 0 && !match.court) {
                            rightActionsHtml += `
                                <button type="button" class="btn-match-action btn-call-now" data-mid="${match.id}" ${hasFreeCourt ? '' : 'disabled aria-label="Nenhuma quadra disponível"'}>
                                    ${hasFreeCourt ? 'Chamar agora' : 'Sem quadra'}
                                </button>
                            `;
                        }
                        rightActionsHtml += `
                            <button type="button" class="btn-match-action btn-launch-score ${!isInCourt && numCourts > 0 ? 'score-secondary' : ''}" data-mid="${match.id}" data-rn="${round.roundNum}" aria-label="Lançar resultado da partida ${globalMatchIndex}">
                                ${!isInCourt && numCourts > 0 ? 'Resultado' : 'Lançar resultado'}
                            </button>
                        `;
                    } else {
                        rightActionsHtml += `
                            <button type="button" class="btn-match-action btn-correct-score" data-mid="${match.id}" data-rn="${round.roundNum}">
                                Corrigir
                            </button>
                        `;
                    }

                    footerHtml = `
                        <div class="match-card-footer">
                            <div>${leftControlHtml}</div>
                            <div class="match-footer-right">${rightActionsHtml}</div>
                        </div>
                    `;
                }

                const cardStateClass = match.finished ? 'is-finished' : (isInCourt ? 'in-court' : (numCourts > 0 ? 'is-queued' : ''));

                roundMatchesHtml.push(`
                    <div class="match-card ${cardStateClass}" id="${match.id}">
                        <div class="match-card-top">
                            <div class="match-meta-left">
                                <span class="match-num-badge">${info.numStr}</span>
                                ${groupBadgeHtml}
                            </div>
                            ${statusPillHtml}
                        </div>

                        <div class="match-teams">
                            <div class="team ${t1Won ? 'is-winner' : ''}">
                                ${info.t1Overline ? `<span class="team-overline" style="color: ${info.t1Color};">${info.t1Overline}</span>` : ''}
                                <span class="team-pair-name">${info.t1Name}</span>
                            </div>
                            ${centerHtml}
                            <div class="team ${t2Won ? 'is-winner' : ''}">
                                ${info.t2Overline ? `<span class="team-overline" style="color: ${info.t2Color};">${info.t2Overline}</span>` : ''}
                                <span class="team-pair-name">${info.t2Name}</span>
                            </div>
                        </div>

                        ${footerHtml}
                    </div>
                `);
            });

            if (roundMatchesHtml.length > 0) {
                let roundTitle = round.isKnockout ? `🏆 ${round.knockoutLabel}` : `Rodada ${round.roundNum}`;
                container.innerHTML += `
                    <div class="round-block">
                        <div class="round-header">
                            <h3>${roundTitle}</h3>
                            <span style="font-size: 0.78rem; color: var(--sand-secondary);">${roundMatchesHtml.length} ${roundMatchesHtml.length === 1 ? 'jogo' : 'jogos'}</span>
                        </div>
                        ${roundMatchesHtml.join('')}
                    </div>
                `;
            }
        });

        if (!anyVisibleMatch) {
            container.innerHTML = `
                <div class="glass-card" style="text-align: center; padding: 30px 20px; color: var(--sand-secondary);">
                    Nenhum jogo encontrado para o filtro selecionado.
                </div>
            `;
        }

        // Eventos dos cards
        container.querySelectorAll('.btn-launch-score, .btn-correct-score').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.openScoreModal(e.currentTarget.dataset.mid, e.currentTarget.dataset.rn);
            });
        });

        container.querySelectorAll('.btn-call-now').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.callMatchToFirstFreeCourt(e.currentTarget.dataset.mid);
            });
        });

        container.querySelectorAll('.court-select-input').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const cVal = parseInt(e.target.value);
                App.assignCourt(e.target.dataset.mid, (!isNaN(cVal) && cVal > 0) ? cVal : 0);
            });
        });
    };

 const renderRounds=App.renderRounds;
 App.renderRounds=()=>{renderRounds();const parts=[];if(App.filterStatus!=='all')parts.push(byId('filter-status').selectedOptions[0].textContent);if(App.filterParticipant!=='all')parts.push(byId('filter-participant').selectedOptions[0]?.textContent||'Participante selecionado');byId('ux-filters').hidden=!parts.length;byId('ux-filter-text').textContent='Filtrando por: '+parts.join(' · ');};
 function homeScreen(){
  if(pending){toast('Há alterações não salvas. Use “Tentar novamente” antes de sair.');return;}
  if(new URLSearchParams(location.search).has('admin')||new URLSearchParams(location.search).has('t')){location.href=location.pathname;return;}
  byId('ux-message').hidden=true;capture();document.querySelectorAll('.screen').forEach(el=>el.style.display='none');byId('ux-steps').hidden=true;byId('ux-title').hidden=true;home.hidden=false;history.replaceState({},'',location.pathname);loadHome();
 }

 async function loadHome(){
  const index=App.getLocalTournamentsIndex();const recent=localStorage.getItem('super8bt_recent_admin');
  if(recent&&!index.some(s=>(s.id||s.tournamentId)===recent))index.unshift({id:recent,name:'Último torneio'});
  if(App.state.tournamentId && !App.isViewMode)cache[App.state.tournamentId]=App.state;
  for(const item of index){const id=item.id||item.tournamentId;if(id&&!cache[id])cache[id]={tournamentId:id,tournamentName:item.name||item.tournamentName||'Torneio '+id,format:item.format};}
  renderHome();
  await Promise.allSettled(Object.keys(cache).map(async id=>{try{const data=(await db.ref('tournaments/'+id).once('value')).val();if(data)cache[id]={...data,tournamentId:id};else delete cache[id];}catch(e){/* Keep the saved entry available for retry. */}}));
  if(!home.hidden)renderHome();
 }
 function renderHome(){
  const list=Object.values(all());const term=byId('ux-search').value.toLocaleLowerCase('pt-BR');const formats={teams:'Equipes',individual:'Rodízio individual',fixed:'Duplas fixas',groups:'Grupos + mata-mata',knockout:'Mata-mata'};
  byId('ux-saved-list').innerHTML=list.filter(s=>(s.tournamentName||s.tournamentId).toLocaleLowerCase('pt-BR').includes(term)).map(s=>{const m=s.tournament?.rounds?.flatMap(r=>r.matches)||[];return `<article class="ux-card"><h3>${esc(s.tournamentName||'Torneio '+s.tournamentId)}</h3><p>${formats[s.format]||'Torneio'} · ${s.tournament ? m.filter(m=>m.finished).length+' de '+m.length+' jogos concluídos' : 'Abra para carregar jogos e resultados'}</p><button class="btn btn-primary" data-open="${esc(s.tournamentId)}">Abrir torneio</button></article>`;}).join('')||'<p class="ux-muted">'+(list.length?'Nenhum torneio encontrado. Experimente outro nome.':'Os torneios administrados neste navegador aparecerão aqui. Comece em “Criar torneio”.')+'</p>';
 }
 function create(){if(pending){toast('Salve as alterações antes de criar outro torneio.');return;}if(new URLSearchParams(location.search).has('admin')||new URLSearchParams(location.search).has('t')){location.href=location.pathname+'?new=1';return;}for(const k of Object.keys(drafts))delete drafts[k];displayedDraftKey=null;byId('players-list').innerHTML='';App.state=JSON.parse(JSON.stringify(initial));App.isViewMode=false;byId('view-mode-banner').style.display='none';document.querySelectorAll('.admin-only').forEach(el=>el.style.display='');history.replaceState({},'',location.pathname);App.filterStatus='all';App.filterParticipant='all';App.switchScreen('setup-format-screen');document.querySelectorAll('.format-card').forEach(c=>c.classList.remove('selected'));document.querySelector('.format-options').classList.remove('ux-collapsed');byId('num-players-setup').style.display='none';byId('btn-next-to-players').disabled=true;byId('ux-change-format').hidden=true;byId('ux-rules').hidden=true;byId('ux-name').value='';saveStatus('Os resultados serão salvos na nuvem');}

 const originalInit=App.init;
 App.init=()=>{const recent=localStorage.getItem('super8bt_recent_admin');localStorage.removeItem('super8bt_recent_admin');try{originalInit();if(App.isViewMode)saveStatus('Modo de visualização · resultados ao vivo');}finally{if(recent)localStorage.setItem('super8bt_recent_admin',recent);}if(!new URLSearchParams(location.search).has('admin')&&!new URLSearchParams(location.search).has('t')){if(new URLSearchParams(location.search).has('new'))create();else homeScreen();}};
 // Runs before App.init's DOMContentLoaded callback because this module inserts UI synchronously.
 const nav=document.createElement('div');nav.innerHTML=`<nav class="ux-nav" aria-label="Torneios"><button id="ux-home" class="btn btn-secondary">Meus torneios</button><button id="ux-new" class="btn btn-primary">+ Criar torneio</button></nav><div id="ux-save" class="ux-save" role="status">Os resultados são salvos na nuvem</div><div id="ux-message" role="alert" class="ux-filters" hidden></div><h2 id="ux-title" class="ux-title" hidden></h2><ol id="ux-steps" class="ux-steps"><li id="ux-format-step" class="current">1. Formato</li><li>2. Participantes</li><li>3. Jogos</li></ol>`;document.querySelector('.app-header').after(nav);saveBox=byId('ux-save');
 home=document.createElement('section');home.className='glass-card ux-home';home.hidden=true;home.innerHTML='<h2>Meus torneios</h2><p>Retome um torneio ou crie um novo.</p><label for="ux-search">Buscar pelo nome</label><input id="ux-search" type="search" placeholder="Nome do torneio"><div id="ux-saved-list"></div>';nav.after(home);
 byId('ux-home').onclick=homeScreen;byId('ux-new').onclick=create;byId('ux-search').oninput=renderHome;
 home.onclick=e=>{const b=e.target.closest('[data-open]');if(b)location.href=location.pathname+'?admin='+encodeURIComponent(b.dataset.open);};
 const change=document.createElement('button');change.id='ux-change-format';change.type='button';change.className='btn btn-secondary ux-change-format';change.textContent='Ver outros formatos';change.hidden=true;document.querySelector('.format-options').after(change);change.onclick=()=>{document.querySelector('.format-options').classList.toggle('ux-collapsed');change.textContent=document.querySelector('.format-options').classList.contains('ux-collapsed')?'Ver outros formatos':'Recolher formatos';};
 const rules=document.createElement('section');rules.id='ux-rules';rules.className='ux-rules';rules.hidden=true;rules.innerHTML='<label>Nome do torneio<input id="ux-name" type="text" maxlength="90" placeholder="Ex.: Beach de domingo"></label><details><summary>Regras do placar · padrão: 4 games</summary><label>Games para vencer<select id="ux-games"><option value="4">4 games</option><option value="6">6 games</option><option value="8">8 games</option></select></label><label>Pontos para vencer o tie-break<select id="ux-tb"><option value="7">7 pontos</option><option value="10">10 pontos</option></select></label><label><input id="ux-advantage" type="checkbox"> Exigir diferença de 2 pontos no tie-break</label><p>Ao empatar um game antes do limite, a decisão é no tie-break. Sem a opção acima, vale ponto decisivo.</p></details>';byId('num-players-setup').after(rules);byId('ux-games').onchange=()=>{rules.querySelector('summary').textContent='Regras do placar · '+byId('ux-games').value+' games';};
 const filters=document.createElement('div');filters.id='ux-filters';filters.className='ux-filters';filters.hidden=true;filters.setAttribute('role','status');filters.innerHTML='<span id="ux-filter-text"></span><button id="ux-clear" class="btn btn-secondary" type="button">Limpar filtros</button>';document.querySelector('.matches-filters-bar').after(filters);byId('ux-clear').onclick=()=>{App.filterStatus='all';App.filterParticipant='all';byId('filter-status').value='all';byId('filter-participant').value='all';App.renderRounds();};
 const ruleText=document.createElement('p');ruleText.id='ux-score-rule';ruleText.className='ux-summary';document.querySelector('#score-modal .modal-subtitle').after(ruleText);
 const legend=document.createElement('details');legend.className='ux-legend';legend.innerHTML='<summary>Entenda as siglas da classificação</summary><p>J = jogos disputados · V = vitórias · SG = saldo de games (ganhos menos perdidos) · Pró = games ganhos · Eficiência = percentual de games ganhos.</p>';byId('ranking-container').before(legend);
 // Format cards support keyboard navigation as well as touch.
 document.querySelectorAll('.format-card').forEach(card=>{card.tabIndex=0;card.setAttribute('role','button');card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};});
 // The existing master administration keeps its original authentication.

 // Keep exit semantics explicit, preserving saved tournaments.
 const exit=byId('btn-reset-tournament'),replacement=exit.cloneNode(true);exit.replaceWith(replacement);
 document.addEventListener('DOMContentLoaded',()=>{const old=byId('btn-reset-tournament'),clean=old.cloneNode(true);old.replaceWith(clean);clean.onclick=homeScreen;});
})();