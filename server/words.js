const CATEGORY_WORDS = {
  food: ['Coffee', 'Pizza', 'Chocolate', 'Pasta', 'Burger', 'Sushi', 'Donut', 'Soup'],
  nature: ['Ocean', 'Volcano', 'Forest', 'Mountain', 'River', 'Desert', 'Waterfall', 'Island'],
  animals: ['Elephant', 'Lion', 'Shark', 'Penguin', 'Rabbit', 'Tiger', 'Eagle', 'Crocodile'],
  places: ['Castle', 'Hospital', 'Library', 'Museum', 'Airport', 'Stadium', 'Temple', 'Hotel'],
  objects: ['Guitar', 'Compass', 'Camera', 'Passport', 'Mirror', 'Clock', 'Submarine', 'Sword'],
  people: ['Doctor', 'Teacher', 'Lawyer', 'Chef', 'Astronaut', 'Engineer', 'Detective', 'Farmer'],
  science: ['Planet', 'Comet', 'Black Hole', 'Robot', 'Battery', 'Atom', 'Vaccine', 'Meteor'],
  sports: ['Football', 'Tennis', 'Chess', 'Swimming', 'Boxing', 'Marathon', 'Archery', 'Rugby'],
};

const categories = Object.keys(CATEGORY_WORDS);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomPair(customPair) {
  if (customPair && customPair.crew && customPair.imposter) return customPair;

  const crewCategory = pick(categories);
  const imposterCategoryOptions = categories.filter(c => c !== crewCategory);
  const imposterCategory = pick(imposterCategoryOptions);

  return {
    crew: pick(CATEGORY_WORDS[crewCategory]),
    imposter: pick(CATEGORY_WORDS[imposterCategory]),
  };
}

module.exports = { CATEGORY_WORDS, getRandomPair };
