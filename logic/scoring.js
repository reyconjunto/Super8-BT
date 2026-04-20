// Scoring System
const Scoring = {
    // Calcula pontos de uma partida onde [scoreA, scoreB] sao os games vencidos
    // Retorna { ptsA, ptsB, sgA, sgB } (sg = Saldo de Games)
    calculateMatchScore: (scoreA, scoreB) => {
        let ptsA = 0, ptsB = 0;
        
        if (scoreA > scoreB) {
            ptsA = 1;
        } else if (scoreB > scoreA) {
            ptsB = 1;
        } // Em caso de empate, ninguem ganha ponto de vitoria no Beach Tennis geralmente (ou eh tiebreak), mas manteremos 0 a 0
        
        return {
            ptsA,
            ptsB,
            sgA: scoreA - scoreB,
            sgB: scoreB - scoreA,
            proA: scoreA,
            proB: scoreB
        };
    },

    // Ordena o array de stats baseado nos criterios:
    // 1. Pontos (Vitórias)
    // 2. Saldo de Games
    // 3. Confronto Direto (Simples - complexo de aplicar genérico se for empate triplo, então tentaremos H2H se for 2)
    // 4. Games Pró
    sortRanking: (statsList) => {
        return statsList.sort((a, b) => {
            // 1. Pontos
            if (b.pts !== a.pts) return b.pts - a.pts;
            // 2. Saldo de games
            if (b.sg !== a.sg) return b.sg - a.sg;
            
            // 3. Confronto direto (simplificado, se h2h foi providenciado). 
            // O ideal para H2H é olhar os jogos passados, mas como a estrutura recebe apenas acumulados,
            // podemos injetar uma funcao de comparacao extra, mas usaremos Games Pro primeiro se nao houver.
            if (b.h2h_vs_a !== undefined && a.h2h_vs_b !== undefined) {
                // A logic higher up will set h2h flags if needed.
                if (b.h2h_vs_a === 1) return 1;
                if (a.h2h_vs_b === 1) return -1;
            }

            // 4. Games pro
            if (b.pro !== a.pro) return b.pro - a.pro;
            
            return 0; // Empate total
        });
    }
};
