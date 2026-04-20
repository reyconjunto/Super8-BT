// Fixed Doubles and Matrix generation
const FixedDoubles = {
    // Separa cabecas de chave e sorteia com os nao-cabecas
    drawPairs: (players) => {
        const seeds = players.filter(p => p.isSeed);
        const others = players.filter(p => !p.isSeed);
        
        // Se houverem muitos cabecas ou poucos, a regra baseia-se em tentar parear 1 cabeca com 1 nao-cabeca
        let pairs = [];
        
        Utils.shuffle(seeds);
        Utils.shuffle(others);
        
        // Emparelha ate esgotar um dos dois
        while (seeds.length > 0 && others.length > 0) {
            pairs.push([seeds.pop(), others.pop()]);
        }
        
        // O que sobrar (se sobrar de um tipo so), emparelha entre si
        let remaining = [...seeds, ...others];
        Utils.shuffle(remaining);
        
        while (remaining.length >= 2) {
            pairs.push([remaining.pop(), remaining.pop()]);
        }
        
        // formata
        return pairs.map((pair, index) => ({
            id: 'pair_' + index,
            name: `${pair[0].name} & ${pair[1].name}`,
            p1: pair[0],
            p2: pair[1]
        }));
    }
};
