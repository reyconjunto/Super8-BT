// Utils
const Utils = {
    // Retorna array de N elementos
    range: (n) => Array.from({ length: n }, (_, i) => i),
    
    // Embaralha um array (Fisher-Yates)
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
