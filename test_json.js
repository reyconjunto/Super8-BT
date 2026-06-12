let state = {
    players: [],
    tournament: { rounds: [] },
    stats: {}
};

for(let i=0; i<8; i++) {
    state.players.push({ id: 'p_'+i, name: 'P'+i, isSeed: false });
}

state.tournament.rounds.push({
    matches: [
        { t1: [ state.players[0], state.players[1] ], t2: [ state.players[2], state.players[3] ] }
    ]
});

for(let i=0; i<8; i++) {
    state.stats['p_'+i] = { obj: state.players[i], wins: 0, sg: 0, pro: 0 };
}

try {
    let j = JSON.stringify(state);
    console.log("JSON is valid! Length:", j.length);
} catch(e) {
    console.error("JSON ERROR:", e.message);
}
