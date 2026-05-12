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
        numCourts: 2
    },

    init: () => {
        App.bindEvents();

        const urlParams = new URLSearchParams(window.location.search);
        const tId = urlParams.get('t');

        if (tId && db) {
            App.isViewMode = true;
            document.getElementById('view-mode-banner').style.display = 'block';
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            
            db.ref('tournaments/' + tId).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    App.state = data;
                    if (App.state.tournament) {
                        App.resumeTournament();
                    }
                } else {
                    alert("Torneio não encontrado ou ID inválido.");
                }
            });
        } else {
            if (App.loadState()) {
                if (App.state.tournament) {
                    App.resumeTournament();
                }
            }
        }
    },

    saveState: () => {
        if (App.isViewMode) return;
        localStorage.setItem('super8bt_state', JSON.stringify(App.state));
        if (App.state.tournamentId && db) {
            db.ref('tournaments/' + App.state.tournamentId).set(App.state);
        }
    },

    loadState: () => {
        try {
            const saved = localStorage.getItem('super8bt_state');
            if (saved) {
                App.state = JSON.parse(saved);
                return true;
            }
        } catch(e) { console.error('Erro ao ler state', e); }
        return false;
    },

    resumeTournament: () => {
        if (App.state.format === 'individual') {
            document.getElementById('rank-name-col').innerText = 'Jogador';
        } else {
            document.getElementById('rank-name-col').innerText = 'Dupla';
        }
        App.renderRounds();
        App.renderRanking();
        App.switchScreen('tournament-screen');
    },

    bindEvents: () => {
        // Format Setup
        document.getElementById('format-individual').addEventListener('click', () => App.selectFormat('individual'));
        document.getElementById('format-fixed').addEventListener('click', () => App.selectFormat('fixed'));
        document.getElementById('num-players-input').addEventListener('input', App.validateFormatSetup);
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
            if (confirm("Tem certeza que deseja apagar os dados e o andamento deste torneio?")) {
                localStorage.removeItem('super8bt_state');
                location.reload();
            }
        });

        // Export
        document.getElementById('btn-export-csv').addEventListener('click', App.exportCSV);

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
        
        numSetup.style.display = 'block';
        
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
        } else if (App.state.format === 'fixed') {
            btn.disabled = isNaN(val) || val < 4 || val % 2 !== 0;
        } else {
            btn.disabled = true;
        }
    },

    goToPlayersScreen: () => {
        const numInput = document.getElementById('num-players-input');
        App.state.numPlayers = parseInt(numInput.value);

        const numCourtsInput = document.getElementById('num-courts-input');
        App.state.numCourts = parseInt(numCourtsInput.value) || 1;

        const modeRadio = document.querySelector('input[name="fixed_mode"]:checked');
        App.state.fixedRegistrationMode = (App.state.format === 'fixed' && modeRadio) ? modeRadio.value : 'individual';

        // Re-render inputs in case format changed
        App.renderPlayerInputs();
        App.validatePlayers();
        
        if (App.state.format === 'individual') {
            document.getElementById('players-title').innerText = `Elenco (${App.state.numPlayers} Jogadores)`;
            document.querySelector('#setup-players-screen p').innerHTML = 'Cadastre os jogadores. Marque a estrela ⭐ para sinalizar os <strong>Cabeças de Chave</strong>.';
        } else {
            if (App.state.fixedRegistrationMode === 'predefined') {
                document.getElementById('players-title').innerText = `Elenco (${App.state.numPlayers/2} Duplas Prontas)`;
                document.querySelector('#setup-players-screen p').innerHTML = 'Cadastre o nome de cada dupla.';
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
        
        if (App.state.format === 'fixed' && App.state.fixedRegistrationMode === 'predefined') {
            const numPairs = App.state.numPlayers / 2;
            for(let i=0; i<numPairs; i++) {
                container.innerHTML += `
                    <div class="player-input-row">
                        <span class="player-num">${i+1}.</span>
                        <input type="text" class="p-input" data-index="${i}" placeholder="Nome da Dupla ${i+1} (ex: João & Maria)">
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
        
        if (App.state.format === 'fixed' && App.state.fixedRegistrationMode === 'predefined') {
            App.state.fixedPairs = [];
            for(let i=0; i<inputs.length; i++) {
                App.state.fixedPairs.push({
                    id: `pair_${i}`,
                    name: inputs[i].value.trim(),
                    p1: { name: inputs[i].value.trim(), isSeed: false }, 
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

        if (App.state.format === 'individual') {
            App.state.tournament = IndividualMode.generateRounds(App.state.players);
            document.getElementById('rank-name-col').innerText = 'Jogador';
        } else {
            App.state.tournament = RoundRobin.generateSubArrays(App.state.fixedPairs);
            document.getElementById('rank-name-col').innerText = 'Dupla';
        }

        App.saveState();
        App.renderRounds();
        App.renderRanking();
        App.switchScreen('tournament-screen');
    },

    initStats: () => {
        App.state.stats = {};
        if (App.state.format === 'individual') {
            App.state.players.forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0 };
            });
        } else {
            App.state.fixedPairs.forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0 };
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

                let courtNum = (mIndex % (App.state.numCourts || 1)) + 1;

                let isReadonly = App.isViewMode || match.finished ? 'disabled' : '';

                return `
                    <div class="match-card" id="${match.id}">
                        <div class="match-teams">
                            <div class="team"><span>${t1Name}</span></div>
                            <div class="vs-badge">VS</div>
                            <div class="team"><span>${t2Name}</span></div>
                        </div>
                        <div class="match-score">
                            <div class="court-badge">Quadra ${courtNum}</div>
                            <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="1" ${isReadonly} value="${match.score1 !== null ? match.score1 : ''}">
                            <span class="vs">X</span>
                            <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="2" ${isReadonly} value="${match.score2 !== null ? match.score2 : ''}">
                        </div>
                    </div>
                `;
            }).join('');

            const allFinished = round.matches.length > 0 && round.matches.every(m => m.finished);

            let actionHtml = '';
            if (!App.isViewMode) {
                actionHtml = allFinished 
                    ? `<button class="btn-edit-round btn-secondary" data-rn="${round.roundNum}" style="padding:5px 12px;font-size:0.8rem;width:auto;">✏️ Editar</button>`
                    : `<button class="btn-finish-round" data-rn="${round.roundNum}">Salvar Rodada</button>`;
            }

            container.innerHTML += `
               <div class="round-block">
                    <div class="round-header">
                        <h3>Rodada ${round.roundNum}</h3>
                        ${actionHtml}
                    </div>
                    ${matchesHtml}
               </div> 
            `;
        });

        document.querySelectorAll('.btn-finish-round').forEach(btn => {
            btn.addEventListener('click', (e) => App.finishRound(parseInt(e.target.dataset.rn)));
        });
        document.querySelectorAll('.btn-edit-round').forEach(btn => {
            btn.addEventListener('click', (e) => App.editRound(parseInt(e.target.dataset.rn)));
        });
    },

    finishRound: (roundNum) => {
        const round = App.state.tournament.rounds.find(r => r.roundNum === roundNum);
        let error = false;

        round.matches.forEach(match => {
            if(match.finished) return;

            const input1 = document.querySelector(`.score-input[data-mid="${match.id}"][data-team="1"]`);
            const input2 = document.querySelector(`.score-input[data-mid="${match.id}"][data-team="2"]`);
            
            const s1 = parseInt(input1.value);
            const s2 = parseInt(input2.value);

            if (isNaN(s1) || isNaN(s2)) {
                error = true;
            } else {
                match.score1 = s1;
                match.score2 = s2;
                match.finished = true;
                
                const res = Scoring.calculateMatchScore(s1, s2);
                
                if (App.state.format === 'individual') {
                    const dummies = match.dummies || [];
                    if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, res.winsA, res.sgA, res.proA);
                    if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, res.winsA, res.sgA, res.proA);
                    if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, res.winsB, res.sgB, res.proB);
                    if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, res.winsB, res.sgB, res.proB);
                } else {
                    App.addStatsToPlayer(match.t1.id, res.winsA, res.sgA, res.proA);
                    App.addStatsToPlayer(match.t2.id, res.winsB, res.sgB, res.proB);
                }
            }
        });

        if (error) {
            alert("Preencha todos os placares da rodada para salvá-la.");
            return;
        }

        App.saveState();
        App.renderRounds(); 
        App.switchTab('tab-ranking');
    },

    editRound: (roundNum) => {
        const round = App.state.tournament.rounds.find(r => r.roundNum === roundNum);
        
        round.matches.forEach(match => {
            if(!match.finished) return;
            
            // Subtrai os stats salvos anteriormente
            const res = Scoring.calculateMatchScore(match.score1, match.score2);
            
            if (App.state.format === 'individual') {
                const dummies = match.dummies || [];
                if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, -res.winsA, -res.sgA, -res.proA);
                if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, -res.winsA, -res.sgA, -res.proA);
                if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, -res.winsB, -res.sgB, -res.proB);
                if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, -res.winsB, -res.sgB, -res.proB);
            } else {
                App.addStatsToPlayer(match.t1.id, -res.winsA, -res.sgA, -res.proA);
                App.addStatsToPlayer(match.t2.id, -res.winsB, -res.sgB, -res.proB);
            }
            
            match.finished = false;
        });
        
        App.saveState();
        App.renderRounds();
        App.renderRanking();
    },

    addStatsToPlayer: (id, wins, sg, pro) => {
        if (!App.state.stats[id]) return;
        App.state.stats[id].wins += wins;
        App.state.stats[id].sg += sg;
        App.state.stats[id].pro += pro;
    },

    // --- RANKING ---
    renderRanking: () => {
        let statsArray = Object.values(App.state.stats);
        statsArray = Scoring.sortRanking(statsArray);

        const tbody = document.getElementById('ranking-body');
        tbody.innerHTML = '';

        statsArray.forEach((stat, index) => {
            let medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
            let finalScore = (stat.wins * 10) + stat.sg;
            tbody.innerHTML += `
               <tr>
                    <td>${index + 1}</td>
                    <td class="player-name">${stat.obj.name} <span class="medal">${medal}</span></td>
                    <td><strong>${finalScore}</strong></td>
                    <td>${stat.wins}</td>
                    <td>${stat.sg}</td>
                    <td>${stat.pro}</td>
               </tr> 
            `;
        });
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
        
        // Add BOM for Excel UTF-8 compatibility
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "classificacao_super8bt.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
