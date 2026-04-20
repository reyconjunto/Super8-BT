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
    // Recebe o array de 8 objetos jogador (já sorteados ou na ordem da tela)
    generateRounds: (players) => {
        if (players.length !== 8) {
            console.error("Super 8 exige exatamente 8 jogadores. Implementar logica generica se necessario.");
            // Para escopo inicial flexível, embaralhamos a lista
        }

        let rounds = [];
        // Embaralhar para não ser previsível quem vai jogar com quem baseado na ordem de input
        let shuffledPlayers = Utils.shuffle([...players]);

        IndividualMode.MATRIX_8.forEach((roundMatrix, rIndex) => {
            let matches = [];
            roundMatrix.forEach((matchIndices, mIndex) => {
                matches.push({
                    id: `ind_r${rIndex}_m${mIndex}`,
                    t1: [ shuffledPlayers[matchIndices[0]], shuffledPlayers[matchIndices[1]] ],
                    t2: [ shuffledPlayers[matchIndices[2]], shuffledPlayers[matchIndices[3]] ],
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
};
