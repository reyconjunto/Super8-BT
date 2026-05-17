const GroupsMode = {
    generateRounds: (pairs, numGroups, numCourts) => {
        // 1. Separar e embaralhar as duplas
        const seeds = pairs.filter(p => p.isSeed);
        const others = pairs.filter(p => !p.isSeed);
        
        Utils.shuffle(seeds);
        Utils.shuffle(others);

        // 2. Criar os grupos vazios
        let groups = [];
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < numGroups; i++) {
            groups.push({
                id: `group_${i}`,
                name: `Grupo ${alphabet[i] || i+1}`,
                participants: []
            });
        }

        // 3. Distribuir cabeças de chave equitativamente
        let groupIndex = 0;
        while (seeds.length > 0) {
            groups[groupIndex].participants.push(seeds.pop());
            groupIndex = (groupIndex + 1) % numGroups;
        }

        // 4. Distribuir os demais participantes equitativamente
        while (others.length > 0) {
            groups[groupIndex].participants.push(others.pop());
            groupIndex = (groupIndex + 1) % numGroups;
        }

        // 5. Gerar rodadas para cada grupo usando o RoundRobin existente
        let globalRoundsMap = {}; // map de número da rodada -> array de arrays de partidas (por grupo)

        groups.forEach((group, groupIndex) => {
            const rrResult = RoundRobin.generateSubArrays(group.participants);
            
            rrResult.rounds.forEach((round) => {
                const rNum = round.roundNum;
                if (!globalRoundsMap[rNum]) {
                    globalRoundsMap[rNum] = [];
                }
                
                // Anexar informações do grupo nas partidas
                const groupMatches = round.matches.map(m => {
                    return {
                        ...m,
                        groupId: group.id,
                        groupName: group.name
                    };
                });

                globalRoundsMap[rNum].push(groupMatches);
            });
        });

        // 6. Converter o map em um array sequencial de rodadas globais (intercalando partidas de cada grupo)
        let globalRounds = [];
        let maxRounds = Math.max(...Object.keys(globalRoundsMap).map(n => parseInt(n)));

        for (let i = 1; i <= maxRounds; i++) {
            if (globalRoundsMap[i] && globalRoundsMap[i].length > 0) {
                let interleavedMatches = [];
                // Descobre o número máximo de jogos que qualquer grupo tem nesta rodada
                let maxMatchesInAnyGroup = Math.max(...globalRoundsMap[i].map(gm => gm.length));
                
                for (let mIdx = 0; mIdx < maxMatchesInAnyGroup; mIdx++) {
                    for (let gIdx = 0; gIdx < globalRoundsMap[i].length; gIdx++) {
                        if (globalRoundsMap[i][gIdx][mIdx]) {
                            interleavedMatches.push(globalRoundsMap[i][gIdx][mIdx]);
                        }
                    }
                }

                globalRounds.push({
                    roundNum: i,
                    matches: interleavedMatches
                });
            }
        }

        return {
            type: 'groups',
            rounds: globalRounds,
            groups: groups
        };
    },

    generateKnockout: (statsArray, groups, numTeamsToAdvance) => {
        // 1. Criar um ranking consolidado e classificar justamente
        let consolidated = [];

        groups.forEach(group => {
            let groupStats = statsArray.filter(s => group.participants.find(p => p.id === s.obj.id));
            groupStats = Scoring.sortRanking(groupStats);
            
            // Adicionar a posição no grupo ao objeto
            groupStats.forEach((stat, index) => {
                consolidated.push({
                    ...stat,
                    groupRank: index + 1 // 1º do grupo, 2º do grupo...
                });
            });
        });

        // 2. Ordenar o consolidado: 
        consolidated.sort((a, b) => {
            if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank; // Menor rank (1) é melhor
            
            let ptsA = (a.wins * 10) + a.sg;
            let ptsB = (b.wins * 10) + b.sg;
            if (ptsB !== ptsA) return ptsB - ptsA;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.sg !== a.sg) return b.sg - a.sg;
            return b.pro - a.pro;
        });

        // 3. Pegar os N melhores
        let qualified = consolidated.slice(0, numTeamsToAdvance).map(c => c.obj);

        // 4. Calcular o bracketSize (próxima potência de 2)
        let bracketSize = 2;
        while (bracketSize < numTeamsToAdvance) {
            bracketSize *= 2;
        }

        // 5. Preencher com BYEs
        while (qualified.length < bracketSize) {
            qualified.push({ id: 'BYE', name: 'BYE (Folga)' });
        }

        // 6. Gerar o cruzamento olímpico correto
        function getBracket(size) {
            if (size === 2) return [0, 1];
            const prev = getBracket(size / 2);
            let result = [];
            for (let i = 0; i < prev.length; i++) {
                result.push(prev[i]);
                result.push(size - 1 - prev[i]);
            }
            return result;
        }

        const seedOrder = getBracket(bracketSize);

        let matches = [];
        let matchIndex = 1;
        
        let label = "Fase Final";
        if (bracketSize === 2) label = "Final";
        else if (bracketSize === 4) label = "Semifinal";
        else if (bracketSize === 8) label = "Quartas de Final";
        else if (bracketSize === 16) label = "Oitavas de Final";

        for (let i = 0; i < seedOrder.length; i += 2) {
            let t1 = qualified[seedOrder[i]];
            let t2 = qualified[seedOrder[i + 1]];

            let isT1Bye = (t1.id === 'BYE');
            let isT2Bye = (t2.id === 'BYE');

            matches.push({
                id: `ko_m${matchIndex}`,
                t1: t1,
                t2: t2,
                score1: (isT2Bye ? 1 : (isT1Bye ? 0 : null)),
                score2: (isT1Bye ? 1 : (isT2Bye ? 0 : null)),
                finished: (isT1Bye || isT2Bye),
                groupName: label
            });

            matchIndex++;
        }
        
        return {
            roundNum: 'Mata-Mata',
            matches: matches,
            isKnockout: true,
            knockoutLabel: label
        };
    }
};
