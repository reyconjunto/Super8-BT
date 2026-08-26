// Scoring System
const Scoring = {
    // Calcula vitórias de uma partida onde [scoreA, scoreB] sao os games vencidos
    // Retorna { winsA, winsB, sgA, sgB, proA, proB }
    calculateMatchScore: (scoreA, scoreB) => {
        let winsA = 0, winsB = 0;
        
        if (scoreA > scoreB) {
            winsA = 1;
        } else if (scoreB > scoreA) {
            winsB = 1;
        } // Em caso de empate, nenhum ganha vitoria (ou eh tiebreak), mantemos 0 a 0
        
        return {
            winsA,
            winsB,
            sgA: scoreA - scoreB,
            sgB: scoreB - scoreA,
            proA: scoreA,
            proB: scoreB
        };
    },

    // Ordena o array de stats baseado nos criterios:
    // 1. Vitórias
    // 2. Saldo de Games
    // 3. Aproveitamento (% Games Pró)
    // 4. Menos jogos disputados
    // 5. Cabeça de chave
    sortRanking: (statsList) => {
        return statsList.sort((a, b) => {
            let matchesA = a.matches || 0;
            let matchesB = b.matches || 0;

            // 0. Jogadores sem partidas vão para o fim da tabela
            if (matchesA === 0 && matchesB > 0) return 1;
            if (matchesB === 0 && matchesA > 0) return -1;

            // 1. Vitórias
            if (b.wins !== a.wins) return b.wins - a.wins;
            
            // 2. Saldo de games
            if (b.sg !== a.sg) return b.sg - a.sg;
            
            // 3. Aproveitamento (% de Games Ganhos)
            let totalA = (2 * a.pro) - a.sg;
            let effA = totalA > 0 ? (a.pro / totalA) : 0;
            
            let totalB = (2 * b.pro) - b.sg;
            let effB = totalB > 0 ? (b.pro / totalB) : 0;
            
            if (effB !== effA) return effB - effA;
            
            // 4. Menos jogos disputados (eficiência)
            if (matchesA !== matchesB) return matchesA - matchesB; // Menor é melhor
            
            // 5. Cabeça de chave (Seed)
            let seedA = (a.obj && a.obj.isSeed) ? 1 : 0;
            let seedB = (b.obj && b.obj.isSeed) ? 1 : 0;
            if (seedB !== seedA) return seedB - seedA;
            
            return 0; // Empate total
        });
    }
};
