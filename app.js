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
    filterStatus: 'all',
    filterParticipant: 'all',
    activeModalMatchId: null,
    activeModalRoundNum: null,
    selectedKnockoutCount: 4,
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
        const rankCol = document.getElementById('rank-name-col');
        if (rankCol) {
            if (App.state.format === 'individual') {
                rankCol.innerText = 'Jogador';
            } else if (App.state.format === 'teams') {
                rankCol.innerText = 'Equipe';
            } else {
                rankCol.innerText = 'Dupla';
            }
        }
        
        const btnKnockout = document.getElementById('btn-generate-knockout');
        if (btnKnockout) {
            btnKnockout.style.display = (App.state.format === 'groups' && !App.isViewMode) ? 'inline-flex' : 'none';
        }

        App.recalculateAllStats();
        App.populateParticipantFilter();
        App.renderKPIs();
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();
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
            t.addEventListener('click', (e) => App.switchTab(e.currentTarget.dataset.target));
        });

        // Filters
        const filterStatus = document.getElementById('filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                App.filterStatus = e.target.value;
                App.renderRounds();
            });
        }
        const filterPart = document.getElementById('filter-participant');
        if (filterPart) {
            filterPart.addEventListener('change', (e) => {
                App.filterParticipant = e.target.value;
                App.renderRounds();
            });
        }

        // Score Modal Controls
        const scoreModal = document.getElementById('score-modal');
        const btnCloseScore = document.getElementById('btn-close-score-modal');
        if (btnCloseScore) {
            btnCloseScore.addEventListener('click', App.closeScoreModal);
        }
        if (scoreModal) {
            scoreModal.addEventListener('click', (e) => {
                if (e.target === scoreModal) App.closeScoreModal();
            });
        }

        document.querySelectorAll('#score-modal .stepper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const step = parseInt(e.currentTarget.dataset.step) || 0;
                const inp = document.getElementById(targetId);
                if (!inp) return;
                let curr = parseInt(inp.value);
                if (isNaN(curr)) curr = 0;
                let next = Math.max(0, curr + step);
                inp.value = next;
                App.syncScoreModalUI();
            });
        });

        document.querySelectorAll('#score-modal .score-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                const parent = e.currentTarget.closest('.quick-score-pills');
                if (!parent) return;
                const targetId = parent.dataset.target;
                const val = parseInt(e.currentTarget.dataset.val);
                const inp = document.getElementById(targetId);
                if (inp && !isNaN(val)) {
                    inp.value = val;
                    App.syncScoreModalUI();
                }
            });
        });

        const s1Inp = document.getElementById('modal-score1-input');
        const s2Inp = document.getElementById('modal-score2-input');
        if (s1Inp) s1Inp.addEventListener('input', App.syncScoreModalUI);
        if (s2Inp) s2Inp.addEventListener('input', App.syncScoreModalUI);

        const btnToggleTb = document.getElementById('btn-toggle-tiebreak');
        if (btnToggleTb) {
            btnToggleTb.addEventListener('click', () => {
                const tbSec = document.getElementById('modal-tiebreak-section');
                if (tbSec) {
                    tbSec.classList.toggle('hidden');
                    btnToggleTb.innerText = tbSec.classList.contains('hidden')
                        ? '+ Informar pontos de Tie-break (opcional)'
                        : '− Ocultar pontos de Tie-break';
                }
            });
        }

        const btnConfirmScore = document.getElementById('btn-confirm-score-modal');
        if (btnConfirmScore) {
            btnConfirmScore.addEventListener('click', App.saveModalScore);
        }

        // Knockout Modal Controls
        const koModal = document.getElementById('knockout-modal');
        const btnCloseKo = document.getElementById('btn-close-ko-modal');
        if (btnCloseKo && koModal) {
            btnCloseKo.addEventListener('click', () => koModal.close());
            koModal.addEventListener('click', (e) => {
                if (e.target === koModal) koModal.close();
            });
        }
        document.querySelectorAll('.ko-option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.ko-option-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                App.selectedKnockoutCount = parseInt(e.currentTarget.dataset.count) || 4;
            });
        });
        const btnConfirmKo = document.getElementById('btn-confirm-ko-modal');
        if (btnConfirmKo) {
            btnConfirmKo.addEventListener('click', App.confirmGenerateKnockout);
        }

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

        const rankCol = document.getElementById('rank-name-col');
        if (App.state.format === 'individual') {
            App.state.tournament = IndividualMode.generateRounds(App.state.players, App.state.numCourts, App.state.maxMatchesPerPlayer);
            if (rankCol) rankCol.innerText = 'Jogador';
        } else if (App.state.format === 'teams') {
            App.state.tournament = TeamsMode.generateRounds(App.state.teams, App.state.numCourts);
            if (rankCol) rankCol.innerText = 'Equipe';
        } else if (App.state.format === 'groups') {
            App.state.tournament = GroupsMode.generateRounds(App.state.fixedPairs, App.state.numGroups, App.state.numCourts);
            if (rankCol) rankCol.innerText = 'Dupla';
        } else if (App.state.format === 'knockout') {
            App.state.tournament = KnockoutMode.generateInitialRound(App.state.fixedPairs);
            if (rankCol) rankCol.innerText = 'Dupla';
        } else {
            App.state.tournament = RoundRobin.generateSubArrays(App.state.fixedPairs);
            if (rankCol) rankCol.innerText = 'Dupla';
        }

        App.filterStatus = 'all';
        App.filterParticipant = 'all';
        const fStatus = document.getElementById('filter-status');
        if (fStatus) fStatus.value = 'all';

        App.saveState();
        
        const newUrl = window.location.pathname + '?admin=' + App.state.tournamentId;
        window.history.pushState({path:newUrl}, '', newUrl);

        App.populateParticipantFilter();
        App.renderKPIs();
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();
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
            btnKnockout.style.display = (App.state.format === 'groups' && !App.isViewMode) ? 'inline-flex' : 'none';
        }
    },

    generateKnockout: () => {
        const koModal = document.getElementById('knockout-modal');
        if (koModal && typeof koModal.showModal === 'function') {
            koModal.showModal();
        } else {
            let numStr = prompt("Quantas equipes se classificam para o mata-mata? (Ex: 2, 4, 8, 16)");
            if (!numStr) return;
            let numTeams = parseInt(numStr);
            if (isNaN(numTeams) || numTeams < 2) {
                alert("Número inválido. O mínimo de equipes é 2.");
                return;
            }
            App.selectedKnockoutCount = numTeams;
            App.confirmGenerateKnockout();
        }
    },

    confirmGenerateKnockout: () => {
        const koModal = document.getElementById('knockout-modal');
        if (koModal && koModal.open) koModal.close();

        const numTeams = App.selectedKnockoutCount || 4;
        let statsArray = Object.values(App.state.stats);
        let koRound = GroupsMode.generateKnockout(statsArray, App.state.tournament.groups, numTeams);
        
        koRound.roundNum = App.state.tournament.rounds.length + 1;
        
        App.state.tournament.rounds.push(koRound);
        App.saveState();
        App.renderKPIs();
        App.renderCourtsDashboard();
        App.renderRounds();
        App.switchTab('tab-matches');
        
        setTimeout(() => {
            const rc = document.getElementById('rounds-container');
            if (rc) rc.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    },

    initStats: () => {
        App.state.stats = {};
        if (App.state.format === 'individual') {
            (App.state.players || []).forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0, matches: 0 };
            });
        } else if (App.state.format === 'teams') {
            App.state.teamStats = {};
            (App.state.teams || []).forEach(t => {
                App.state.teamStats[t.id] = {
                    team: t,
                    wins: 0,
                    losses: 0,
                    sg: 0,
                    pro: 0,
                    against: 0,
                    matches: 0
                };
                (t.pairs || []).forEach(p => {
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
            (App.state.fixedPairs || []).forEach(p => {
                App.state.stats[p.id] = { obj: p, wins: 0, sg: 0, pro: 0, matches: 0 };
            });
        }
    },

    recalculateAllStats: () => {
        if (!App.state.tournament || !App.state.tournament.rounds) return;

        if (App.state.format === 'teams') {
            const { teamStats, pairStats } = TeamsMode.calculateStats(App.state.teams || [], App.state.tournament.rounds);
            App.state.teamStats = teamStats;
            App.state.stats = pairStats;
            return;
        }

        App.initStats();

        App.state.tournament.rounds.forEach(round => {
            (round.matches || []).forEach(match => {
                if (match.finished && match.score1 !== null && match.score2 !== null) {
                    const s1 = parseInt(match.score1);
                    const s2 = parseInt(match.score2);
                    if (isNaN(s1) || isNaN(s2)) return;

                    const res = Scoring.calculateMatchScore(s1, s2);
                    if (App.state.format === 'individual') {
                        const dummies = match.dummies || [];
                        if (!dummies.includes(match.t1[0].id)) App.addStatsToPlayer(match.t1[0].id, res.winsA, res.sgA, res.proA, 1);
                        if (!dummies.includes(match.t1[1].id)) App.addStatsToPlayer(match.t1[1].id, res.winsA, res.sgA, res.proA, 1);
                        if (!dummies.includes(match.t2[0].id)) App.addStatsToPlayer(match.t2[0].id, res.winsB, res.sgB, res.proB, 1);
                        if (!dummies.includes(match.t2[1].id)) App.addStatsToPlayer(match.t2[1].id, res.winsB, res.sgB, res.proB, 1);
                    } else {
                        if (match.t1 && match.t1.id && match.t1.id !== 'BYE' && (!match.t2 || match.t2.id !== 'BYE')) {
                            App.addStatsToPlayer(match.t1.id, res.winsA, res.sgA, res.proA, 1);
                            App.addStatsToPlayer(match.t2.id, res.winsB, res.sgB, res.proB, 1);
                        }
                    }
                }
            });
        });
    },

    getMatchDisplayInfo: (match, globalNum) => {
        const numStr = globalNum < 10 ? `#0${globalNum}` : `#${globalNum}`;
        let t1Overline = '';
        let t1Color = 'var(--sunset-yellow)';
        let t1Name = '';
        let t2Overline = '';
        let t2Color = 'var(--sunset-yellow)';
        let t2Name = '';
        let participantTokens = [];

        if (App.state.format === 'individual') {
            const dummies = match.dummies || [];
            const p1 = dummies.includes(match.t1[0].id) ? `${match.t1[0].name} 🃏` : match.t1[0].name;
            const p2 = dummies.includes(match.t1[1].id) ? `${match.t1[1].name} 🃏` : match.t1[1].name;
            const p3 = dummies.includes(match.t2[0].id) ? `${match.t2[0].name} 🃏` : match.t2[0].name;
            const p4 = dummies.includes(match.t2[1].id) ? `${match.t2[1].name} 🃏` : match.t2[1].name;
            t1Name = `${p1} e ${p2}`;
            t2Name = `${p3} e ${p4}`;
            participantTokens = [match.t1[0].id, match.t1[1].id, match.t2[0].id, match.t2[1].id];
        } else if (App.state.format === 'teams') {
            t1Overline = match.team1Name || '';
            t1Color = match.team1Color || 'var(--sunset-orange)';
            t1Name = match.t1 ? match.t1.name : '';
            t2Overline = match.team2Name || '';
            t2Color = match.team2Color || 'var(--sunset-yellow)';
            t2Name = match.t2 ? match.t2.name : '';
            participantTokens = [
                match.team1Id,
                match.team2Id,
                match.t1 ? match.t1.id : '',
                match.t2 ? match.t2.id : ''
            ].filter(Boolean);
        } else {
            t1Name = match.t1 ? match.t1.name : '';
            t2Name = match.t2 ? match.t2.name : '';
            if (match.groupName && !match.groupName.includes('Final') && !match.groupName.includes('Lugar')) {
                t1Overline = match.groupName;
                t2Overline = match.groupName;
            }
            participantTokens = [
                match.t1 ? match.t1.id : '',
                match.t2 ? match.t2.id : ''
            ].filter(Boolean);
        }

        return {
            numStr,
            t1Overline,
            t1Color,
            t1Name,
            t2Overline,
            t2Color,
            t2Name,
            participantTokens
        };
    },

    populateParticipantFilter: () => {
        const select = document.getElementById('filter-participant');
        if (!select) return;

        const prevVal = App.filterParticipant || 'all';
        let html = '';

        if (App.state.format === 'individual') {
            html += `<option value="all">Todos os atletas</option>`;
            (App.state.players || []).forEach(p => {
                html += `<option value="${p.id}">${p.name}</option>`;
            });
        } else if (App.state.format === 'teams') {
            html += `<option value="all">Todas as equipes e duplas</option>`;
            (App.state.teams || []).forEach(t => {
                html += `<optgroup label="🛡️ ${t.name}">`;
                html += `<option value="${t.id}">Todas de ${t.name}</option>`;
                (t.pairs || []).forEach(pair => {
                    html += `<option value="${pair.id}">${pair.name}</option>`;
                });
                html += `</optgroup>`;
            });
        } else {
            html += `<option value="all">Todas as duplas</option>`;
            (App.state.fixedPairs || []).forEach(pair => {
                html += `<option value="${pair.id}">${pair.name}</option>`;
            });
        }

        select.innerHTML = html;
        if ([...select.options].some(o => o.value === prevVal)) {
            select.value = prevVal;
        } else {
            select.value = 'all';
            App.filterParticipant = 'all';
        }
    },

    renderKPIs: () => {
        const kpiContainer = document.getElementById('tournament-kpis');
        const subtitleEl = document.getElementById('matches-summary-subtitle');
        if (!kpiContainer || !App.state.tournament || !App.state.tournament.rounds) return;

        const numCourts = App.state.numCourts || 0;
        let total = 0;
        let finished = 0;
        let inCourt = 0;
        let inQueue = 0;

        App.state.tournament.rounds.forEach(r => {
            (r.matches || []).forEach(m => {
                total++;
                if (m.finished) {
                    finished++;
                } else if (numCourts > 0 && m.court && m.court > 0 && m.court <= numCourts) {
                    inCourt++;
                } else {
                    inQueue++;
                }
            });
        });

        const pct = total > 0 ? Math.round((finished / total) * 100) : 0;
        const freeCourts = Math.max(0, numCourts - inCourt);

        kpiContainer.innerHTML = `
            <div class="kpi-card">
                <div>
                    <div class="kpi-label">Partidas Concluídas</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${finished}</span>
                        <span class="kpi-unit">/ ${total}</span>
                    </div>
                </div>
                <div class="kpi-progress-track">
                    <div class="kpi-progress-bar" style="width: ${pct}%;"></div>
                </div>
            </div>
            <div class="kpi-card">
                <div>
                    <div class="kpi-label">Em Quadra</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${numCourts > 0 ? inCourt : '-'}</span>
                        <span class="kpi-unit">${numCourts > 0 ? (inCourt === 1 ? 'partida' : 'partidas') : ''}</span>
                    </div>
                </div>
                <div class="kpi-subtext">
                    ${numCourts > 0 ? `${freeCourts} ${freeCourts === 1 ? 'quadra livre' : 'quadras livres'}` : 'Sem controle de quadra'}
                </div>
            </div>
            <div class="kpi-card">
                <div>
                    <div class="kpi-label">Na Fila</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${inQueue}</span>
                        <span class="kpi-unit">${inQueue === 1 ? 'jogo' : 'jogos'}</span>
                    </div>
                </div>
                <div class="kpi-subtext">
                    ${inQueue === 0 && finished === total ? 'Torneio finalizado 🏆' : 'Sequência única de chamada'}
                </div>
            </div>
        `;

        if (subtitleEl) {
            subtitleEl.innerText = `${total} confrontos no torneio · ${finished} concluídos e ${inQueue} na fila.`;
        }
    },

    renderCourtsDashboard: () => {
        const container = document.getElementById('courts-dashboard');
        if (!container) return;

        const numCourts = App.state.numCourts || 0;
        if (numCourts === 0 || !App.state.tournament || !App.state.tournament.rounds) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'block';

        let busyCourts = {};
        let waitingMatches = [];
        let matchGlobalMap = {};
        let matchRoundMap = {};
        let gIdx = 0;

        App.state.tournament.rounds.forEach(round => {
            round.matches.forEach(m => {
                gIdx++;
                matchGlobalMap[m.id] = gIdx;
                matchRoundMap[m.id] = round.roundNum;
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
            const courtLabel = c < 10 ? `QUADRA 0${c}` : `QUADRA ${c}`;
            const match = busyCourts[c];
            if (match) {
                const gNum = matchGlobalMap[match.id] || 1;
                const rNum = matchRoundMap[match.id];
                const info = App.getMatchDisplayInfo(match, gNum);

                courtsCardsHtml += `
                    <div class="court-card busy">
                        <div>
                            <div class="court-card-top">
                                <span class="court-card-name">${courtLabel}</span>
                                <span class="court-pill in-play">• Em jogo</span>
                            </div>
                            <div class="court-match-body">
                                <div class="court-match-num">PARTIDA ${info.numStr}</div>
                                <div class="court-match-teams">
                                    <div class="court-team-col">
                                        ${info.t1Overline ? `<span class="court-team-overline" style="color: ${info.t1Color};">${info.t1Overline}</span>` : ''}
                                        <span class="court-team-pair">${info.t1Name}</span>
                                    </div>
                                    <span class="court-vs-divider">×</span>
                                    <div class="court-team-col">
                                        ${info.t2Overline ? `<span class="court-team-overline" style="color: ${info.t2Color};">${info.t2Overline}</span>` : ''}
                                        <span class="court-team-pair">${info.t2Name}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="court-card-footer">
                            ${!App.isViewMode ? `
                                <button type="button" class="btn-court-secondary btn-release-court-card" data-mid="${match.id}">Devolver à fila</button>
                                <button type="button" class="btn-court-primary btn-launch-court-score" data-mid="${match.id}" data-rn="${rNum}">Lançar resultado →</button>
                            ` : `
                                <button type="button" class="btn-court-secondary btn-focus-match" style="width: 100%;" data-mid="${match.id}">Ver na lista ↓</button>
                            `}
                        </div>
                    </div>
                `;
            } else {
                const nextM = waitingMatches.length > 0 ? waitingMatches[0] : null;
                let nextSubText = 'Nenhum jogo aguardando na fila';
                if (nextM) {
                    const nextGNum = matchGlobalMap[nextM.id] || 1;
                    const nextInfo = App.getMatchDisplayInfo(nextM, nextGNum);
                    nextSubText = `Próximo disponível: partida ${nextInfo.numStr} (${nextInfo.t1Name} × ${nextInfo.t2Name})`;
                }

                courtsCardsHtml += `
                    <div class="court-card free">
                        <div>
                            <div class="court-card-top">
                                <span class="court-card-name">${courtLabel}</span>
                                <span class="court-pill available">Disponível</span>
                            </div>
                            <div class="court-empty-state">
                                <div class="court-empty-icon">+</div>
                                <div class="court-empty-title">Pronta para o próximo jogo</div>
                                <div class="court-empty-sub">${nextSubText}</div>
                            </div>
                        </div>
                        <div class="court-card-footer">
                            ${(!App.isViewMode && nextM) ? `
                                <button type="button" class="btn-court-call btn-call-next-court" data-court="${c}">
                                    Chamar próximo jogo →
                                </button>
                            ` : `
                                <div style="width: 100%; text-align: center; font-size: 0.78rem; color: var(--sand-secondary);">
                                    ${nextM ? 'Aguardando chamada da organização' : 'Quadra livre'}
                                </div>
                            `}
                        </div>
                    </div>
                `;
            }
        }

        const anyBusy = Object.keys(busyCourts).length > 0;
        const statusText = anyBusy ? 'Torneio em andamento' : (waitingMatches.length > 0 ? 'Pronto para chamar' : 'Jogos concluídos');

        container.innerHTML = `
            <div class="courts-section-header">
                <h3 class="courts-section-title">Agora nas quadras</h3>
                <span class="courts-status-indicator">${statusText}</span>
            </div>
            <div class="courts-grid">
                ${courtsCardsHtml}
            </div>
        `;

        container.querySelectorAll('.btn-focus-match').forEach(btn => {
            btn.addEventListener('click', (e) => App.scrollToMatch(e.currentTarget.dataset.mid));
        });
        container.querySelectorAll('.btn-release-court-card').forEach(btn => {
            btn.addEventListener('click', (e) => App.releaseCourt(e.currentTarget.dataset.mid));
        });
        container.querySelectorAll('.btn-call-next-court').forEach(btn => {
            btn.addEventListener('click', (e) => App.callNextToCourt(parseInt(e.currentTarget.dataset.court)));
        });
        container.querySelectorAll('.btn-launch-court-score').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.openScoreModal(e.currentTarget.dataset.mid, e.currentTarget.dataset.rn);
            });
        });
    },

    assignCourt: (matchId, courtNum) => {
        if (App.isViewMode || !App.state.tournament || !App.state.tournament.rounds) return;

        if (courtNum > 0) {
            App.state.tournament.rounds.forEach(r => {
                r.matches.forEach(m => {
                    if (m.id !== matchId && m.court === courtNum && !m.finished) {
                        m.court = null;
                    }
                });
            });
        }

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
            App.renderKPIs();
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
        }
    },

    callMatchToFirstFreeCourt: (matchId) => {
        if (App.isViewMode || !App.state.tournament || !App.state.tournament.rounds) return;
        const numCourts = App.state.numCourts || 0;
        if (numCourts <= 0) return;

        let busy = new Set();
        App.state.tournament.rounds.forEach(r => {
            r.matches.forEach(m => {
                if (!m.finished && m.court && m.court > 0) busy.add(m.court);
            });
        });

        let targetCourt = 1;
        for (let c = 1; c <= numCourts; c++) {
            if (!busy.has(c)) {
                targetCourt = c;
                break;
            }
        }
        App.assignCourt(matchId, targetCourt);
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
                        🛡️ Disputa entre Equipes (1 vitória = 1 ponto)
                    </div>
                    <div style="display: flex; justify-content: space-around; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 120px; text-align: center;">
                            <div style="font-weight: 800; font-size: 1.1rem; color: ${tA.color}; margin-bottom: 6px;">
                                ${tA.name}
                            </div>
                            <div style="font-size: 2.6rem; font-weight: 800; color: #fff; line-height: 1; font-family: var(--font-heading);">
                                ${sA.wins}
                            </div>
                            <div style="font-size: 0.78rem; color: var(--sand-secondary); margin-top: 6px;">
                                ${sA.matches} jogos · Saldo <strong style="color: ${sA.sg >= 0 ? 'var(--sunset-yellow)' : '#ff6b6b'};">${sA.sg > 0 ? '+' : ''}${sA.sg}</strong>
                            </div>
                        </div>

                        <div style="font-size: 1.4rem; font-weight: 800; color: var(--sunset-orange); padding: 0 6px;">
                            VS
                        </div>

                        <div style="flex: 1; min-width: 120px; text-align: center;">
                            <div style="font-weight: 800; font-size: 1.1rem; color: ${tB.color}; margin-bottom: 6px;">
                                ${tB.name}
                            </div>
                            <div style="font-size: 2.6rem; font-weight: 800; color: #fff; line-height: 1; font-family: var(--font-heading);">
                                ${sB.wins}
                            </div>
                            <div style="font-size: 0.78rem; color: var(--sand-secondary); margin-top: 6px;">
                                ${sB.matches} jogos · Saldo <strong style="color: ${sB.sg >= 0 ? 'var(--sunset-yellow)' : '#ff6b6b'};">${sB.sg > 0 ? '+' : ''}${sB.sg}</strong>
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
                        <div style="font-size: 0.92rem; font-weight: 700; color: ${t.color}; margin-bottom: 4px;">
                            ${idx === 0 ? '🥇 ' : ''}${t.name}
                        </div>
                        <div style="font-size: 1.9rem; font-weight: 800; color: #fff; line-height: 1;">
                            ${ts.wins} <span style="font-size: 0.78rem; font-weight: 500; color: var(--sand-secondary);">PTS</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--sand-secondary); margin-top: 4px;">
                            ${ts.matches} jogos · saldo ${ts.sg > 0 ? '+' : ''}${ts.sg}
                        </div>
                    </div>
                `;
            }).join('');

            board.innerHTML = `
                <div class="glass-card" style="padding: 16px; border-radius: 14px; background: rgba(10, 25, 47, 0.85); border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--sunset-yellow); margin-bottom: 12px; text-align: center;">
                        🛡️ Disputa entre Equipes
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 10px;">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }
    },

    // --- MATCHES RENDER ---
    renderRounds: () => {
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
                        let optionsHtml = `<option value="0" ${!match.court ? "selected" : ""}>⏳ Na fila</option>`;
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
                        if (numCourts > 0 && !match.court && hasFreeCourt) {
                            rightActionsHtml += `
                                <button type="button" class="btn-match-action btn-call-now" data-mid="${match.id}">
                                    Chamar agora
                                </button>
                            `;
                        }
                        rightActionsHtml += `
                            <button type="button" class="btn-match-action btn-launch-score" data-mid="${match.id}" data-rn="${round.roundNum}">
                                Lançar resultado
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

                const cardStateClass = match.finished ? 'is-finished' : (isInCourt ? 'in-court' : '');

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
    },

    // --- SCORE MODAL ---
    openScoreModal: (matchId, roundNum) => {
        if (App.isViewMode || !App.state.tournament || !App.state.tournament.rounds) return;

        let targetMatch = null;
        let targetRound = null;
        let globalNum = 0;
        let foundGlobalNum = 1;

        for (const r of App.state.tournament.rounds) {
            for (const m of r.matches) {
                globalNum++;
                if (m.id === matchId) {
                    targetMatch = m;
                    targetRound = r;
                    foundGlobalNum = globalNum;
                    break;
                }
            }
            if (targetMatch) break;
        }

        if (!targetMatch || !targetRound) return;

        App.activeModalMatchId = matchId;
        App.activeModalRoundNum = targetRound.roundNum;

        const info = App.getMatchDisplayInfo(targetMatch, foundGlobalNum);

        const badgeEl = document.getElementById('modal-match-badge');
        if (badgeEl) {
            const extra = targetMatch.groupName ? ` · ${targetMatch.groupName}` : ` · Rodada ${targetRound.roundNum}`;
            badgeEl.innerText = `PARTIDA ${info.numStr}${extra}`;
        }

        const t1Over = document.getElementById('modal-team1-overline');
        const t2Over = document.getElementById('modal-team2-overline');
        if (t1Over) {
            t1Over.innerText = info.t1Overline || '';
            t1Over.style.color = info.t1Color;
        }
        if (t2Over) {
            t2Over.innerText = info.t2Overline || '';
            t2Over.style.color = info.t2Color;
        }

        const t1NameEl = document.getElementById('modal-team1-name');
        const t2NameEl = document.getElementById('modal-team2-name');
        if (t1NameEl) t1NameEl.innerText = info.t1Name;
        if (t2NameEl) t2NameEl.innerText = info.t2Name;

        const tb1Label = document.getElementById('modal-tb1-label');
        const tb2Label = document.getElementById('modal-tb2-label');
        if (tb1Label) tb1Label.innerText = info.t1Name;
        if (tb2Label) tb2Label.innerText = info.t2Name;

        const s1Inp = document.getElementById('modal-score1-input');
        const s2Inp = document.getElementById('modal-score2-input');
        if (s1Inp) s1Inp.value = (targetMatch.score1 !== null && targetMatch.score1 !== undefined) ? targetMatch.score1 : 0;
        if (s2Inp) s2Inp.value = (targetMatch.score2 !== null && targetMatch.score2 !== undefined) ? targetMatch.score2 : 0;

        const tb1Inp = document.getElementById('modal-tb1-input');
        const tb2Inp = document.getElementById('modal-tb2-input');
        const hasTb = targetMatch.tb1 !== null && targetMatch.tb1 !== undefined && targetMatch.tb1 !== '' &&
                      targetMatch.tb2 !== null && targetMatch.tb2 !== undefined && targetMatch.tb2 !== '';
        if (tb1Inp) tb1Inp.value = hasTb ? targetMatch.tb1 : '';
        if (tb2Inp) tb2Inp.value = hasTb ? targetMatch.tb2 : '';

        const tbSec = document.getElementById('modal-tiebreak-section');
        const btnToggleTb = document.getElementById('btn-toggle-tiebreak');
        if (tbSec && btnToggleTb) {
            if (hasTb) {
                tbSec.classList.remove('hidden');
                btnToggleTb.innerText = '− Ocultar pontos de Tie-break';
            } else {
                tbSec.classList.add('hidden');
                btnToggleTb.innerText = '+ Informar pontos de Tie-break (opcional)';
            }
        }

        const errEl = document.getElementById('modal-score-error');
        if (errEl) errEl.innerText = '';

        App.syncScoreModalUI();

        const modal = document.getElementById('score-modal');
        if (modal && typeof modal.showModal === 'function') {
            modal.showModal();
        }
    },

    closeScoreModal: () => {
        const modal = document.getElementById('score-modal');
        if (modal && modal.open) {
            modal.close();
        }
        App.activeModalMatchId = null;
        App.activeModalRoundNum = null;
    },

    syncScoreModalUI: () => {
        const s1Inp = document.getElementById('modal-score1-input');
        const s2Inp = document.getElementById('modal-score2-input');
        if (!s1Inp || !s2Inp) return;

        const v1 = parseInt(s1Inp.value);
        const v2 = parseInt(s2Inp.value);

        const box1 = document.getElementById('modal-team1-box');
        const box2 = document.getElementById('modal-team2-box');
        if (box1 && box2) {
            box1.classList.toggle('leading', !isNaN(v1) && !isNaN(v2) && v1 > v2);
            box2.classList.toggle('leading', !isNaN(v1) && !isNaN(v2) && v2 > v1);
        }

        document.querySelectorAll('#score-modal .quick-score-pills').forEach(group => {
            const targetId = group.dataset.target;
            const targetInp = document.getElementById(targetId);
            const curVal = targetInp ? parseInt(targetInp.value) : -1;
            group.querySelectorAll('.score-pill').forEach(pill => {
                pill.classList.toggle('active', parseInt(pill.dataset.val) === curVal);
            });
        });

        // Auto-expandir seção de tie-break quando o placar for decidido por 1 game (ex: 4x3, 3x4, 7x6, 6x7)
        if (!isNaN(v1) && !isNaN(v2) && Math.abs(v1 - v2) === 1 && Math.max(v1, v2) >= 4) {
            const tbSec = document.getElementById('modal-tiebreak-section');
            const btnToggleTb = document.getElementById('btn-toggle-tiebreak');
            if (tbSec && tbSec.classList.contains('hidden')) {
                tbSec.classList.remove('hidden');
                if (btnToggleTb) btnToggleTb.innerText = '− Ocultar pontos de Tie-break';
            }
        }
    },

    saveModalScore: () => {
        if (!App.activeModalMatchId) return;

        const round = App.state.tournament.rounds.find(r => r.roundNum === App.activeModalRoundNum) ||
                      App.state.tournament.rounds.find(r => r.matches.some(m => m.id === App.activeModalMatchId));
        if (!round) return;

        const match = round.matches.find(m => m.id === App.activeModalMatchId);
        if (!match) return;

        const s1Inp = document.getElementById('modal-score1-input');
        const s2Inp = document.getElementById('modal-score2-input');
        const errEl = document.getElementById('modal-score-error');

        const s1 = parseInt(s1Inp.value);
        const s2 = parseInt(s2Inp.value);

        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
            if (errEl) errEl.innerText = 'Informe um placar válido para as duas duplas.';
            return;
        }

        const tbSec = document.getElementById('modal-tiebreak-section');
        const tb1Inp = document.getElementById('modal-tb1-input');
        const tb2Inp = document.getElementById('modal-tb2-input');

        let tb1 = null;
        let tb2 = null;
        if (tbSec && !tbSec.classList.contains('hidden') && tb1Inp && tb2Inp) {
            const parsedTb1 = parseInt(tb1Inp.value);
            const parsedTb2 = parseInt(tb2Inp.value);
            if (!isNaN(parsedTb1) && !isNaN(parsedTb2)) {
                tb1 = parsedTb1;
                tb2 = parsedTb2;
            }
        }

        const wasAlreadyFinished = !!match.finished;

        match.score1 = s1;
        match.score2 = s2;
        match.tb1 = tb1;
        match.tb2 = tb2;
        match.finished = true;

        App.recalculateAllStats();

        const allFinished = round.matches.length > 0 && round.matches.every(m => m.finished);
        const isLastRound = App.state.tournament.rounds[App.state.tournament.rounds.length - 1].roundNum === round.roundNum;

        if (!wasAlreadyFinished && allFinished && isLastRound) {
            if (round.isKnockout && round.matches.length > 1 && round.knockoutLabel !== 'Final') {
                App.generateNextKnockoutPhase(round);
            }
        }

        App.closeScoreModal();
        App.saveState();
        App.renderKPIs();
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();
        App.renderRounds();
        App.renderRanking();

        if (!wasAlreadyFinished && allFinished && round.isKnockout) {
            setTimeout(() => {
                const rc = document.getElementById('rounds-container');
                if (rc) rc.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    },

    finishMatch: (matchId, roundNum) => {
        App.openScoreModal(matchId, roundNum);
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
        App.openScoreModal(matchId, roundNum);
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
                        <div class="glass-card pd-0 table-responsive" style="margin-bottom: 25px;">
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
                    <div class="glass-card pd-0 table-responsive" style="margin-bottom: 25px;">
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
                <div class="glass-card pd-0 table-responsive" style="margin-bottom: 30px;">
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
                            <span class="team-tag" style="background:${tColor};">${tName}</span>
                            ${stat.obj.name}
                            ${!App.isViewMode ? `<button class="btn-edit-name" data-id="${stat.obj.id}" title="Editar Nome da Dupla">✏️</button>` : ''}
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
                <div class="glass-card pd-0 table-responsive">
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
                    <div class="glass-card pd-0 table-responsive">
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
                <div class="glass-card pd-0 table-responsive">
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
        const stat = App.state.stats ? App.state.stats[id] : null;
        let oldName = '';
        if (stat) {
            oldName = (stat.obj && stat.obj.name) || (stat.pair && stat.pair.name) || '';
        }
        if (!oldName && App.state.teams) {
            for (const t of App.state.teams) {
                const p = t.pairs ? t.pairs.find(x => x.id === id) : null;
                if (p) {
                    oldName = p.name;
                    break;
                }
            }
        }
        if (!oldName && App.state.fixedPairs) {
            const fp = App.state.fixedPairs.find(x => x.id === id);
            if (fp) oldName = fp.name;
        }
        if (!oldName && App.state.players) {
            const pl = App.state.players.find(x => x.id === id);
            if (pl) oldName = pl.name;
        }
        
        let newName = prompt("Corrigir nome:", oldName);
        if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
        newName = newName.trim();

        const visited = new Set();
        const updateNameInObj = (obj) => {
            if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
            visited.add(obj);
            if (obj.id === id) {
                if (obj.name !== undefined) {
                    obj.name = newName;
                }
                if (obj.p1 && obj.p1.name !== undefined) {
                    obj.p1.name = newName;
                }
            }
            for (let key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    updateNameInObj(obj[key]);
                }
            }
        };

        updateNameInObj(App.state);
        App.saveState();
        App.populateParticipantFilter();
        App.renderCourtsDashboard();
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
        App.populateParticipantFilter();
        App.renderTeamsLiveScoreboard();
        App.renderCourtsDashboard();
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
            
            round.matches.forEach((match) => {
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
                let tbStr = (match.tb1 !== null && match.tb1 !== undefined && match.tb2 !== null && match.tb2 !== undefined)
                    ? ` (TB ${match.tb1}x${match.tb2})`
                    : '';
                
                let t1Display = t1Name;
                let t2Display = t2Name;
                
                if (match.score1 !== null && match.score2 !== null) {
                    if (match.score1 > match.score2) {
                        t1Display = `*${t1Name}*`;
                    } else if (match.score2 > match.score1) {
                        t2Display = `*${t2Name}*`;
                    }
                }

                text += `${t1Display}  ${s1} x ${s2}${tbStr}  ${t2Display}\n`;
            });
            text += `\n`;
        });

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
