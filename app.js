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
        format: null, // 'individual', 'fixed', 'groups', 'knockout', or 'teams'
        numPlayers: 8,
        numTeams: 2,
        pairsPerTeam: 3,
        teams: [],
        teamStats: {},
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
        } else if (App.state.format === 'teams') {
            document.getElementById('rank-name-col').innerText = 'Equipe';
        } else {
            document.getElementById('rank-name-col').innerText = 'Dupla';
        }
        
        const btnKnockout = document.getElementById('btn-generate-knockout');
        if (btnKnockout) {
            btnKnockout.style.display = (App.state.format === 'groups' && !App.isViewMode) ? 'inline-block' : 'none';
        }

        App.renderTeamsLiveScoreboard();
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
        const fmtTeams = document.getElementById('format-teams');
        if (fmtTeams) fmtTeams.addEventListener('click', () => App.selectFormat('teams'));

        document.getElementById('num-players-input').addEventListener('input', App.validateFormatSetup);
        document.getElementById('num-groups-input').addEventListener('input', App.validateFormatSetup);
        const numTeamsInp = document.getElementById('num-teams-input');
        if (numTeamsInp) numTeamsInp.addEventListener('input', App.validateFormatSetup);
        const pairsPerTeamInp = document.getElementById('num-pairs-per-team-input');
        if (pairsPerTeamInp) pairsPerTeamInp.addEventListener('input', App.validateFormatSetup);

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
        const targetCard = document.getElementById(`format-${formatType}`);
        if (targetCard) targetCard.classList.add('selected');
        
        const numSetup = document.getElementById('num-players-setup');
        const numInput = document.getElementById('num-players-input');
        const numHint = document.getElementById('num-players-hint');
        const fixedModeSel = document.getElementById('fixed-mode-selection');
        const groupsSetup = document.getElementById('groups-setup');
        const knockoutOptions = document.getElementById('knockout-options');
        const teamsSetup = document.getElementById('teams-setup');
        const playersLabel = document.querySelector('label[for="num-players-input"]');
        
        numSetup.style.display = 'block';
        if (groupsSetup) groupsSetup.style.display = (formatType === 'groups') ? 'block' : 'none';
        if (knockoutOptions) knockoutOptions.style.display = (formatType === 'groups' || formatType === 'knockout') ? 'block' : 'none';
        if (teamsSetup) teamsSetup.style.display = (formatType === 'teams') ? 'block' : 'none';
        
        const individualSetup = document.getElementById('individual-setup');
        if (individualSetup) individualSetup.style.display = (formatType === 'individual') ? 'block' : 'none';
        
        if (formatType === 'teams') {
            if (playersLabel) playersLabel.style.display = 'none';
            numInput.style.display = 'none';
            numHint.style.display = 'none';
            fixedModeSel.style.display = 'none';
        } else if (formatType === 'individual') {
            if (playersLabel) playersLabel.style.display = 'block';
            numInput.style.display = 'inline-block';
            numHint.style.display = 'block';
            numInput.value = 8;
            numInput.step = 1;
            numHint.innerText = '* Na modalidade individual, o número de atletas deve ser no mínimo 4.';
            fixedModeSel.style.display = 'none';
        } else {
            if (playersLabel) playersLabel.style.display = 'block';
            numInput.style.display = 'inline-block';
            numHint.style.display = 'block';
            numInput.value = 16;
            numInput.step = 2;
            numHint.innerText = '* O número de atletas deve ser par (para formar as duplas).';
            fixedModeSel.style.display = 'block';
        }
        
        App.validateFormatSetup();
    },

    validateFormatSetup: () => {
        const btn = document.getElementById('btn-next-to-players');
        
        if (App.state.format === 'teams') {
            const numTeamsInp = document.getElementById('num-teams-input');
            const pairsPerTeamInp = document.getElementById('num-pairs-per-team-input');
            const teamsHint = document.getElementById('teams-summary-hint');
            
            const nTeams = parseInt(numTeamsInp.value);
            const nPairs = parseInt(pairsPerTeamInp.value);
            
            const valid = !isNaN(nTeams) && nTeams >= 2 && !isNaN(nPairs) && nPairs >= 1;
            btn.disabled = !valid;
            
            if (valid && teamsHint) {
                const totalPairs = nTeams * nPairs;
                const totalAthletes = totalPairs * 2;
                const matchesPerPair = (nTeams - 1) * nPairs;
                const totalMatches = ((nTeams * (nTeams - 1)) / 2) * (nPairs * nPairs);
                teamsHint.innerHTML = `🛡️ <strong>${nTeams} equipes</strong> com <strong>${nPairs} duplas</strong> cada = ${totalPairs} duplas (${totalAthletes} atletas).<br>🎾 Cada dupla jogará <strong>${matchesPerPair} partidas</strong>.<br>🔥 <strong>Total de ${totalMatches} jogos</strong> no torneio.`;
            }
            return;
        }

        const numInput = document.getElementById('num-players-input');
        const val = parseInt(numInput.value);
        
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
        const numCourtsInput = document.getElementById('num-courts-input');
        const parsedCourts = parseInt(numCourtsInput.value);
        App.state.numCourts = (!isNaN(parsedCourts) && parsedCourts >= 0) ? parsedCourts : 0;
        
        if (App.state.format === 'teams') {
            App.state.numTeams = parseInt(document.getElementById('num-teams-input').value) || 2;
            App.state.pairsPerTeam = parseInt(document.getElementById('num-pairs-per-team-input').value) || 3;
            App.state.numPlayers = App.state.numTeams * App.state.pairsPerTeam * 2;
            
            document.getElementById('players-title').innerText = `Cadastro das Equipes (${App.state.numTeams} Times)`;
            document.querySelector('#setup-players-screen p').innerHTML = `Personalize o nome da equipe e cadastre as duplas de cada time (${App.state.pairsPerTeam} duplas por time).`;
            
            App.renderPlayerInputs();
            App.validatePlayers();
            App.switchScreen('setup-players-screen');
            return;
        }

        const numInput = document.getElementById('num-players-input');
        App.state.numPlayers = parseInt(numInput.value);

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
        
        const btnNext = document.getElementById('btn-next-to-pairs');

        if (App.state.format === 'teams') {
            if (btnNext) btnNext.innerText = 'Iniciar Torneio de Equipes 🔥';

            const defaultTeamConfigs = [
                { name: "Time Tubarões", color: "#FF7B00" }, // Laranja
                { name: "Time Leões", color: "#00D2FF" },    // Azul/Ciano
                { name: "Time Panteras", color: "#00E676" }, // Verde Neon
                { name: "Time Falcões", color: "#FFD600" },  // Amarelo Sol
                { name: "Time Tigres", color: "#FF1744" },   // Vermelho
                { name: "Time Águias", color: "#D500F9" },   // Roxo
                { name: "Time Lobos", color: "#1DE9B6" },    // Teal
                { name: "Time Ursos", color: "#FF9100" }     // Âmbar
            ];

            for (let t = 0; t < App.state.numTeams; t++) {
                const cfg = defaultTeamConfigs[t % defaultTeamConfigs.length];
                const teamName = cfg.name;
                const teamColor = cfg.color;

                let pairsHtml = '';
                for (let d = 0; d < App.state.pairsPerTeam; d++) {
                    pairsHtml += `
                        <div class="player-input-row" style="margin-bottom: 8px;">
                            <span class="player-num" style="color: ${teamColor}; font-weight: bold;">${d + 1}.</span>
                            <input type="text" class="p-input team-pair-input" data-team="${t}" data-pair="${d}" placeholder="Nome da Dupla ${d + 1} (ex: Jogador 1 & Jogador 2)">
                        </div>
                    `;
                }

                container.innerHTML += `
                    <div class="team-setup-card" data-team="${t}" style="background: rgba(0,0,0,0.25); border: 1px solid ${teamColor}; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                            <span style="font-size: 1.3rem;">🛡️</span>
                            <input type="text" class="team-name-input" data-team="${t}" value="${teamName}" placeholder="Nome da Equipe ${t + 1}" style="flex: 1; font-weight: bold; font-size: 1.05rem; color: ${teamColor}; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px 12px; outline: none;">
                            <input type="color" class="team-color-input" data-team="${t}" value="${teamColor}" style="width: 38px; height: 38px; border: none; border-radius: 6px; cursor: pointer; background: transparent;" title="Escolher cor da equipe">
                        </div>
                        <p style="text-align: left; font-size: 0.85rem; color: var(--sand-secondary); margin-bottom: 8px;">Duplas desta Equipe:</p>
                        <div class="team-pairs-list">
                            ${pairsHtml}
                        </div>
                    </div>
                `;
            }
            return;
        }

        if (btnNext) btnNext.innerText = 'Continuar';

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

        if (App.state.format === 'teams') {
            document.querySelectorAll('.team-name-input').forEach(inp => {
                if (inp.value.trim() === '') allFilled = false;
            });
        }

        document.getElementById('btn-next-to-pairs').disabled = !allFilled;
    },

    processPlayers: () => {
        // Collect players or predefined pairs
        const inputs = document.querySelectorAll('.p-input');
        
        if (App.state.format === 'teams') {
            App.state.teams = [];
            for (let t = 0; t < App.state.numTeams; t++) {
                const nameInp = document.querySelector(`.team-name-input[data-team="${t}"]`);
                const colorInp = document.querySelector(`.team-color-input[data-team="${t}"]`);
                const teamName = (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : `Equipe ${t + 1}`;
                const teamColor = (colorInp && colorInp.value) ? colorInp.value : '#FF7B00';

                let pairs = [];
                for (let d = 0; d < App.state.pairsPerTeam; d++) {
                    const pairInp = document.querySelector(`.team-pair-input[data-team="${t}"][data-pair="${d}"]`);
                    const pairName = (pairInp && pairInp.value.trim()) ? pairInp.value.trim() : `Dupla ${d + 1}`;
                    pairs.push({
                        id: `team_${t}_pair_${d}`,
                        name: pairName,
                        teamId: `team_${t}`,
                        teamName: teamName,
                        teamColor: teamColor,
                        p1: { name: pairName },
                        p2: { name: '' }
                    });
                }

                App.state.teams.push({
                    id: `team_${t}`,
                    name: teamName,
                    color: teamColor,
                    pairs: pairs
                });
            }

            App.startTournament();
            return;
        }

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
    
    autoAssignCourts: () => {
        const numCourts = App.state.numCourts || 0;
        if (numCourts <= 0 || !App.state.tournament || !App.state.tournament.rounds) return;

        // Descobrir quais quadras (1..numCourts) estão ocupadas por partidas em andamento
        let occupiedCourts = new Set();
        App.state.tournament.rounds.forEach(r => {
            r.matches.forEach(m => {
                if (!m.finished && m.court && m.court > 0 && m.court <= numCourts) {
                    occupiedCourts.add(m.court);
                }
            });
        });

        // Para cada quadra livre, pega o primeiro jogo na fila e coloca nela
        for (let c = 1; c <= numCourts; c++) {
            if (!occupiedCourts.has(c)) {
                // Procurar próxima partida sem quadra e não finalizada
                let assigned = false;
                for (const r of App.state.tournament.rounds) {
                    for (const m of r.matches) {
                        if (!m.finished && !m.court) {
                            m.court = c;
                            occupiedCourts.add(c);
                            assigned = true;
                            break;
                        }
                    }
                    if (assigned) break;
                }
            }
        }
    },

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
        } else if (App.state.format === 'teams') {
            App.state.tournament = TeamsMode.generateRounds(App.state.teams, App.state.numCourts);
            document.getElementById('rank-name-col').innerText = 'Equipe';
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

        // Controle manual via seletor
        App.saveState();
        
        const newUrl = window.location.pathname + '?admin=' + App.state.tournamentId;
        window.history.pushState({path:newUrl}, '', newUrl);

        App.renderTeamsLiveScoreboard();
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
        } else if (App.state.format === 'teams') {
            App.state.teamStats = {};
            App.state.teams.forEach(t => {
                App.state.teamStats[t.id] = {
                    team: t,
                    wins: 0,
                    losses: 0,
                    sg: 0,
                    pro: 0,
                    against: 0,
                    matches: 0
                };
                t.pairs.forEach(p => {
                    App.state.stats[p.id] = {
                        obj: p,
                        team: t,
                        wins: 0,
                        losses: 0,
                        sg: 0,
                        pro: 0,
                        against: 0,
                        matches: 0
                    };
                });
            });
        } else {
            App.state.fixedPairs.forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0, matches: 0 };
            });
        }
    },

    renderCourtsDashboard: () => { return;

        const container = document.getElementById('courts-dashboard');
        if (!container) return;

        const numCourts = App.state.numCourts || 0;
        if (numCourts === 0 || !App.state.tournament || !App.state.tournament.rounds) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'block';

        // Mapear partidas ocupando quadras atualmente
        let busyCourts = {};
        let waitingMatches = [];

        App.state.tournament.rounds.forEach(round => {
            round.matches.forEach(m => {
                if (!m.finished) {
                    if (m.court && m.court > 0 && m.court <= numCourts) {
                        busyCourts[m.court] = m;
                    } else if (!m.court) {
                        waitingMatches.push(m);
                    }
                }
            });
        });

        let courtsCardsHtml = '';
        for (let c = 1; c <= numCourts; c++) {
            const match = busyCourts[c];
            if (match) {
                let p1 = match.t1.name;
                let p2 = match.t2.name;
                if (App.state.format === 'teams') {
                    p1 = `[${match.team1Name}] ${match.t1.name}`;
                    p2 = `[${match.team2Name}] ${match.t2.name}`;
                }

                courtsCardsHtml += `
                    <div class="court-card busy" style="background: rgba(255, 123, 0, 0.08); border: 1px solid var(--sunset-orange); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-weight: 800; font-size: 0.95rem; color: var(--sunset-orange);">🎾 Quadra ${c}</span>
                            <span style="font-size: 0.7rem; font-weight: 700; background: var(--sunset-orange); color: #fff; padding: 2px 6px; border-radius: 4px;">EM JOGO</span>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: #fff; margin-bottom: 8px; line-height: 1.3;">
                            ${p1} <span style="color: var(--sunset-yellow);">x</span> ${p2}
                        </div>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="btn-focus-match" data-mid="${match.id}" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); color: var(--sand-primary); font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer;">⚡ Ver Jogo</button>
                            ${!App.isViewMode ? `<button class="btn-release-court-card" data-mid="${match.id}" style="background: rgba(230, 57, 70, 0.2); border: 1px solid var(--sunset-red); color: #ff6b6b; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Liberar quadra">✕ Desocupar</button>` : ''}
                        </div>
                    </div>
                `;
            } else {
                // Quadra livre
                let nextMatchBtnHtml = '';
                if (waitingMatches.length > 0 && !App.isViewMode) {
                    const nextM = waitingMatches[0];
                    let nextP1 = nextM.t1.name;
                    let nextP2 = nextM.t2.name;
                    if (App.state.format === 'teams') {
                        nextP1 = `[${nextM.team1Name}] ${nextM.t1.name}`;
                        nextP2 = `[${nextM.team2Name}] ${nextM.t2.name}`;
                    }

                    nextMatchBtnHtml = `
                        <button class="btn-call-next-court" data-court="${c}" style="background: linear-gradient(135deg, #00E676, #00B0FF); border: none; color: #000; font-weight: 700; font-size: 0.75rem; padding: 6px 10px; border-radius: 6px; cursor: pointer; width: 100%; margin-top: 6px;" title="Chamar próximo jogo para esta quadra">
                            ➕ Chamar Próximo: ${nextP1} x ${nextP2}
                        </button>
                    `;
                } else {
                    nextMatchBtnHtml = `
                        <div style="font-size: 0.75rem; color: var(--sand-secondary); margin-top: 4px;">Fila vazia</div>
                    `;
                }

                courtsCardsHtml += `
                    <div class="court-card free" style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.4); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-weight: 800; font-size: 0.95rem; color: #4ade80;">🟢 Quadra ${c}</span>
                            <span style="font-size: 0.7rem; font-weight: 700; background: rgba(74, 222, 128, 0.2); color: #4ade80; padding: 2px 6px; border-radius: 4px;">LIVRE</span>
                        </div>
                        ${nextMatchBtnHtml}
                    </div>
                `;
            }
        }

        container.innerHTML = `
            <div class="glass-card" style="padding: 16px; border-radius: 14px; background: rgba(10, 25, 47, 0.85); border: 1px solid var(--glass-border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--sunset-yellow);">
                        🎾 Fila Dinâmica de Quadras (${numCourts} Quadras)
                    </div>
                    <div style="font-size: 0.8rem; color: var(--sand-secondary);">
                        Aguardando na fila: <strong>${waitingMatches.length} jogos</strong>
                    </div>
                </div>
                <div class="courts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px;">
                    ${courtsCardsHtml}
                </div>
            </div>
        `;

        // Event listeners
        container.querySelectorAll('.btn-focus-match').forEach(btn => {
            btn.addEventListener('click', (e) => App.scrollToMatch(e.currentTarget.dataset.mid));
        });
        container.querySelectorAll('.btn-release-court-card').forEach(btn => {
            btn.addEventListener('click', (e) => App.releaseCourt(e.currentTarget.dataset.mid));
        });
        container.querySelectorAll('.btn-call-next-court').forEach(btn => {
            btn.addEventListener('click', (e) => App.callNextToCourt(parseInt(e.currentTarget.dataset.court)));
        });
    },

    assignCourt: (matchId, courtNum) => {
        if (App.isViewMode || !App.state.tournament || !App.state.tournament.rounds) return;

        // Se outra partida já estiver nesta quadra e não estiver finalizada, desocupa a anterior
        if (courtNum > 0) {
            App.state.tournament.rounds.forEach(r => {
                r.matches.forEach(m => {
                    if (m.id !== matchId && m.court === courtNum && !m.finished) {
                        m.court = null;
                    }
                });
            });
        }

        // Atribui à partida alvo
        let found = false;
        for (const r of App.state.tournament.rounds) {
            const m = r.matches.find(x => x.id === matchId);
            if (m) {
                m.court = courtNum > 0 ? courtNum : null;
                found = true;
                break;
            }
        }

        if (found) {
            App.saveState();
            App.renderCourtsDashboard();
            App.renderRounds();
        }
    },

    releaseCourt: (matchId) => {
        App.assignCourt(matchId, 0);
    },

    callNextToCourt: (courtNum) => {
        if (App.isViewMode || !App.state.tournament || !App.state.tournament.rounds) return;

        let nextMatch = null;
        for (const r of App.state.tournament.rounds) {
            for (const m of r.matches) {
                if (!m.finished && !m.court) {
                    nextMatch = m;
                    break;
                }
            }
            if (nextMatch) break;
        }

        if (nextMatch) {
            App.assignCourt(nextMatch.id, courtNum);
            App.scrollToMatch(nextMatch.id);
        }
    },

    scrollToMatch: (matchId) => {
        const el = document.getElementById(matchId);
        if (el) {
            if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            el.style.transition = 'box-shadow 0.3s, border-color 0.3s';
            el.style.borderColor = 'var(--sunset-yellow)';
            el.style.boxShadow = '0 0 20px rgba(255, 184, 0, 0.5)';
            setTimeout(() => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            }, 1800);
        }
    },

    renderTeamsLiveScoreboard: () => {
        const board = document.getElementById('teams-live-scoreboard');
        if (!board) return;

        if (App.state.format !== 'teams' || !App.state.teams || !App.state.tournament) {
            board.style.display = 'none';
            board.innerHTML = '';
            return;
        }

        const { teamStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
        App.state.teamStats = teamStats;

        board.style.display = 'block';

        if (App.state.teams.length === 2) {
            const tA = App.state.teams[0];
            const tB = App.state.teams[1];
            const sA = teamStats[tA.id] || { wins: 0, sg: 0, pro: 0, matches: 0 };
            const sB = teamStats[tB.id] || { wins: 0, sg: 0, pro: 0, matches: 0 };

            board.innerHTML = `
                <div class="glass-card" style="padding: 18px; text-align: center; border-radius: 14px; background: rgba(10, 25, 47, 0.85); border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--sunset-yellow); margin-bottom: 12px;">
                        🛡️ Placar Geral das Equipes
                    </div>
                    <div style="display: flex; justify-content: space-around; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 130px; text-align: center;">
                            <div style="font-weight: 800; font-size: 1.15rem; color: ${tA.color}; margin-bottom: 6px;">
                                ${tA.name}
                            </div>
                            <div style="font-size: 2.8rem; font-weight: 800; color: #fff; line-height: 1; font-family: var(--font-heading);">
                                ${sA.wins}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--sand-secondary); margin-top: 6px;">
                                Saldo: <strong style="color: ${sA.sg >= 0 ? 'var(--sunset-yellow)' : '#ff6b6b'};">${sA.sg > 0 ? '+' : ''}${sA.sg}</strong> (${sA.pro} pró)
                            </div>
                        </div>

                        <div style="font-size: 1.6rem; font-weight: 800; color: var(--sunset-orange); padding: 0 10px;">
                            VS
                        </div>

                        <div style="flex: 1; min-width: 130px; text-align: center;">
                            <div style="font-weight: 800; font-size: 1.15rem; color: ${tB.color}; margin-bottom: 6px;">
                                ${tB.name}
                            </div>
                            <div style="font-size: 2.8rem; font-weight: 800; color: #fff; line-height: 1; font-family: var(--font-heading);">
                                ${sB.wins}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--sand-secondary); margin-top: 6px;">
                                Saldo: <strong style="color: ${sB.sg >= 0 ? 'var(--sunset-yellow)' : '#ff6b6b'};">${sB.sg > 0 ? '+' : ''}${sB.sg}</strong> (${sB.pro} pró)
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const sortedTeams = TeamsMode.sortTeamStats(Object.values(teamStats));
            let cardsHtml = sortedTeams.map((ts, idx) => {
                const t = ts.team;
                return `
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid ${t.color}; border-radius: 10px; padding: 12px; text-align: center;">
                        <div style="font-size: 0.95rem; font-weight: 700; color: ${t.color}; margin-bottom: 4px;">
                            ${idx === 0 ? '🥇 ' : ''}${t.name}
                        </div>
                        <div style="font-size: 2rem; font-weight: 800; color: #fff; line-height: 1;">
                            ${ts.wins} <span style="font-size: 0.8rem; font-weight: 400; color: var(--sand-secondary);">Vitórias</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--sand-secondary); margin-top: 4px;">
                            SG: ${ts.sg > 0 ? '+' : ''}${ts.sg} | ${ts.matches} jogos
                        </div>
                    </div>
                `;
            }).join('');

            board.innerHTML = `
                <div class="glass-card" style="padding: 16px; border-radius: 14px; background: rgba(10, 25, 47, 0.85); border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--sunset-yellow); margin-bottom: 12px; text-align: center;">
                        🛡️ Placar Geral das Equipes
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }
    },

    // --- MATCHES RENDER ---
    renderRounds: () => {
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();

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
                } else if (App.state.format === 'teams') {
                    const c1 = match.team1Color || 'var(--sunset-orange)';
                    const c2 = match.team2Color || 'var(--sunset-yellow)';
                    t1Name = `<span style="display:inline-block; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px; margin-right:6px; background:${c1}; color:#fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${match.team1Name}</span> <span>${match.t1.name}</span>`;
                    t2Name = `<span style="display:inline-block; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px; margin-right:6px; background:${c2}; color:#fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${match.team2Name}</span> <span>${match.t2.name}</span>`;
                } else {
                    t1Name = match.t1.name;
                    t2Name = match.t2.name;
                }

                globalMatchIndex++;
                let isReadonly = App.isViewMode || match.finished ? 'disabled' : '';
                let groupLabel = match.groupName ? `<div style="font-size:0.75rem; color:var(--sunset-yellow); margin-bottom:5px; font-weight:bold;">[${match.groupName}]</div>` : '';

                // Componente dinâmico de quadra
                const numCourts = App.state.numCourts || 0;
                let courtBadgeHtml = '';

                if (numCourts === 0) {
                    // Modo livre (sem controle de quadras)
                    courtBadgeHtml = `<div style="font-size: 0.75rem; color: var(--sand-secondary); font-weight: 600;">#Jogo ${globalMatchIndex}</div>`;
                } else {
                    // Seletor prático de quadra para o organizador
                    if (match.finished) {
                        const courtText = match.court ? `Quadra ${match.court}` : "Finalizado";
                        courtBadgeHtml = `<div class="court-badge" style="justify-self: start; background: rgba(255,255,255,0.06); color: var(--sand-secondary); border-color: rgba(255,255,255,0.1); font-size: 0.75rem;">${courtText}</div>`;
                    } else if (App.isViewMode) {
                        if (match.court) {
                            courtBadgeHtml = `<div class="court-badge" style="justify-self: start; background: rgba(74, 222, 128, 0.2); color: #4ade80; border-color: #4ade80; font-weight: 700; font-size: 0.8rem;">🎾 Quadra ${match.court}</div>`;
                        } else {
                            courtBadgeHtml = `<div class="court-badge" style="justify-self: start; background: rgba(255, 123, 0, 0.15); color: var(--sunset-orange); border-color: var(--sunset-orange); font-size: 0.75rem; font-weight: 600;">⏳ Na Fila</div>`;
                        }
                    } else {
                        // Modo Admin: Seletor direto e prático no card
                        let optionsHtml = `<option value="0" ${!match.court ? "selected" : ""}>⏳ Na Fila</option>`;
                        for (let c = 1; c <= numCourts; c++) {
                            const isSel = match.court === c ? "selected" : "";
                            optionsHtml += `<option value="${c}" ${isSel}>🎾 Quadra ${c}</option>`;
                        }
                        const isAssigned = !!match.court;
                        const selectBg = isAssigned ? "rgba(74, 222, 128, 0.2)" : "rgba(255, 123, 0, 0.15)";
                        const selectColor = isAssigned ? "#4ade80" : "var(--sunset-orange)";
                        const selectBorder = isAssigned ? "#4ade80" : "rgba(255, 123, 0, 0.4)";

                        courtBadgeHtml = `
                            <select class="court-select-input" data-mid="${match.id}" style="background: ${selectBg}; color: ${selectColor}; border: 1px solid ${selectBorder}; border-radius: 8px; padding: 4px 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; outline: none;">
                                ${optionsHtml}
                            </select>
                        `;
                    }
                }

                return `
                    <div class="match-card" id="${match.id}">
                        ${groupLabel}
                        <div class="match-teams">
                            <div class="team"><span>${t1Name}</span></div>
                            <div class="vs-badge">VS</div>
                            <div class="team"><span>${t2Name}</span></div>
                        </div>
                        <div class="match-score" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;">
                            <div style="justify-self: start;">${courtBadgeHtml}</div>
                            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                                <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="1" ${isReadonly} value="${match.score1 !== null ? match.score1 : ''}">
                                <span class="vs">X</span>
                                <input type="number" min="0" class="score-input s-out" data-mid="${match.id}" data-team="2" ${isReadonly} value="${match.score2 !== null ? match.score2 : ''}">
                            </div>
                            <div style="justify-self: end;">
                                ${!App.isViewMode && !match.finished ? `<button class="btn-save-match btn-primary" style="padding: 4px 16px; font-size: 0.85rem; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;" data-mid="${match.id}" data-rn="${round.roundNum}">Salvar</button>` : ''}
                                ${!App.isViewMode && match.finished ? `<button class="btn-edit-match btn-secondary" style="padding: 4px 16px; font-size: 0.85rem; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; background:rgba(255,255,255,0.1);" data-mid="${match.id}" data-rn="${round.roundNum}">✏️ Editar</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            let roundTitle = round.isKnockout ? `🏆 ${round.knockoutLabel}` : `Rodada ${round.roundNum}`;

            container.innerHTML += `
               <div class="round-block">
                    <div class="round-header">
                        <h3>${roundTitle}</h3>
                    </div>
                    ${matchesHtml}
               </div> 
            `;
        });

        document.querySelectorAll('.btn-save-match').forEach(btn => {
            btn.addEventListener('click', (e) => App.finishMatch(e.target.dataset.mid, parseInt(e.target.dataset.rn)));
        });
        document.querySelectorAll('.btn-edit-match').forEach(btn => {
            btn.addEventListener('click', (e) => App.editMatch(e.target.dataset.mid, parseInt(e.target.dataset.rn)));
        });

        document.querySelectorAll('.court-select-input').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const cVal = parseInt(e.target.value);
                App.assignCourt(e.target.dataset.mid, (!isNaN(cVal) && cVal > 0) ? cVal : 0);
            });
        });

        document.querySelectorAll('.btn-quick-release').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.releaseCourt(e.currentTarget.dataset.mid);
            });
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
        } else if (App.state.format === 'teams') {
            const { teamStats, pairStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
            App.state.teamStats = teamStats;
            App.state.stats = pairStats;
        } else {
            App.addStatsToPlayer(match.t1.id, res.winsA, res.sgA, res.proA, 1);
            App.addStatsToPlayer(match.t2.id, res.winsB, res.sgB, res.proB, 1);
        }

        // Libera a quadra e chama automaticamente o próximo jogo da fila
        // Controle manual via seletor

        const allFinished = round.matches.length > 0 && round.matches.every(m => m.finished);

        if (allFinished) {
            if (round.isKnockout && round.matches.length > 1 && round.knockoutLabel !== 'Final') {
                App.generateNextKnockoutPhase(round);
            }
        }
        
        App.saveState();
        App.renderTeamsLiveScoreboard();
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

    editMatch: (matchId, roundNum) => {
        const round = App.state.tournament.rounds.find(r => r.roundNum === roundNum);
        const match = round.matches.find(m => m.id === matchId);
        
        if(!match || !match.finished) return;
        
        // Subtrai os stats salvos anteriormente
        const res = Scoring.calculateMatchScore(match.score1, match.score2);
        
        if (App.state.format === 'individual') {
            const dummies = match.dummies || [];
            if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, -res.winsA, -res.sgA, -res.proA, -1);
            if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, -res.winsA, -res.sgA, -res.proA, -1);
            if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, -res.winsB, -res.sgB, -res.proB, -1);
            if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, -res.winsB, -res.sgB, -res.proB, -1);
        } else if (App.state.format === 'teams') {
            match.finished = false;
            const { teamStats, pairStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
            App.state.teamStats = teamStats;
            App.state.stats = pairStats;
        } else {
            App.addStatsToPlayer(match.t1.id, -res.winsA, -res.sgA, -res.proA, -1);
            App.addStatsToPlayer(match.t2.id, -res.winsB, -res.sgB, -res.proB, -1);
        }
        
        match.finished = false;
        
        App.saveState();
        App.renderTeamsLiveScoreboard();
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

        if (App.state.format === 'teams') {
            const { teamStats, pairStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
            App.state.teamStats = teamStats;
            App.state.stats = pairStats;

            let sortedTeamStats = TeamsMode.sortTeamStats(Object.values(teamStats));

            // Pódio das Equipes se houver jogos finalizados
            const anyFinished = App.state.tournament.rounds.some(r => r.matches.some(m => m.finished));
            if (anyFinished && sortedTeamStats.length >= 2) {
                const first = sortedTeamStats[0];
                const second = sortedTeamStats[1];
                const third = sortedTeamStats.length > 2 ? sortedTeamStats[2] : null;

                container.innerHTML += `
                    <div class="glass-card pd-0" style="margin-bottom: 25px;">
                        <h3 style="color: var(--sunset-yellow); margin-top: 15px; margin-bottom: 10px; text-align:center; font-size: 1.4rem;">🏆 Pódio das Equipes</h3>
                        <table class="ranking-table" style="margin-bottom: 15px;">
                            <tbody>
                                <tr style="background: rgba(255, 215, 0, 0.15);">
                                    <td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥇</td>
                                    <td class="player-name" style="font-weight: bold; font-size: 1.15rem; color: ${first.team.color}; border:none;">
                                        ${first.team.name} <span style="font-size:0.85rem; font-weight:normal; color:var(--sand-secondary);">(${first.wins} vitórias, SG ${first.sg > 0 ? '+' : ''}${first.sg})</span>
                                    </td>
                                </tr>
                                <tr style="background: rgba(192, 192, 192, 0.1);">
                                    <td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥈</td>
                                    <td class="player-name" style="font-weight: bold; font-size: 1.15rem; color: ${second.team.color}; border:none;">
                                        ${second.team.name} <span style="font-size:0.85rem; font-weight:normal; color:var(--sand-secondary);">(${second.wins} vitórias, SG ${second.sg > 0 ? '+' : ''}${second.sg})</span>
                                    </td>
                                </tr>
                                ${third ? `
                                <tr style="background: rgba(205, 127, 50, 0.1);">
                                    <td style="width: 60px; font-size: 1.8rem; text-align:center; border:none;">🥉</td>
                                    <td class="player-name" style="font-weight: bold; font-size: 1.15rem; color: ${third.team.color}; border:none;">
                                        ${third.team.name} <span style="font-size:0.85rem; font-weight:normal; color:var(--sand-secondary);">(${third.wins} vitórias, SG ${third.sg > 0 ? '+' : ''}${third.sg})</span>
                                    </td>
                                </tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // Tabela 1: Classificação Geral das Equipes
            let teamsBodyHtml = '';
            sortedTeamStats.forEach((ts, index) => {
                const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                const t = ts.team;
                const totalGames = ts.pro + ts.against;
                const eff = totalGames > 0 ? Math.round((ts.pro / totalGames) * 100) : 0;

                teamsBodyHtml += `
                    <tr>
                        <td><strong>${index + 1}</strong></td>
                        <td class="player-name" style="font-weight: 700; color: ${t.color};">
                            ${t.name}
                            ${!App.isViewMode ? `<button class="btn-edit-team-name" data-team-id="${t.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome da Equipe">✏️</button>` : ''}
                            <span class="medal">${medal}</span>
                        </td>
                        <td><strong>${ts.matches}</strong></td>
                        <td style="color: var(--sunset-yellow); font-weight: 700;">${ts.wins}</td>
                        <td>${ts.losses}</td>
                        <td style="color: ${ts.sg >= 0 ? '#4ade80' : '#f87171'}; font-weight: 600;">${ts.sg > 0 ? '+' : ''}${ts.sg}</td>
                        <td>${ts.pro}</td>
                        <td>${ts.against}</td>
                        <td>${eff}%</td>
                    </tr>
                `;
            });

            container.innerHTML += `
                <h3 style="color: var(--sunset-yellow); margin-top: 10px; margin-bottom: 10px; text-align: left;">🛡️ Classificação das Equipes</h3>
                <div class="glass-card pd-0" style="margin-bottom: 30px;">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Equipe</th>
                                <th title="Jogos Disputados">J</th>
                                <th title="Vitórias">V</th>
                                <th title="Derrotas">D</th>
                                <th title="Saldo de Games">SG</th>
                                <th title="Games Pró">Pró</th>
                                <th title="Games Contra">Contra</th>
                                <th title="Aproveitamento">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teamsBodyHtml}
                        </tbody>
                    </table>
                </div>
            `;

            // Tabela 2: Desempenho Individual das Duplas
            let pairsList = Object.values(pairStats).map(p => ({ obj: p.pair, ...p }));
            pairsList = Scoring.sortRanking(pairsList);

            let pairsBodyHtml = '';
            pairsList.forEach((stat, index) => {
                const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                const tColor = stat.team ? stat.team.color : 'var(--sunset-orange)';
                const tName = stat.team ? stat.team.name : '';

                pairsBodyHtml += `
                    <tr>
                        <td>${index + 1}</td>
                        <td class="player-name">
                            <span style="display:inline-block; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px; margin-right:6px; background:${tColor}; color:#fff;">${tName}</span>
                            ${stat.obj.name}
                            ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome da Dupla">✏️</button>` : ''}
                            <span class="medal">${medal}</span>
                        </td>
                        <td><strong>${stat.matches || 0}</strong></td>
                        <td>${stat.wins}</td>
                        <td>${stat.sg}</td>
                        <td>${stat.pro}</td>
                    </tr>
                `;
            });

            container.innerHTML += `
                <h3 style="color: var(--sunset-yellow); margin-top: 20px; margin-bottom: 10px; text-align: left;">🎾 Desempenho das Duplas</h3>
                <div class="glass-card pd-0">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Dupla</th>
                                <th title="Jogos Disputados">J</th>
                                <th title="Vitórias">V</th>
                                <th title="Saldo de Games">SG</th>
                                <th title="Games Pró">Pró</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pairsBodyHtml}
                        </tbody>
                    </table>
                </div>
            `;

            document.querySelectorAll('.btn-edit-team-name').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    App.editTeamName(e.currentTarget.dataset.teamId);
                });
            });
        } else if (App.state.format === 'groups') {
            App.state.tournament.groups.forEach(group => {
                let groupStats = statsArray.filter(s => group.participants.find(p => p.id === s.obj.id));
                groupStats = Scoring.sortRanking(groupStats);
                
                let tbodyHtml = '';
                groupStats.forEach((stat, index) => {
                    let medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
                    let matches = stat.matches || 0;
                    tbodyHtml += `
                       <tr>
                            <td>${index + 1}</td>
                            <td class="player-name">
                                ${stat.obj.name} 
                                ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome">✏️</button>` : ''}
                                <span class="medal">${medal}</span>
                            </td>
                            <td><strong>${matches}</strong></td>
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
                                    <th title="Jogos Disputados">J</th>
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
                let matches = stat.matches || 0;
                tbodyHtml += `
                   <tr>
                        <td>${index + 1}</td>
                        <td class="player-name">
                            ${stat.obj.name} 
                            ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; margin-left:5px;" title="Editar Nome">✏️</button>` : ''}
                            <span class="medal">${medal}</span>
                        </td>
                        <td><strong>${matches}</strong></td>
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
                                <th title="Jogos Disputados">J</th>
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

    editTeamName: (teamId) => {
        if (App.isViewMode) return;
        const team = App.state.teams ? App.state.teams.find(t => t.id === teamId) : null;
        if (!team) return;

        let newName = prompt("Corrigir nome da equipe:", team.name);
        if (!newName || newName.trim() === '' || newName.trim() === team.name) return;
        newName = newName.trim();

        team.name = newName;
        if (App.state.tournament && App.state.tournament.rounds) {
            App.state.tournament.rounds.forEach(r => {
                r.matches.forEach(m => {
                    if (m.team1Id === teamId) m.team1Name = newName;
                    if (m.team2Id === teamId) m.team2Name = newName;
                    if (m.t1 && m.t1.teamId === teamId) m.t1.teamName = newName;
                    if (m.t2 && m.t2.teamId === teamId) m.t2.teamName = newName;
                });
            });
        }
        if (team.pairs) {
            team.pairs.forEach(p => p.teamName = newName);
        }

        App.saveState();
        App.renderTeamsLiveScoreboard();
        App.renderRounds();
        App.renderRanking();
    },

    exportCSV: () => {
        let csvContent = "";

        if (App.state.format === 'teams') {
            const { teamStats, pairStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
            const sortedTeams = TeamsMode.sortTeamStats(Object.values(teamStats));
            
            csvContent += "CLASSIFICACAO DAS EQUIPES\nPosicao,Equipe,Jogos,Vitorias,Derrotas,Saldo de Games,Games Pro,Games Contra,Aproveitamento\n";
            sortedTeams.forEach((ts, index) => {
                const total = ts.pro + ts.against;
                const eff = total > 0 ? Math.round((ts.pro / total) * 100) + "%" : "0%";
                csvContent += `${index + 1},"${ts.team.name.replace(/"/g, '""')}",${ts.matches},${ts.wins},${ts.losses},${ts.sg},${ts.pro},${ts.against},${eff}\n`;
            });

            csvContent += "\nDESEMPENHO DAS DUPLAS\nPosicao,Equipe,Dupla,Jogos,Vitorias,Saldo de Games,Games Pro\n";
            let pairsList = Object.values(pairStats).map(p => ({ obj: p.pair, ...p }));
            pairsList = Scoring.sortRanking(pairsList);
            pairsList.forEach((stat, index) => {
                csvContent += `${index + 1},"${stat.team ? stat.team.name.replace(/"/g, '""') : ''}","${stat.obj.name.replace(/"/g, '""')}",${stat.matches || 0},${stat.wins},${stat.sg},${stat.pro}\n`;
            });
        } else {
            let statsArray = Object.values(App.state.stats);
            statsArray = Scoring.sortRanking(statsArray);
            
            csvContent = "Posicao,Nome,Jogos,Vitorias,Saldo de Games,Games Pro\n";
            
            statsArray.forEach((stat, index) => {
                let matches = stat.matches || 0;
                let name = stat.obj.name.replace(/"/g, '""');
                csvContent += `${index + 1},"${name}",${matches},${stat.wins},${stat.sg},${stat.pro}\n`;
            });
        }
        
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

        let text = "";

        if (App.state.format === 'teams') {
            const { teamStats } = TeamsMode.calculateStats(App.state.teams, App.state.tournament.rounds);
            const sortedTeams = TeamsMode.sortTeamStats(Object.values(teamStats));
            
            text = `🛡️ *TORNEIO DE EQUIPES - REY PLAY* 🛡️\n\n`;
            text += `📊 *CLASSIFICAÇÃO GERAL DAS EQUIPES*\n`;
            sortedTeams.forEach((ts, idx) => {
                const medal = idx === 0 ? '🥇 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : ''));
                text += `${medal}*${ts.team.name}*: ${ts.wins}V (${ts.matches}J) | Saldo: ${ts.sg > 0 ? '+' : ''}${ts.sg} | ${ts.pro} pró\n`;
            });
            text += `\n🎾 *RESULTADOS DOS JOGOS*\n\n`;
        } else {
            text = `🎾 *Resultados do Torneio* 🎾\n\n`;
        }

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
                } else if (App.state.format === 'teams') {
                    t1Name = `[${match.team1Name}] ${match.t1.name}`;
                    t2Name = `[${match.team2Name}] ${match.t2.name}`;
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
