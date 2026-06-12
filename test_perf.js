const Utils = {
    shuffle: (array) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
};

const numPlayers = 16;
let players = [];
for (let i=0; i<numPlayers; i++) {
    players.push({id: 'p_'+i, name: 'P'+i});
}

let numCourts = Math.floor(numPlayers / 4);
let targetMatches = numPlayers - 1; 
let totalSlotsNeeded = numPlayers * targetMatches;
let numRounds = Math.ceil(totalSlotsNeeded / (4 * numCourts));

let shuffledPlayers = Utils.shuffle([...players]);

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

console.time("generate");
for (let rIndex = 0; rIndex < numRounds; rIndex++) {
    let sortedPlayers = [...shuffledPlayers].sort((a, b) => {
        if (realMatches[a.id] !== realMatches[b.id]) return realMatches[a.id] - realMatches[b.id];
        return dummyMatches[a.id] - dummyMatches[b.id];
    });
    
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
            if (selectedPlayers.length < 4 * numCourts) selectedPlayers.push(p);
        }
    }
    
    let bestMatches = null;
    let bestPenalty = Infinity;
    
    for (let iter = 0; iter < 5000; iter++) {
        let trial = Utils.shuffle([...selectedPlayers]);
        let penalty = 0;
        let matches = [];
        
        for (let c = 0; c < numCourts; c++) {
            let A = trial[c*4];
            let B = trial[c*4+1];
            let C = trial[c*4+2];
            let D = trial[c*4+3];
            
            penalty += 100 * partnerCount[A.id][B.id];
            penalty += 100 * partnerCount[C.id][D.id];
            
            penalty += 10 * opponentCount[A.id][C.id];
            penalty += 10 * opponentCount[A.id][D.id];
            penalty += 10 * opponentCount[B.id][C.id];
            penalty += 10 * opponentCount[B.id][D.id];
            
            matches.push({ t1: [A, B], t2: [C, D], dummies: [] });
        }
        
        if (penalty < bestPenalty) {
            bestPenalty = penalty;
            bestMatches = matches;
        }
    }
    
    bestMatches.forEach(m => {
        let matchPlayers = [m.t1[0], m.t1[1], m.t2[0], m.t2[1]];
        matchPlayers.forEach(p => {
            if (realMatches[p.id] < targetMatches) realMatches[p.id]++;
            else dummyMatches[p.id]++;
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
}
console.timeEnd("generate");
