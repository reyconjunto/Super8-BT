// Round Robin for Fixed Doubles / Teams
const RoundRobin = {
    // Implementa o Algoritmo Circle Method para N equipes
    generateSubArrays: (teams) => {
        // Se for ímpar, adicionamos o "Bye" (folga)
        const isOdd = teams.length % 2 !== 0;
        let p = [...teams];
        if (isOdd) p.push({ id: 'BYE', name: 'Folga' });

        const numRounds = p.length - 1;
        const halfSize = p.length / 2;
        let rounds = [];

        for (let round = 0; round < numRounds; round++) {
            let matches = [];
            for (let i = 0; i < halfSize; i++) {
                let home = p[i];
                let away = p[p.length - 1 - i];
                
                // Ignorar a partida se algum for 'Bye'
                if (home.id !== 'BYE' && away.id !== 'BYE') {
                    matches.push({
                        id: `rr_r${round}_m${i}`,
                        t1: home,
                        t2: away,
                        score1: null,
                        score2: null,
                        finished: false
                    });
                }
            }
            rounds.push({
                roundNum: round + 1,
                matches: matches
            });

            // Rotacionar: o elemento 0 fica fixo, movemos os outros
            p.splice(1, 0, p.pop());
        }

        return {
            type: 'fixed',
            rounds: rounds,
            participants: teams
        };
    }
};
