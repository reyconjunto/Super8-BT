// Teams Mode Logic for Super 8 BT
const TeamsMode = {
    /**
     * Gera as rodadas e confrontos do torneio de equipes.
     * Regra: Cada time possui D duplas. Duplas do mesmo time NÃO se enfrentam.
     * Cada dupla enfrenta exatamente 1 vez cada dupla dos outros times.
     *
     * @param {Array} teams - Lista de times contendo { id, name, color, pairs }
     * @param {number} numCourts - Quantidade de quadras disponíveis simultâneas
     * @returns {Object} { type: 'teams', rounds, teams }
     */
    generateRounds: (teams, numCourts) => {
        const numTeams = teams.length;
        if (numTeams < 2) return { type: 'teams', rounds: [], teams };

        const pairsPerTeam = teams[0].pairs.length;
        let globalRounds = [];

        // Caso especial: exatamente 2 times
        if (numTeams === 2) {
            const teamA = teams[0];
            const teamB = teams[1];

            for (let shift = 0; shift < pairsPerTeam; shift++) {
                let matches = [];
                for (let i = 0; i < pairsPerTeam; i++) {
                    const p1 = teamA.pairs[i];
                    const p2 = teamB.pairs[(i + shift) % pairsPerTeam];

                    matches.push({
                        id: `tm_r${shift}_m${i}`,
                        team1Id: teamA.id,
                        team1Name: teamA.name,
                        team1Color: teamA.color,
                        team2Id: teamB.id,
                        team2Name: teamB.name,
                        team2Color: teamB.color,
                        t1: p1,
                        t2: p2,
                        score1: null,
                        score2: null,
                        finished: false
                    });
                }

                globalRounds.push({
                    roundNum: shift + 1,
                    matches: matches
                });
            }

            return {
                type: 'teams',
                rounds: globalRounds,
                teams: teams
            };
        }

        // Caso geral: 3 ou mais times (Round Robin cíclico entre os times)
        let teamIndices = Array.from({ length: numTeams }, (_, i) => i);
        const isOdd = numTeams % 2 !== 0;
        if (isOdd) {
            teamIndices.push(-1); // -1 representa "Folga" (BYE)
        }

        const numTeamRounds = teamIndices.length - 1;
        const halfSize = teamIndices.length / 2;

        // 1. Pré-calcula os pares de times para cada turno do round-robin
        let turnMatchups = [];
        for (let tr = 0; tr < numTeamRounds; tr++) {
            let matchups = [];
            for (let i = 0; i < halfSize; i++) {
                const t1Idx = teamIndices[i];
                const t2Idx = teamIndices[teamIndices.length - 1 - i];

                if (t1Idx !== -1 && t2Idx !== -1) {
                    matchups.push([teams[t1Idx], teams[t2Idx]]);
                }
            }
            turnMatchups.push(matchups);
            // Rotacionar os times (o primeiro fica fixo, movemos os demais)
            teamIndices.splice(1, 0, teamIndices.pop());
        }

        // 2. Gera as rodadas intercalando os confrontos de times a cada rodada!
        // Desta forma, nenhum time fica esperando várias rodadas seguidas sem jogar.
        let roundCounter = 1;
        for (let shift = 0; shift < pairsPerTeam; shift++) {
            for (let tr = 0; tr < numTeamRounds; tr++) {
                const currentMatchups = turnMatchups[tr];
                let matches = [];
                let matchIdx = 0;

                currentMatchups.forEach(([teamA, teamB]) => {
                    for (let i = 0; i < pairsPerTeam; i++) {
                        const p1 = teamA.pairs[i];
                        const p2 = teamB.pairs[(i + shift) % pairsPerTeam];

                        matches.push({
                            id: `tm_s${shift}_tr${tr}_m${matchIdx++}`,
                            team1Id: teamA.id,
                            team1Name: teamA.name,
                            team1Color: teamA.color,
                            team2Id: teamB.id,
                            team2Name: teamB.name,
                            team2Color: teamB.color,
                            t1: p1,
                            t2: p2,
                            score1: null,
                            score2: null,
                            finished: false
                        });
                    }
                });

                if (matches.length > 0) {
                    globalRounds.push({
                        roundNum: roundCounter++,
                        matches: matches
                    });
                }
            }
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
