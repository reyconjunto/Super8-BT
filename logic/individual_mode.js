// Mode Individual - Sorteio e Matriz
const IndividualMode = {
    // Para Super 8, usaremos uma matriz fixa matemática perfeita onde 
    // todos jogam com todos como dupla e minimiza repeticao de oponentes.
    // Jogadores indexados de 0 a 7.
    MATRIX_8: [
        [ [0,1, 2,3], [4,5, 6,7] ], // Rodada 1: (0&1 vs 2&3) e (4&5 vs 6&7)
        [ [0,2, 4,6], [1,3, 5,7] ], // Rodada 2: (0&2 vs 4&6) e (1&3 vs 5&7)
        [ [0,3, 5,6], [1,2, 4,7] ], // Rodada 3: (0&3 vs 5&6) e (1&2 vs 4&7)
        [ [0,4, 1,5], [2,6, 3,7] ], // Rodada 4
        [ [0,5, 2,7], [1,4, 3,6] ], // Rodada 5
        [ [0,6, 1,7], [2,4, 3,5] ], // Rodada 6
        [ [0,7, 3,4], [1,6, 2,5] ]  // Rodada 7
    ],

    // Gera a tabela do torneio Individual 
    // Recebe o array de jogadores (já sorteados ou na ordem da tela)
    generateRounds: (players) => {
        let rounds = [];
        let numPlayers = players.length;
        let numCourts = Math.floor(numPlayers / 4);
        
        let shuffledPlayers = Utils.shuffle([...players]);
        
        if (numPlayers === 8) {
            // Usa matriz perfeita para 8 jogadores
            IndividualMode.MATRIX_8.forEach((roundMatrix, rIndex) => {
                let matches = [];
                roundMatrix.forEach((matchIndices, mIndex) => {
                    matches.push({
                        id: `ind_r${rIndex}_m${mIndex}`,
                        t1: [ shuffledPlayers[matchIndices[0]], shuffledPlayers[matchIndices[1]] ],
                        t2: [ shuffledPlayers[matchIndices[2]], shuffledPlayers[matchIndices[3]] ],
                        dummies: [],
                        score1: null,
                        score2: null,
                        finished: false
                    });
                });
                rounds.push({
                    roundNum: rIndex + 1,
                    matches: matches
                });
            });
            return {
                type: 'individual',
                rounds: rounds,
                participants: shuffledPlayers
            };
        }

        // Lógica "Rei da Praia" para N jogadores (qualquer número >= 4)
        // Regra: Todos jogam N-1 partidas. Vagas excedentes serão preenchidas por "Dummies" (Curingas).
        let targetMatches = numPlayers - 1; 
        
        let totalSlotsNeeded = numPlayers * targetMatches;
        let numRounds = Math.ceil(totalSlotsNeeded / (4 * numCourts));

        let realMatches = {};
        let dummyMatches = {};
        let partnerCount = {};
        let opponentCount = {};
        
        shuffledPlayers.forEach(p => {
            realMatches[p.id] = 0;
            dummyMatches[p.id] = 0;
            partnerCount[p.id] = {};
            opponentCount[p.id] = {};
            shuffledPlayers.forEach(p2 => {
                partnerCount[p.id][p2.id] = 0;
                opponentCount[p.id][p2.id] = 0;
            });
        });

        for (let rIndex = 0; rIndex < numRounds; rIndex++) {
            // 1. Prioriza jogadores com menos partidas reais disputadas.
            // Em caso de empate, prioriza quem foi Curinga (Dummy) menos vezes.
            let sortedPlayers = [...shuffledPlayers].sort((a, b) => {
                if (realMatches[a.id] !== realMatches[b.id]) {
                    return realMatches[a.id] - realMatches[b.id];
                }
                return dummyMatches[a.id] - dummyMatches[b.id];
            });
            
            // Agrupa por número de partidas (reais_dummy) e embaralha para evitar vícios em empates
            let grouped = {};
            sortedPlayers.forEach(p => {
                let key = `${realMatches[p.id]}_${dummyMatches[p.id]}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(p);
            });
            
            let selectedPlayers = [];
            let keys = Object.keys(grouped).sort((a,b) => {
                let [rA, dA] = a.split('_').map(Number);
                let [rB, dB] = b.split('_').map(Number);
                if (rA !== rB) return rA - rB;
                return dA - dB;
            });
            
            for (let key of keys) {
                let group = Utils.shuffle(grouped[key]);
                for (let p of group) {
                    if (selectedPlayers.length < 4 * numCourts) {
                        selectedPlayers.push(p);
                    }
                }
            }
            
            // 2. Tenta formar as melhores combinações de duplas (menor penalidade)
            let bestMatches = null;
            let bestPenalty = Infinity;
            
            for (let iter = 0; iter < 50; iter++) {
                let trial = Utils.shuffle([...selectedPlayers]);
                let penalty = 0;
                let matches = [];
                
                for (let c = 0; c < numCourts; c++) {
                    let A = trial[c*4];
                    let B = trial[c*4+1];
                    let C = trial[c*4+2];
                    let D = trial[c*4+3];
                    
                    // Penaliza muito jogar com a mesma dupla
                    penalty += 100 * partnerCount[A.id][B.id];
                    penalty += 100 * partnerCount[C.id][D.id];
                    
                    // Penaliza jogar contra os mesmos adversários
                    penalty += 10 * opponentCount[A.id][C.id];
                    penalty += 10 * opponentCount[A.id][D.id];
                    penalty += 10 * opponentCount[B.id][C.id];
                    penalty += 10 * opponentCount[B.id][D.id];
                    
                    matches.push({
                        id: `ind_r${rIndex}_m${c}`,
                        t1: [A, B],
                        t2: [C, D],
                        dummies: [],
                        score1: null,
                        score2: null,
                        finished: false
                    });
                }
                
                if (penalty < bestPenalty) {
                    bestPenalty = penalty;
                    bestMatches = matches;
                }
            }
            
            // Aplica as melhores combinações encontradas e atribui status de Dummy
            bestMatches.forEach(m => {
                let matchPlayers = [m.t1[0], m.t1[1], m.t2[0], m.t2[1]];
                matchPlayers.forEach(p => {
                    if (realMatches[p.id] < targetMatches) {
                        realMatches[p.id]++;
                    } else {
                        dummyMatches[p.id]++;
                        m.dummies.push(p.id);
                    }
                });

                let A = m.t1[0], B = m.t1[1], C = m.t2[0], D = m.t2[1];
                partnerCount[A.id][B.id]++; partnerCount[B.id][A.id]++;
                partnerCount[C.id][D.id]++; partnerCount[D.id][C.id]++;
                
                let opps = [[A,C], [A,D], [B,C], [B,D]];
                opps.forEach(pair => {
                    opponentCount[pair[0].id][pair[1].id]++;
                    opponentCount[pair[1].id][pair[0].id]++;
                });
            });
            
            rounds.push({
                roundNum: rIndex + 1,
                matches: bestMatches
            });
        }

        return {
            type: 'individual',
            rounds: rounds,
            participants: shuffledPlayers
        };
    }
};
