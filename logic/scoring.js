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
    // 1. Pontuação (Vitórias * 10) + SG
    // 2. Vitórias
    // 3. Saldo de Games
    // 4. Games Pró
    sortRanking: (statsList) => {
        return statsList.sort((a, b) => {
            let scoreA = (a.wins * 10) + a.sg;
            let scoreB = (b.wins * 10) + b.sg;

            // 1. Pontos totais
            if (scoreB !== scoreA) return scoreB - scoreA;
            
            // 2. Vitórias
            if (b.wins !== a.wins) return b.wins - a.wins;
            
            // 3. Saldo de games
            if (b.sg !== a.sg) return b.sg - a.sg;
            
            // 4. Games pro
            if (b.pro !== a.pro) return b.pro - a.pro;
            
            return 0; // Empate total
        });
    }
};
