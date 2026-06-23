// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBBRzdWGygJ9dlk5NaNbSU84upSmZI-Bq4",
    authDomain: "rey-play.firebaseapp.com",
    projectId: "rey-play",
    storageBucket: "rey-play.firebasestorage.app",
    messagingSenderId: "694155497534",
    appId: "1:694155497534:web:bb82694e98af2398d8416f",
    databaseURL: "https://rey-play-default-rtdb.firebaseio.com"
};

let db = null;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// Main Application Logic
const App = {
    isViewMode: false,
    state: {
        players: [],
        format: null, // 'individual' or 'fixed'
        numPlayers: 8,
        fixedPairs: [], 
        tournament: null, 
        stats: {},
        numCourts: 2,
        maxMatchesPerPlayer: null
    },

    init: () => {
        App.bindEvents();

        const urlParams = new URLSearchParams(window.location.search);
        const tId = urlParams.get('t');
        const adminId = urlParams.get('admin');

        let targetId = tId || adminId;

        if (targetId && db) {
            if (tId) {
                App.isViewMode = true;
                document.getElementById('view-mode-banner').style.display = 'block';
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            } else {
                App.state.tournamentId = adminId;
            }
            
            db.ref('tournaments/' + targetId).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    App.state = data;
                    if (App.state.tournament) {
                        App.resumeTournament();
                    }
                } else {
                    alert("Torneio não encontrado ou ID inválido.");
                }
            }, (error) => {
                console.error("Erro ao carregar do Firebase: ", error);
            });
        } else {
            const recentAdmin = localStorage.getItem('super8bt_recent_admin');
            if (recentAdmin && confirm("Você tem um torneio em andamento neste navegador. Deseja retomá-lo?\n\n(Cancelar irá limpar a tela para um novo torneio)")) {
                window.location.href = '?admin=' + recentAdmin;
            }
        }
    },

    saveState: () => {
        if (App.isViewMode) return;
        
        if (App.state.tournamentId) {
            try {
                localStorage.setItem('super8bt_recent_admin', App.state.tournamentId);
            } catch (e) {
                console.error("Erro no localStorage:", e);
            }

            if (db) {
                // Remove propriedades 'undefined' que causam erro silencioso no Firebase
                const cleanState = JSON.parse(JSON.stringify(App.state));
                db.ref('tournaments/' + App.state.tournamentId).set(cleanState)
                  .catch(e => {
                      console.error("Firebase sync error", e);
                      alert("Erro ao salvar no servidor: " + e.message);
                  });
            }
        }
    },

    loadState: () => {
        return false;
    },

    resumeTournament: () => {
        if (App.state.format === 'individual') {
            document.getElementById('rank-name-col').innerText = 'Jogador';
        } else {
            document.getElementById('rank-name-col').innerText = 'Dupla';
        }
        
        const btnKnockout = document.getElementById('btn-generate-knockout');
        if (btnKnockout) {
            btnKnockout.style.display = (App.state.format === 'groups' && !App.isViewMode) ? 'inline-block' : 'none';
        }

        App.renderRounds();
        App.renderRanking();
        App.switchScreen('tournament-screen');
    },

    bindEvents: () => {
        // Format Setup
        document.getElementById('format-individual').addEventListener('click', () => App.selectFormat('individual'));
        document.getElementById('format-fixed').addEventListener('click', () => App.selectFormat('fixed'));
        document.getElementById('format-groups').addEventListener('click', () => App.selectFormat('groups'));
        document.getElementById('format-knockout').addEventListener('click', () => App.selectFormat('knockout'));
        document.getElementById('num-players-input').addEventListener('input', App.validateFormatSetup);
        document.getElementById('num-groups-input').addEventListener('input', App.validateFormatSetup);
        document.getElementById('btn-next-to-players').addEventListener('click', App.goToPlayersScreen);

        // Players setup
        document.getElementById('btn-back-to-format').addEventListener('click', () => App.switchScreen('setup-format-screen'));
        document.getElementById('players-list').addEventListener('input', App.validatePlayers);
        document.getElementById('players-list').addEventListener('click', App.toggleSeed);
        document.getElementById('btn-next-to-pairs').addEventListener('click', App.processPlayers);

        // Pairs Setup (Only Fixed Doubles)
        document.getElementById('btn-back-to-players').addEventListener('click', () => App.switchScreen('setup-players-screen'));
        document.getElementById('btn-draw-random').addEventListener('click', App.drawFixedPairs);
        document.getElementById('btn-manual-pairs').addEventListener('click', App.setupManualPairs);
        
        // Start Fixed
        document.getElementById('btn-start-fixed').addEventListener('click', App.startTournament);

        // Tabs
        document.querySelectorAll('.tab').forEach(t => {
            t.addEventListener('click', (e) => App.switchTab(e.target.dataset.target));
        });

        // Reset
        document.getElementById('btn-reset-tournament').addEventListener('click', () => {
            if (confirm("Tem certeza que deseja encerrar e limpar a sua tela?\n\nIsso não apaga o torneio da nuvem, apenas tira da sua visualização atual.")) {
                try {
                    localStorage.removeItem('super8bt_recent_admin');
                } catch (e) {
                    console.error("Erro ao remover localStorage:", e);
                }
                window.location.href = window.location.pathname;
            }
        });

        // Export
        document.getElementById('btn-export-csv').addEventListener('click', App.exportCSV);
        document.getElementById('btn-export-whatsapp').addEventListener('click', App.exportWhatsApp);
        document.querySelectorAll('.btn-print').forEach(btn => {
            btn.addEventListener('click', () => window.print());
        });

        // Knockout
        const btnKnockout = document.getElementById('btn-generate-knockout');
        if (btnKnockout) {
            btnKnockout.addEventListener('click', App.generateKnockout);
        }

        // Share
        const shareBtn = document.getElementById('btn-share-link');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                if (App.state.tournamentId) {
                    const url = window.location.origin + window.location.pathname + '?t=' + App.state.tournamentId;
                    navigator.clipboard.writeText(url).then(() => {
                        alert('Link copiado! Envie para os jogadores:\n\n' + url);
                    }).catch(err => {
                        alert('Erro ao copiar automaticamente. Compartilhe o link abaixo:\n\n' + url);
                    });
                } else {
                    alert('Inicie o torneio primeiro!');
                }
            });
        }

        // Share Admin
        const shareAdminBtn = document.getElementById('btn-share-admin-link');
        if (shareAdminBtn) {
            shareAdminBtn.addEventListener('click', () => {
                if (App.state.tournamentId) {
                    const url = window.location.origin + window.location.pathname + '?admin=' + App.state.tournamentId;
                    navigator.clipboard.writeText(url).then(() => {
                        alert('Link de Administrador copiado!\n\nGuarde este link ou envie para o seu outro dispositivo para ter acesso total ao torneio:\n' + url);
                    }).catch(err => {
                        alert('Erro ao copiar. Acesse pelo link:\n' + url);
                    });
                } else {
                    alert('Inicie o torneio primeiro!');
                }
            });
        }
    },

    // --- UI Navigation ---
    switchScreen: (screenId) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    switchTab: (tabId) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-target="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'tab-ranking') {
            App.renderRanking();
        }
    },

    // --- FORMAT SELECTION ---
    selectFormat: (formatType) => {
        App.state.format = formatType;
        
        document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
        document.getElementById(`format-${formatType}`).classList.add('selected');
        
        const numSetup = document.getElementById('num-players-setup');
        const numInput = document.getElementById('num-players-input');
        const numHint = document.getElementById('num-players-hint');
        const fixedModeSel = document.getElementById('fixed-mode-selection');
        const groupsSetup = document.getElementById('groups-setup');
        const knockoutOptions = document.getElementById('knockout-options');
        
        numSetup.style.display = 'block';
        if (groupsSetup) groupsSetup.style.display = (formatType === 'groups') ? 'block' : 'none';
        if (knockoutOptions) knockoutOptions.style.display = (formatType === 'groups' || formatType === 'knockout') ? 'block' : 'none';
        
        const individualSetup = document.getElementById('individual-setup');
        if (individualSetup) individualSetup.style.display = (formatType === 'individual') ? 'block' : 'none';
        
        if (formatType === 'individual') {
            numInput.value = 8;
            numInput.step = 1;
            numHint.innerText = '* Na modalidade individual, o número de atletas deve ser no mínimo 4.';
            fixedModeSel.style.display = 'none';
        } else {
            numInput.value = 16;
            numInput.step = 2;
            numHint.innerText = '* O número de atletas deve ser par (para formar as duplas).';
            fixedModeSel.style.display = 'block';
        }
        
        App.validateFormatSetup();
    },

    validateFormatSetup: () => {
        const numInput = document.getElementById('num-players-input');
        const val = parseInt(numInput.value);
        const btn = document.getElementById('btn-next-to-players');
        
        if (App.state.format === 'individual') {
            btn.disabled = isNaN(val) || val < 4;
        } else if (App.state.format === 'fixed' || App.state.format === 'groups' || App.state.format === 'knockout') {
            const numGroups = parseInt(document.getElementById('num-groups-input').value);
            let validGroups = true;
            if (App.state.format === 'groups') {
                validGroups = !isNaN(numGroups) && numGroups >= 2;
            }
            btn.disabled = isNaN(val) || val < 4 || val % 2 !== 0 || !validGroups;
        } else {
            btn.disabled = true;
        }
    },

    goToPlayersScreen: () => {
        const numInput = document.getElementById('num-players-input');
        App.state.numPlayers = parseInt(numInput.value);

        const numCourtsInput = document.getElementById('num-courts-input');
        App.state.numCourts = parseInt(numCourtsInput.value) || 1;
        
        const maxMatchesInput = document.getElementById('max-matches-input');
        if (maxMatchesInput && App.state.format === 'individual') {
            App.state.maxMatchesPerPlayer = parseInt(maxMatchesInput.value) || null;
        } else {
            App.state.maxMatchesPerPlayer = null;
        }
        
        if (App.state.format === 'groups') {
            App.state.numGroups = parseInt(document.getElementById('num-groups-input').value) || 2;
        }

        const modeRadio = document.querySelector('input[name="fixed_mode"]:checked');
        App.state.fixedRegistrationMode = ((App.state.format === 'fixed' || App.state.format === 'groups' || App.state.format === 'knockout') && modeRadio) ? modeRadio.value : 'individual';

        // Re-render inputs in case format changed
        App.renderPlayerInputs();
        App.validatePlayers();
        
        if (App.state.format === 'individual') {
            document.getElementById('players-title').innerText = `Elenco (${App.state.numPlayers} Jogadores)`;
            document.querySelector('#setup-players-screen p').innerHTML = 'Cadastre os jogadores. Marque a estrela ⭐ para sinalizar os <strong>Cabeças de Chave</strong>.';
        } else {
            if (App.state.fixedRegistrationMode === 'predefined') {
                document.getElementById('players-title').innerText = `Elenco (${App.state.numPlayers/2} Duplas Prontas)`;
                document.querySelector('#setup-players-screen p').innerHTML = 'Cadastre o nome de cada dupla. Marque a estrela ⭐ para sinalizar os <strong>Cabeças de Chave</strong>.';
            } else {
                document.getElementById('players-title').innerText = `Elenco (${App.state.numPlayers} Jogadores / ${App.state.numPlayers/2} Duplas)`;
                document.querySelector('#setup-players-screen p').innerHTML = 'Cadastre os jogadores. Marque a estrela ⭐ para sinalizar os <strong>Cabeças de Chave</strong>.';
            }
        }
        
        App.switchScreen('setup-players-screen');
    },

    // --- PLAYERS SETUP ---
    renderPlayerInputs: () => {
        const container = document.getElementById('players-list');
        container.innerHTML = '';
        
        if ((App.state.format === 'fixed' || App.state.format === 'groups' || App.state.format === 'knockout') && App.state.fixedRegistrationMode === 'predefined') {
            const numPairs = App.state.numPlayers / 2;
            for(let i=0; i<numPairs; i++) {
                container.innerHTML += `
                    <div class="player-input-row">
                        <span class="player-num">${i+1}.</span>
                        <input type="text" class="p-input" data-index="${i}" placeholder="Nome da Dupla ${i+1} (ex: João & Maria)">
                        <button class="seed-toggle" data-index="${i}" title="Marcar como Cabeça de Chave">⭐</button>
                    </div>
                `;
            }
        } else {
            for(let i=0; i<App.state.numPlayers; i++) {
                container.innerHTML += `
                    <div class="player-input-row">
                        <span class="player-num">${i+1}.</span>
                        <input type="text" class="p-input" data-index="${i}" placeholder="Nome do Jogador ${i+1}">
                        <button class="seed-toggle" data-index="${i}" title="Marcar como Cabeça de Chave">⭐</button>
                    </div>
                `;
            }
        }
    },

    toggleSeed: (e) => {
        if(e.target.classList.contains('seed-toggle')) {
            e.target.classList.toggle('is-seed');
        }
    },

    validatePlayers: () => {
        const inputs = document.querySelectorAll('.p-input');
        let allFilled = true;
        inputs.forEach(inp => {
            if (inp.value.trim() === '') allFilled = false;
        });

        document.getElementById('btn-next-to-pairs').disabled = !allFilled;
    },

    processPlayers: () => {
        // Collect players or predefined pairs
        const inputs = document.querySelectorAll('.p-input');
        
        if ((App.state.format === 'fixed' || App.state.format === 'groups' || App.state.format === 'knockout') && App.state.fixedRegistrationMode === 'predefined') {
            App.state.fixedPairs = [];
            const toggles = document.querySelectorAll('.seed-toggle');
            for(let i=0; i<inputs.length; i++) {
                const isSeed = toggles[i] ? toggles[i].classList.contains('is-seed') : false;
                App.state.fixedPairs.push({
                    id: `pair_${i}`,
                    name: inputs[i].value.trim(),
                    isSeed: isSeed,
                    p1: { name: inputs[i].value.trim(), isSeed: isSeed }, 
                    p2: { name: '', isSeed: false }
                });
            }
            App.startTournament();
            return;
        }

        const toggles = document.querySelectorAll('.seed-toggle');
        
        App.state.players = [];
        for(let i=0; i<App.state.numPlayers; i++) {
            App.state.players.push({
                id: `p_${i}`,
                name: inputs[i].value.trim(),
                isSeed: toggles[i].classList.contains('is-seed')
            });
        }
        
        const numSeeds = App.state.players.filter(p=>p.isSeed).length;
        // Limit seeds: up to numPlayers / 2
        const maxSeeds = App.state.numPlayers / 2;
        if (numSeeds > maxSeeds) {
            document.getElementById('setup-error').innerText = `Max de ${maxSeeds} Cabeças de chave permitido.`;
            return;
        }
        document.getElementById('setup-error').innerText = "";
        
        if (App.state.format === 'individual') {
            // Ir direto para torneio
            App.startTournament();
        } else {
            // Ir para tela de duplas
            document.getElementById('doubles-preview').innerHTML = '';
            document.getElementById('btn-start-fixed').classList.add('hidden');
            App.switchScreen('setup-pairs-screen');
        }
    },

    // --- PAIRS SETUP ---
    drawFixedPairs: () => {
        App.state.fixedPairs = FixedDoubles.drawPairs(App.state.players);
        App.renderFixedPairsPreview(true);
        document.getElementById('btn-start-fixed').classList.remove('hidden');
    },

    setupManualPairs: () => {
        const numPairs = App.state.numPlayers / 2;
        const container = document.getElementById('doubles-preview');
        container.innerHTML = '<p style="margin-bottom:10px;">Selecione os pares (garanta que não haja repetidos):</p>';
        
        let selectHtml = `<select class="pair-select player-select">
            <option value="">Escolha...</option>
            ${App.state.players.map(p => `<option value="${p.id}">${p.name}${p.isSeed?'⭐':''}</option>`).join('')}
        </select>`;

        for (let i=0; i<numPairs; i++) {
            container.innerHTML += `
               <div class="pair-row">
                    ${selectHtml} 
                    <span class="vs">&</span> 
                    ${selectHtml}
               </div> 
            `;
        }
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary mt-4';
        confirmBtn.innerText = 'Confirmar Duplas Manuais';
        confirmBtn.onclick = App.confirmManualPairs;
        container.appendChild(confirmBtn);
        
        document.getElementById('btn-start-fixed').classList.add('hidden');
    },

    confirmManualPairs: () => {
        const numPairs = App.state.numPlayers / 2;
        const selects = document.querySelectorAll('.player-select');
        let selectedIds = [];
        let valid = true;

        selects.forEach(sel => {
            if(!sel.value) valid = false;
            selectedIds.push(sel.value);
        });

        // Check for duplicates
        if (new Set(selectedIds).size !== App.state.numPlayers) {
            alert("Existem jogadores repetidos ou não selecionados.");
            return;
        }

        if(!valid) return;

        App.state.fixedPairs = [];
        for (let i=0; i<numPairs; i++) {
            let p1Id = selects[i*2].value;
            let p2Id = selects[i*2+1].value;
            let p1 = App.state.players.find(x => x.id === p1Id);
            let p2 = App.state.players.find(x => x.id === p2Id);
            
            App.state.fixedPairs.push({
                id: `pair_${i}`,
                name: `${p1.name} & ${p2.name}`,
                isSeed: p1.isSeed || p2.isSeed,
                p1: p1,
                p2: p2
            });
        }

        App.renderFixedPairsPreview(false);
        document.getElementById('btn-start-fixed').classList.remove('hidden');
    },

    renderFixedPairsPreview: (drawn) => {
        const container = document.getElementById('doubles-preview');
        container.innerHTML = drawn ? '<p>👉 Duplas Sorteadas!</p>' : '<p>👉 Duplas Confirmadas!</p>';
        App.state.fixedPairs.forEach(pair => {
            container.innerHTML += `
                <div class="pair-row">
                    <span>${pair.p1.name} ${pair.p1.isSeed?'⭐':''}</span>
                    <span class="vs">&</span>
                    <span>${pair.p2.name} ${pair.p2.isSeed?'⭐':''}</span>
                </div>
            `;
        });
    },

    // --- TOURNAMENT START ---
    startTournament: () => {
        App.initStats();

        if (!App.state.tournamentId) {
            App.state.tournamentId = Math.random().toString(36).substring(2, 7).toUpperCase();
        }

        const thirdPlaceRadio = document.querySelector('input[name="third_place_mode"]:checked');
        App.state.hasThirdPlaceMatch = (thirdPlaceRadio && thirdPlaceRadio.value === 'match');

        if (App.state.format === 'individual') {
            App.state.tournament = IndividualMode.generateRounds(App.state.players, App.state.numCourts, App.state.maxMatchesPerPlayer);
            document.getElementById('rank-name-col').innerText = 'Jogador';
        } else if (App.state.format === 'groups') {
            App.state.tournament = GroupsMode.generateRounds(App.state.fixedPairs, App.state.numGroups, App.state.numCourts);
            document.getElementById('rank-name-col').innerText = 'Dupla';
        } else if (App.state.format === 'knockout') {
            App.state.tournament = KnockoutMode.generateInitialRound(App.state.fixedPairs);
            document.getElementById('rank-name-col').innerText = 'Dupla';
        } else {
            App.state.tournament = RoundRobin.generateSubArrays(App.state.fixedPairs);
            document.getElementById('rank-name-col').innerText = 'Dupla';
        }

        App.saveState();
        
        const newUrl = window.location.pathname + '?admin=' + App.state.tournamentId;
        window.history.pushState({path:newUrl}, '', newUrl);

        App.renderRounds();
        App.renderRanking();
        App.switchScreen('tournament-screen');
        
        if (App.state.format === 'groups') {
            App.switchTab('tab-ranking');
        } else {
            App.switchTab('tab-matches');
        }
        
        const btnKnockout = document.getElementById('btn-generate-knockout');
        if (btnKnockout) {
            btnKnockout.style.display = (App.state.format === 'groups' && !App.isViewMode) ? 'inline-block' : 'none';
        }
    },

    generateKnockout: () => {
        let numStr = prompt("Quantas equipes se classificam para o mata-mata? (Ex: 2, 4, 8, 16)");
        if (!numStr) return;
        
        let numTeams = parseInt(numStr);
        if (isNaN(numTeams) || numTeams < 2) {
            alert("Número inválido. O mínimo de equipes é 2.");
            return;
        }

        let statsArray = Object.values(App.state.stats);
        let koRound = GroupsMode.generateKnockout(statsArray, App.state.tournament.groups, numTeams);
        
        // Atribuir um número de rodada sequencial
        koRound.roundNum = App.state.tournament.rounds.length + 1;
        
        App.state.tournament.rounds.push(koRound);
        App.saveState();
        App.renderRounds();
        
        // Rolar até o fim para ver a nova rodada
        document.getElementById('rounds-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
    },

    initStats: () => {
        App.state.stats = {};
        if (App.state.format === 'individual') {
            App.state.players.forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0, matches: 0 };
            });
        } else {
            App.state.fixedPairs.forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0, matches: 0 };
            });
        }
    },

    // --- MATCHES RENDER ---
    renderRounds: () => {
        // Preservar valores digitados que ainda não foram salvos
        if (App.state.tournament && App.state.tournament.rounds) {
            document.querySelectorAll('.score-input:not(:disabled)').forEach(input => {
                const mid = input.dataset.mid;
                const team = input.dataset.team;
                for (const r of App.state.tournament.rounds) {
                    const m = r.matches.find(x => x.id === mid);
                    if (m && !m.finished) {
                        if (team === '1') m.score1 = input.value === '' ? null : parseInt(input.value);
                        if (team === '2') m.score2 = input.value === '' ? null : parseInt(input.value);
                    }
                }
            });
        }

        const container = document.getElementById('rounds-container');
        container.innerHTML = '';

        const dummyAlert = document.getElementById('individual-dummy-alert');
        if (dummyAlert) {
            let hasDummies = false;
            if (App.state.format === 'individual' && App.state.tournament && App.state.tournament.rounds) {
                hasDummies = App.state.tournament.rounds.some(r => r.matches.some(m => m.dummies && m.dummies.length > 0));
            }
            dummyAlert.style.display = hasDummies ? 'block' : 'none';
        }

        let globalMatchIndex = 0;
        App.state.tournament.rounds.forEach(round => {
            let matchesHtml = round.matches.map((match, mIndex) => {
                let t1Name = '';
                let t2Name = '';
                
                if (App.state.format === 'individual') {
                    const dummies = match.dummies || [];
                    let p1 = dummies.includes(match.t1[0].id) ? `${match.t1[0].name} 🃏` : match.t1[0].name;
                    let p2 = dummies.includes(match.t1[1].id) ? `${match.t1[1].name} 🃏` : match.t1[1].name;
                    let p3 = dummies.includes(match.t2[0].id) ? `${match.t2[0].name} 🃏` : match.t2[0].name;
                    let p4 = dummies.includes(match.t2[1].id) ? `${match.t2[1].name} 🃏` : match.t2[1].name;
                    t1Name = `${p1} & ${p2}`;
                    t2Name = `${p3} & ${p4}`;
                } else {
                    t1Name = match.t1.name;
                    t2Name = match.t2.name;
                }

                let courtNum = (globalMatchIndex % (App.state.numCourts || 1)) + 1;
                globalMatchIndex++;

                let isReadonly = App.isViewMode || match.finished ? 'disabled' : '';
                let groupLabel = match.groupName ? `<div style="font-size:0.75rem; color:var(--sunset-yellow); margin-bottom:5px; font-weight:bold;">[${match.groupName}]</div>` : '';

                return `
                    <div class="match-card" id="${match.id}">
                        ${groupLabel}
                        <div class="match-teams">
                            <div class="team"><span>${t1Name}</span></div>
                            <div class="vs-badge">VS</div>
                            <div class="team"><span>${t2Name}</span></div>
                        </div>
                        <div class="match-score" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;">
                            <div style="justify-self: start;">
                                ${!App.isViewMode && !match.finished ? `<button class="btn-save-match btn-primary" style="padding: 4px 16px; font-size: 0.85rem; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;" data-mid="${match.id}" data-rn="${round.roundNum}">Salvar</button>` : ''}
                            </div>
                            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                                <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="1" ${isReadonly} value="${match.score1 !== null ? match.score1 : ''}">
                                <span class="vs">X</span>
                                <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="2" ${isReadonly} value="${match.score2 !== null ? match.score2 : ''}">
                            </div>
                            <div class="court-badge" style="justify-self: end; position: relative;">Quadra ${courtNum}</div>
                        </div>
                    </div>
                `;
            }).join('');

            const allFinished = round.matches.length > 0 && round.matches.every(m => m.finished);

            let actionHtml = '';
            if (!App.isViewMode) {
                actionHtml = allFinished 
                    ? `<button class="btn-edit-round btn-secondary" data-rn="${round.roundNum}" style="padding:5px 12px;font-size:0.8rem;width:auto;">✏️ Editar</button>`
                    : ``;
            }

            let roundTitle = round.isKnockout ? `🏆 ${round.knockoutLabel}` : `Rodada ${round.roundNum}`;

            container.innerHTML += `
               <div class="round-block">
                    <div class="round-header">
                        <h3>${roundTitle}</h3>
                        ${actionHtml}
                    </div>
                    ${matchesHtml}
               </div> 
            `;
        });

        document.querySelectorAll('.btn-save-match').forEach(btn => {
            btn.addEventListener('click', (e) => App.finishMatch(e.target.dataset.mid, parseInt(e.target.dataset.rn)));
        });
        document.querySelectorAll('.btn-edit-round').forEach(btn => {
            btn.addEventListener('click', (e) => App.editRound(parseInt(e.target.dataset.rn)));
        });
    },

    finishMatch: (matchId, roundNum) => {
        const round = App.state.tournament.rounds.find(r => r.roundNum === roundNum);
        const match = round.matches.find(m => m.id === matchId);
        
        if (!match || match.finished) return;

        const input1 = document.querySelector(`.score-input[data-mid="${match.id}"][data-team="1"]`);
        const input2 = document.querySelector(`.score-input[data-mid="${match.id}"][data-team="2"]`);
        
        const s1 = parseInt(input1.value);
        const s2 = parseInt(input2.value);

        if (isNaN(s1) || isNaN(s2)) {
            alert("Preencha os dois placares deste jogo.");
            return;
        }

        match.score1 = s1;
        match.score2 = s2;
        match.finished = true;
        
        const res = Scoring.calculateMatchScore(s1, s2);
        
        if (App.state.format === 'individual') {
            const dummies = match.dummies || [];
            if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, res.winsA, res.sgA, res.proA, 1);
            if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, res.winsA, res.sgA, res.proA, 1);
            if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, res.winsB, res.sgB, res.proB, 1);
            if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, res.winsB, res.sgB, res.proB, 1);
        } else {
            App.addStatsToPlayer(match.t1.id, res.winsA, res.sgA, res.proA, 1);
            App.addStatsToPlayer(match.t2.id, res.winsB, res.sgB, res.proB, 1);
        }

        const allFinished = round.matches.length > 0 && round.matches.every(m => m.finished);

        if (allFinished) {
            if (round.isKnockout && round.matches.length > 1 && round.knockoutLabel !== 'Final') {
                App.generateNextKnockoutPhase(round);
            }
        }
        
        App.saveState();
        App.renderRounds();
        App.renderRanking();
        
        if (allFinished && round.isKnockout) {
            setTimeout(() => {
                document.getElementById('rounds-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    },

    generateNextKnockoutPhase: (round) => {
        let nextPhaseTeams = [];
        let nextPhaseLosers = [];
        
        round.matches.forEach(m => {
            if (m.score1 > m.score2) {
                nextPhaseTeams.push(m.t1);
                nextPhaseLosers.push(m.t2);
            } else if (m.score2 > m.score1) {
                nextPhaseTeams.push(m.t2);
                nextPhaseLosers.push(m.t1);
            } else {
                nextPhaseTeams.push(m.t1); 
                nextPhaseLosers.push(m.t2);
            }
        });

        let nextMatches = [];
        let nextMatchCount = nextPhaseTeams.length / 2;
        let nextLabel = "Fase Final";
        if (nextMatchCount === 1) nextLabel = "Final";
        else if (nextMatchCount === 2) nextLabel = "Semifinal";
        else if (nextMatchCount === 4) nextLabel = "Quartas de Final";

        for (let i = 0; i < nextMatchCount; i++) {
            nextMatches.push({
                id: `ko_prog_${round.roundNum}_${i}`,
                t1: nextPhaseTeams[i * 2],
                t2: nextPhaseTeams[i * 2 + 1],
                score1: null,
                score2: null,
                finished: false,
                groupName: nextLabel
            });
        }

        if (nextMatchCount === 1 && App.state.hasThirdPlaceMatch && nextPhaseLosers.length >= 2) {
            nextMatches.push({
                id: `ko_prog_${round.roundNum}_3rd`,
                t1: nextPhaseLosers[0],
                t2: nextPhaseLosers[1],
                score1: null,
                score2: null,
                finished: false,
                groupName: "Disputa de 3º Lugar"
            });
        }

        let newRound = {
            roundNum: App.state.tournament.rounds.length + 1,
            matches: nextMatches,
            isKnockout: true,
            knockoutLabel: nextLabel
        };
        App.state.tournament.rounds.push(newRound);
    },

    editRound: (roundNum) => {
        const round = App.state.tournament.rounds.find(r => r.roundNum === roundNum);
        
        round.matches.forEach(match => {
            if(!match.finished) return;
            
            // Subtrai os stats salvos anteriormente
            const res = Scoring.calculateMatchScore(match.score1, match.score2);
            
            if (App.state.format === 'individual') {
                const dummies = match.dummies || [];
                if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, -res.winsA, -res.sgA, -res.proA, -1);
                if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, -res.winsA, -res.sgA, -res.proA, -1);
                if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, -res.winsB, -res.sgB, -res.proB, -1);
                if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, -res.winsB, -res.sgB, -res.proB, -1);
            } else {
                App.addStatsToPlayer(match.t1.id, -res.winsA, -res.sgA, -res.proA, -1);
                App.addStatsToPlayer(match.t2.id, -res.winsB, -res.sgB, -res.proB, -1);
            }
            
            match.finished = false;
        });
        
        App.saveState();
        App.renderRounds();
        App.renderRanking();
    },

    addStatsToPlayer: (id, wins, sg, pro, matches) => {
        if (!App.state.stats[id]) return;
        App.state.stats[id].wins += wins;
        App.state.stats[id].sg += sg;
        App.state.stats[id].pro += pro;
        App.state.stats[id].matches += matches;
    },

    // --- RANKING ---
    renderRanking: () => {
        let statsArray = Object.values(App.state.stats);
        const container = document.getElementById('ranking-container');
        
        container.innerHTML = '';

        // Pódio Final
        if (App.state.tournament && App.state.tournament.rounds) {
            let finalMatch = App.state.tournament.rounds.flatMap(r => r.matches).find(m => m.groupName === 'Final' && m.finished);
            let semiRound = App.state.tournament.rounds.find(r => r.knockoutLabel === 'Semifinal');

            if (finalMatch) {
                    let first = finalMatch.score1 > finalMatch.score2 ? finalMatch.t1.name : finalMatch.t2.name;
                    let second = finalMatch.score1 > finalMatch.score2 ? finalMatch.t2.name : finalMatch.t1.name;
                    let third = "";

                    if (semiRound) {
                        let thirdMatch = App.state.tournament.rounds.flatMap(r => r.matches).find(m => m.groupName === 'Disputa de 3º Lugar' && m.finished);
                        
                        if (thirdMatch) {
                            third = thirdMatch.score1 > thirdMatch.score2 ? thirdMatch.t1.name : thirdMatch.t2.name;
                        } else {
                            let semiLosers = [];
                            semiRound.matches.forEach(m => {
                                if (m.finished) {
                                    if (m.score1 > m.score2) semiLosers.push(m.t2);
                                    else if (m.score2 > m.score1) semiLosers.push(m.t1);
                                    else semiLosers.push(m.t2);
                                }
                            });

                            if (semiLosers.length >= 2) {
                                let loserStats = semiLosers.map(t => App.state.stats[t.id]).filter(s => s);
                                loserStats = Scoring.sortRanking(loserStats);
                                if (loserStats.length > 0) {
                                    third = loserStats[0].obj.name;
                                }
                            }
                        }
                    }

                    container.innerHTML += `
                        <div class="glass-card pd-0" style="margin-bottom: 25px;">
                            <h3 style="color: var(--sunset-yellow); margin-top: 15px; margin-bottom: 10px; text-align:center; font-size: 1.5rem;">🏆 Pódio Final</h3>
                            <table class="ranking-table" style="margin-bottom: 15px;">
                                <tbody>
                                    <tr style="background: rgba(255, 215, 0, 0.15);"><td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥇</td><td class="player-name" style="font-weight: bold; font-size: 1.2rem; border:none;">${first}</td></tr>
                                    <tr style="background: rgba(192, 192, 192, 0.1);"><td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥈</td><td class="player-name" style="font-weight: bold; font-size: 1.2rem; border:none;">${second}</td></tr>
                                    ${third ? `<tr style="background: rgba(205, 127, 50, 0.1);"><td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥉</td><td class="player-name" style="font-weight: bold; font-size: 1.2rem; border:none;">${third}</td></tr>` : ''}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }

        if (App.state.format === 'groups') {
            App.state.tournament.groups.forEach(group => {
                let groupStats = statsArray.filter(s => group.participants.find(p => p.id === s.obj.id));
                groupStats = Scoring.sortRanking(groupStats);
                
                let tbodyHtml = '';
                groupStats.forEach((stat, index) => {
                    let medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                    let finalScore = (stat.wins * 10) + stat.sg;
                    tbodyHtml += `
                       <tr>
                            <td>${index + 1}</td>
                            <td class="player-name">
                                ${stat.obj.name} 
                                ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome">✏️</button>` : ''}
                                <span class="medal">${medal}</span>
                            </td>
                            <td><strong>${finalScore}</strong></td>
                            <td>${stat.wins}</td>
                            <td>${stat.sg}</td>
                            <td>${stat.pro}</td>
                       </tr> 
                    `;
                });
                
                container.innerHTML += `
                    <h3 style="color: var(--sunset-yellow); margin-top: 20px; margin-bottom: 10px;">${group.name}</h3>
                    <div class="glass-card pd-0">
                        <table class="ranking-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Dupla</th>
                                    <th title="Pontuação Total">Pts</th>
                                    <th title="Vitórias">V</th>
                                    <th title="Saldo de Games">SG</th>
                                    <th title="Games Pró">Pró</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tbodyHtml}
                            </tbody>
                        </table>
                    </div>
                `;
            });
        } else {
            statsArray = Scoring.sortRanking(statsArray);
            
            let tbodyHtml = '';
            statsArray.forEach((stat, index) => {
                let medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                let finalScore = (stat.wins * 10) + stat.sg;
                tbodyHtml += `
                   <tr>
                        <td>${index + 1}</td>
                        <td class="player-name">
                            ${stat.obj.name} 
                            ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome">✏️</button>` : ''}
                            <span class="medal">${medal}</span>
                        </td>
                        <td><strong>${finalScore}</strong></td>
                        <td>${stat.wins}</td>
                        <td>${stat.sg}</td>
                        <td>${stat.pro}</td>
                   </tr> 
                `;
            });
            
            container.innerHTML = `
                <div class="glass-card pd-0">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>${App.state.format === 'individual' ? 'Jogador' : 'Dupla'}</th>
                                <th title="Pontuação Total">Pts</th>
                                <th title="Vitórias">V</th>
                                <th title="Saldo de Games">SG</th>
                                <th title="Games Pró">Pró</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tbodyHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        document.querySelectorAll('.btn-edit-name').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.editPlayerName(e.currentTarget.dataset.id);
            });
        });
    },

    editPlayerName: (id) => {
        if (App.isViewMode) return;
        const stat = App.state.stats[id];
        if (!stat) return;
        
        let oldName = stat.obj.name;
        let newName = prompt("Corrigir nome:", oldName);
        if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
        newName = newName.trim();

        const updateNameInObj = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.id === id && obj.name !== undefined) {
                obj.name = newName;
            }
            for (let key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    updateNameInObj(obj[key]);
                }
            }
        };

        updateNameInObj(App.state);
        App.saveState();
        App.renderRounds();
        App.renderRanking();
    },

    exportCSV: () => {
        let statsArray = Object.values(App.state.stats);
        statsArray = Scoring.sortRanking(statsArray);
        
        let csvContent = "Posicao,Nome,Pontos Totais,Vitorias,Saldo de Games,Games Pro\n";
        
        statsArray.forEach((stat, index) => {
            let finalScore = (stat.wins * 10) + stat.sg;
            let name = stat.obj.name.replace(/"/g, '""');
            csvContent += `${index + 1},"${name}",${finalScore},${stat.wins},${stat.sg},${stat.pro}\n`;
        });
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "classificacao_super8bt.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    exportWhatsApp: () => {
        if (!App.state.tournament || !App.state.tournament.rounds) {
            alert('Não há jogos para exportar.');
            return;
        }

        let text = `🎾 *Resultados do Torneio* 🎾\n\n`;

        App.state.tournament.rounds.forEach(round => {
            text += `🏆 *Rodada ${round.roundNum}*\n`;
            
            round.matches.forEach((match, mIndex) => {
                let t1Name = '';
                let t2Name = '';
                
                if (App.state.format === 'individual') {
                    const dummies = match.dummies || [];
                    let p1 = dummies.includes(match.t1[0].id) ? `${match.t1[0].name} 🃏` : match.t1[0].name;
                    let p2 = dummies.includes(match.t1[1].id) ? `${match.t1[1].name} 🃏` : match.t1[1].name;
                    let p3 = dummies.includes(match.t2[0].id) ? `${match.t2[0].name} 🃏` : match.t2[0].name;
                    let p4 = dummies.includes(match.t2[1].id) ? `${match.t2[1].name} 🃏` : match.t2[1].name;
                    t1Name = `${p1} & ${p2}`;
                    t2Name = `${p3} & ${p4}`;
                } else {
                    t1Name = match.t1.name;
                    t2Name = match.t2.name;
                }

                let s1 = match.score1 !== null ? match.score1 : '-';
                let s2 = match.score2 !== null ? match.score2 : '-';
                
                // Marca quem venceu se o jogo tiver acabado (opcional, deixar negrito)
                let t1Display = t1Name;
                let t2Display = t2Name;
                
                if (match.score1 !== null && match.score2 !== null) {
                    if (match.score1 > match.score2) {
                        t1Display = `*${t1Name}*`;
                    } else if (match.score2 > match.score1) {
                        t2Display = `*${t2Name}*`;
                    }
                }

                text += `${t1Display}  ${s1} x ${s2}  ${t2Display}\n`;
            });
            text += `\n`;
        });

        // Tentar copiar para o clipboard
        navigator.clipboard.writeText(text).then(() => {
            alert('Resultados copiados! Cole no WhatsApp.');
        }).catch(err => {
            alert('Não foi possível copiar automaticamente. Selecione e copie o texto abaixo:\n\n' + text);
            console.error(err);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
