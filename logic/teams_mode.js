// Teams Mode Logic for Super 8 BT
const TeamsMode = {
    /**
     * Gera as rodadas e confrontos do torneio de equipes com MISTURA MÁXIMA.
     * Regra: Cada time possui D duplas. Duplas do mesmo time NÃO se enfrentam.
     * Cada dupla enfrenta exatamente 1 vez cada dupla dos outros times.
     *
     * Os jogos são distribuídos dinamicamente de forma intercalada:
     * - Todos os times entram em quadra desde a Rodada 1
     * - Nenhuma dupla joga duas partidas no mesmo momento / na mesma rodada
     * - Máximo tempo de descanso entre jogos para cada dupla
     *
     * @param {Array} teams - Lista de times contendo { id, name, color, pairs }
     * @param {number} numCourts - Quantidade de quadras disponíveis simultâneas
     * @returns {Object} { type: 'teams', rounds, teams }
     */
    generateRounds: (teams, numCourts) => {
        const numTeams = teams.length;
        if (numTeams < 2) return { type: 'teams', rounds: [], teams };

        // 1. Gera todos os confrontos necessários (todas as duplas contra todas as duplas adversárias)
        let unplayed = [];
        let matchCounter = 0;

        for (let i = 0; i < numTeams; i++) {
            for (let j = i + 1; j < numTeams; j++) {
                const teamA = teams[i];
                const teamB = teams[j];

                for (let pa = 0; pa < teamA.pairs.length; pa++) {
                    for (let pb = 0; pb < teamB.pairs.length; pb++) {
                        const pairA = teamA.pairs[pa];
                        const pairB = teamB.pairs[pb];

                        unplayed.push({
                            id: `tm_m_${matchCounter++}`,
                            team1Id: teamA.id,
                            team1Name: teamA.name,
                            team1Color: teamA.color,
                            team2Id: teamB.id,
                            team2Name: teamB.name,
                            team2Color: teamB.color,
                            t1: pairA,
                            t2: pairB,
                            score1: null,
                            score2: null,
                            finished: false,
                            pairIds: [pairA.id, pairB.id],
                            teamIds: [teamA.id, teamB.id]
                        });
                    }
                }
            }
        }

        // 2. Agendamento equilibrado e intercalado
        // Cada rodada visual tem o número de quadras (ou 2 se numCourts for menor)
        const targetMatchesPerRound = Math.max(numCourts || 0, 2);

        let globalRounds = [];
        let currentRoundMatches = [];
        let usedPairsInRound = new Set();
        let lastPlayedPairs = new Set();

        let teamMatchCounts = {};
        let pairMatchCounts = {};
        teams.forEach(t => {
            teamMatchCounts[t.id] = 0;
            t.pairs.forEach(p => {
                pairMatchCounts[p.id] = 0;
            });
        });

        let roundNumber = 1;

        while (unplayed.length > 0) {
            let bestIdx = -1;
            let bestScore = -9999999;

            for (let idx = 0; idx < unplayed.length; idx++) {
                const m = unplayed[idx];

                // Regra estrita: nenhuma dupla joga 2 vezes na mesma rodada
                if (usedPairsInRound.has(m.pairIds[0]) || usedPairsInRound.has(m.pairIds[1])) {
                    continue;
                }

                let score = 0;

                // Penaliza duplas que jogaram na rodada imediatamente anterior (garante descanso)
                if (lastPlayedPairs.has(m.pairIds[0])) score -= 300;
                if (lastPlayedPairs.has(m.pairIds[1])) score -= 300;

                // Favorece times que jogaram menos partidas no total (mantém todos os times ativos)
                score -= (teamMatchCounts[m.teamIds[0]] || 0) * 25;
                score -= (teamMatchCounts[m.teamIds[1]] || 0) * 25;

                // Favorece duplas que jogaram menos partidas
                score -= (pairMatchCounts[m.pairIds[0]] || 0) * 10;
                score -= (pairMatchCounts[m.pairIds[1]] || 0) * 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = idx;
                }
            }

            if (bestIdx !== -1 && currentRoundMatches.length < targetMatchesPerRound) {
                const selected = unplayed.splice(bestIdx, 1)[0];
                currentRoundMatches.push(selected);
                usedPairsInRound.add(selected.pairIds[0]);
                usedPairsInRound.add(selected.pairIds[1]);
                teamMatchCounts[selected.teamIds[0]] = (teamMatchCounts[selected.teamIds[0]] || 0) + 1;
                teamMatchCounts[selected.teamIds[1]] = (teamMatchCounts[selected.teamIds[1]] || 0) + 1;
                pairMatchCounts[selected.pairIds[0]] = (pairMatchCounts[selected.pairIds[0]] || 0) + 1;
                pairMatchCounts[selected.pairIds[1]] = (pairMatchCounts[selected.pairIds[1]] || 0) + 1;
            } else {
                // Fecha a rodada atual e inicia uma nova rodada
                if (currentRoundMatches.length > 0) {
                    globalRounds.push({
                        roundNum: roundNumber++,
                        matches: currentRoundMatches
                    });
                    lastPlayedPairs = new Set(usedPairsInRound);
                    currentRoundMatches = [];
                    usedPairsInRound.clear();
                } else {
                    // Fallback de segurança se nenhuma partida puder ser encaixada sem violar
                    const forced = unplayed.splice(0, 1)[0];
                    currentRoundMatches.push(forced);
                    usedPairsInRound.add(forced.pairIds[0]);
                    usedPairsInRound.add(forced.pairIds[1]);
                    globalRounds.push({
                        roundNum: roundNumber++,
                        matches: currentRoundMatches
                    });
                    lastPlayedPairs = new Set(usedPairsInRound);
                    currentRoundMatches = [];
                    usedPairsInRound.clear();
                }
            }
        }

        if (currentRoundMatches.length > 0) {
            globalRounds.push({
                roundNum: roundNumber++,
                matches: currentRoundMatches
            });
        }

        return {
            type: 'teams',
            rounds: globalRounds,
            teams: teams
        };
    },

    /**
     * Calcula as estatísticas consolidadas por time e por dupla a partir das partidas.
     */
    calculateStats: (teams, rounds) => {
        let teamStats = {};
        let pairStats = {};

        // Inicializa times
        teams.forEach(t => {
            teamStats[t.id] = {
                team: t,
                wins: 0,
                losses: 0,
                sg: 0,
                pro: 0,
                against: 0,
                matches: 0
            };

            t.pairs.forEach(p => {
                pairStats[p.id] = {
                    pair: p,
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

        // Computa partidas finalizadas
        rounds.forEach(r => {
            r.matches.forEach(m => {
                if (m.finished && m.score1 !== null && m.score2 !== null) {
                    const s1 = parseInt(m.score1);
                    const s2 = parseInt(m.score2);

                    const win1 = s1 > s2 ? 1 : 0;
                    const win2 = s2 > s1 ? 1 : 0;
                    const loss1 = s1 < s2 ? 1 : 0;
                    const loss2 = s2 < s1 ? 1 : 0;

                    const sg1 = s1 - s2;
                    const sg2 = s2 - s1;

                    // Atualiza Time 1
                    if (teamStats[m.team1Id]) {
                        teamStats[m.team1Id].wins += win1;
                        teamStats[m.team1Id].losses += loss1;
                        teamStats[m.team1Id].sg += sg1;
                        teamStats[m.team1Id].pro += s1;
                        teamStats[m.team1Id].against += s2;
                        teamStats[m.team1Id].matches += 1;
                    }

                    // Atualiza Time 2
                    if (teamStats[m.team2Id]) {
                        teamStats[m.team2Id].wins += win2;
                        teamStats[m.team2Id].losses += loss2;
                        teamStats[m.team2Id].sg += sg2;
                        teamStats[m.team2Id].pro += s2;
                        teamStats[m.team2Id].against += s1;
                        teamStats[m.team2Id].matches += 1;
                    }

                    // Atualiza Dupla 1
                    if (pairStats[m.t1.id]) {
                        pairStats[m.t1.id].wins += win1;
                        pairStats[m.t1.id].losses += loss1;
                        pairStats[m.t1.id].sg += sg1;
                        pairStats[m.t1.id].pro += s1;
                        pairStats[m.t1.id].against += s2;
                        pairStats[m.t1.id].matches += 1;
                    }

                    // Atualiza Dupla 2
                    if (pairStats[m.t2.id]) {
                        pairStats[m.t2.id].wins += win2;
                        pairStats[m.t2.id].losses += loss2;
                        pairStats[m.t2.id].sg += sg2;
                        pairStats[m.t2.id].pro += s2;
                        pairStats[m.t2.id].against += s1;
                        pairStats[m.t2.id].matches += 1;
                    }
                }
            });
        });

        return { teamStats, pairStats };
    },

    /**
     * Ordena a lista de times de acordo com os critérios oficiais:
     * 1. Vitórias
     * 2. Saldo de Games
     * 3. Aproveitamento (% Games Pró)
     * 4. Menos Jogos Disputados
     */
    sortTeamStats: (teamStatsList) => {
        return teamStatsList.sort((a, b) => {
            const matchesA = a.matches || 0;
            const matchesB = b.matches || 0;

            if (matchesA === 0 && matchesB > 0) return 1;
            if (matchesB === 0 && matchesA > 0) return -1;

            // 1. Vitórias
            if (b.wins !== a.wins) return b.wins - a.wins;

            // 2. Saldo de games
            if (b.sg !== a.sg) return b.sg - a.sg;

            // 3. Eficiência / Aproveitamento
            const totalA = a.pro + a.against;
            const effA = totalA > 0 ? (a.pro / totalA) : 0;
            const totalB = b.pro + b.against;
            const effB = totalB > 0 ? (b.pro / totalB) : 0;
            if (effB !== effA) return effB - effA;

            // 4. Mais games pró
            if (b.pro !== a.pro) return b.pro - a.pro;

            return 0;
        });
    }
};
