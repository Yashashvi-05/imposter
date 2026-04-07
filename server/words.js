const WORD_PAIRS = [
  // Food & Drink
  { crew: 'Coffee', imposter: 'Tea' },
  { crew: 'Pizza', imposter: 'Flatbread' },
  { crew: 'Chocolate', imposter: 'Caramel' },
  { crew: 'Burger', imposter: 'Sandwich' },
  { crew: 'Sushi', imposter: 'Sashimi' },
  { crew: 'Ice Cream', imposter: 'Yoghurt' },
  { crew: 'Pasta', imposter: 'Noodles' },
  { crew: 'Bread', imposter: 'Cake' },
  { crew: 'Beer', imposter: 'Cider' },
  { crew: 'Juice', imposter: 'Smoothie' },
  { crew: 'Pancake', imposter: 'Waffle' },
  { crew: 'Soup', imposter: 'Stew' },
  { crew: 'Salad', imposter: 'Coleslaw' },
  { crew: 'Donut', imposter: 'Bagel' },
  { crew: 'Cheese', imposter: 'Butter' },

  // Nature & Geography
  { crew: 'Ocean', imposter: 'River' },
  { crew: 'Volcano', imposter: 'Geyser' },
  { crew: 'Tornado', imposter: 'Hurricane' },
  { crew: 'Waterfall', imposter: 'Fountain' },
  { crew: 'Desert', imposter: 'Savanna' },
  { crew: 'Forest', imposter: 'Jungle' },
  { crew: 'Mountain', imposter: 'Hill' },
  { crew: 'Island', imposter: 'Peninsula' },
  { crew: 'Cave', imposter: 'Tunnel' },
  { crew: 'Glacier', imposter: 'Iceberg' },
  { crew: 'Meadow', imposter: 'Marsh' },
  { crew: 'Canyon', imposter: 'Valley' },

  // Animals
  { crew: 'Elephant', imposter: 'Rhinoceros' },
  { crew: 'Dolphin', imposter: 'Shark' },
  { crew: 'Eagle', imposter: 'Hawk' },
  { crew: 'Lion', imposter: 'Tiger' },
  { crew: 'Frog', imposter: 'Toad' },
  { crew: 'Butterfly', imposter: 'Moth' },
  { crew: 'Crocodile', imposter: 'Alligator' },
  { crew: 'Penguin', imposter: 'Puffin' },
  { crew: 'Rabbit', imposter: 'Hare' },
  { crew: 'Crow', imposter: 'Raven' },
  { crew: 'Lobster', imposter: 'Crab' },
  { crew: 'Cheetah', imposter: 'Leopard' },

  // Places & Buildings
  { crew: 'Castle', imposter: 'Mansion' },
  { crew: 'Hospital', imposter: 'Clinic' },
  { crew: 'Library', imposter: 'Bookstore' },
  { crew: 'Museum', imposter: 'Gallery' },
  { crew: 'Prison', imposter: 'School' },
  { crew: 'Lighthouse', imposter: 'Streetlight' },
  { crew: 'Temple', imposter: 'Church' },
  { crew: 'Stadium', imposter: 'Arena' },
  { crew: 'Hotel', imposter: 'Hostel' },
  { crew: 'Airport', imposter: 'Train Station' },
  { crew: 'Supermarket', imposter: 'Convenience Store' },
  { crew: 'Theatre', imposter: 'Cinema' },

  // Objects & Tech
  { crew: 'Guitar', imposter: 'Violin' },
  { crew: 'Diamond', imposter: 'Crystal' },
  { crew: 'Submarine', imposter: 'Boat' },
  { crew: 'Skateboard', imposter: 'Surfboard' },
  { crew: 'Microwave', imposter: 'Oven' },
  { crew: 'Compass', imposter: 'GPS' },
  { crew: 'Telescope', imposter: 'Microscope' },
  { crew: 'Bank', imposter: 'Wallet' },
  { crew: 'Parachute', imposter: 'Umbrella' },
  { crew: 'Fireplace', imposter: 'Radiator' },
  { crew: 'Mirror', imposter: 'Window' },
  { crew: 'Passport', imposter: 'License' },
  { crew: 'Sword', imposter: 'Knife' },
  { crew: 'Candle', imposter: 'Torch' },
  { crew: 'Clock', imposter: 'Stopwatch' },
  { crew: 'Rifle', imposter: 'Pistol' },
  { crew: 'Piano', imposter: 'Keyboard' },
  { crew: 'Headphones', imposter: 'Earbuds' },
  { crew: 'Camera', imposter: 'Binoculars' },
  { crew: 'Hammer', imposter: 'Wrench' },

  // People & Roles
  { crew: 'Astronaut', imposter: 'Pilot' },
  { crew: 'Doctor', imposter: 'Nurse' },
  { crew: 'Chef', imposter: 'Baker' },
  { crew: 'Lawyer', imposter: 'Judge' },
  { crew: 'Teacher', imposter: 'Professor' },
  { crew: 'Soldier', imposter: 'Police' },
  { crew: 'Farmer', imposter: 'Gardener' },
  { crew: 'Magician', imposter: 'Illusionist' },
  { crew: 'Spy', imposter: 'Detective' },
  { crew: 'Architect', imposter: 'Engineer' },

  // Science & Space
  { crew: 'Pyramid', imposter: 'Triangle' },
  { crew: 'Symphony', imposter: 'Concert' },
  { crew: 'Campfire', imposter: 'Bonfire' },
  { crew: 'Black Hole', imposter: 'Wormhole' },
  { crew: 'Comet', imposter: 'Meteor' },
  { crew: 'Planet', imposter: 'Moon' },
  { crew: 'Atom', imposter: 'Molecule' },
  { crew: 'Battery', imposter: 'Capacitor' },
  { crew: 'Vaccine', imposter: 'Medicine' },
  { crew: 'Robot', imposter: 'Android' },

  // Sports & Games
  { crew: 'Football', imposter: 'Rugby' },
  { crew: 'Tennis', imposter: 'Badminton' },
  { crew: 'Chess', imposter: 'Checkers' },
  { crew: 'Swimming', imposter: 'Diving' },
  { crew: 'Boxing', imposter: 'Wrestling' },
  { crew: 'Marathon', imposter: 'Sprint' },
  { crew: 'Bowling', imposter: 'Billiards' },
  { crew: 'Archery', imposter: 'Darts' },
];

function getRandomPair(customPair) {
  if (customPair && customPair.crew && customPair.imposter) return customPair;
  const idx = Math.floor(Math.random() * WORD_PAIRS.length);
  return WORD_PAIRS[idx];
}

module.exports = { WORD_PAIRS, getRandomPair };
