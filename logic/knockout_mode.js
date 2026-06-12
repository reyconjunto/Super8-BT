const KnockoutMode = {
    generateInitialRound: (pairs) => {
        // Clone para não modificar o array original
        let participants = [...pairs];
        
        // Separar cabeças de chave e os demais
        const seeds = participants.filter(p => p.isSeed);
        const others = participants.filter(p => !p.isSeed);
        
        Utils.shuffle(seeds);
        Utils.shuffle(others);
        
        // Rejuntar
        let qualified = [...seeds, ...others];
        
        // Calcular o tamanho da chave (bracketSize) - próxima potência de 2
        let bracketSize = 2;
        while (bracketSize < qualified.length) {
            bracketSize *= 2;
        }

        // Preencher com BYEs
        while (qualified.length < bracketSize) {
            qualified.push({ id: 'BYE', name: 'BYE (Folga)' });
        }

        // Gerar o cruzamento olímpico correto
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
        else if (bracketSize === 32) label = "Dezesseis avos de Final";

        for (let i = 0; i < seedOrder.length; i += 2) {
            let t1 = qualified[seedOrder[i]];
            let t2 = qualified[seedOrder[i + 1]];

            let isT1Bye = (t1.id === 'BYE');
            let isT2Bye = (t2.id === 'BYE');

            matches.push({
                id: `ko_start_m${matchIndex}`,
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
            type: 'knockout',
            rounds: [{
                roundNum: 1,
                matches: matches,
                isKnockout: true,
                knockoutLabel: label
            }]
        };
    }
};
