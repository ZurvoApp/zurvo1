/* One layout, six worlds. A vertical owns a colour AND a vocabulary — calling a
   trek "this ride" is the tell that a product was skinned rather than built.

   The vocabulary is not decoration. Every screen reads `noun`, `plural` and
   `seats` out of here, so adding a world is adding an entry to this object and a
   colour block in globals.css — never a new screen. That constraint is the whole
   architecture: if a vertical ever needs its own layout, it is a different app. */
export const VERTICALS = {
  rides: {
    id: 'rides',
    label: 'Rides',
    noun: 'ride', // "See this ride"
    plural: 'rides',
    verb: 'ridden', // "You've ridden with both"
    seats: 'seats',
    difficulty: ['Beginner', 'Intermediate', 'Advanced'],
  },
  trails: {
    id: 'trails',
    label: 'Trails',
    noun: 'trek',
    plural: 'treks',
    verb: 'trekked',
    seats: 'spots',
    difficulty: ['Easy', 'Moderate', 'Hard'],
  },
  offroad: {
    id: 'offroad',
    label: 'Offroad',
    noun: 'run',
    plural: 'runs',
    verb: 'ridden',
    seats: 'seats',
    difficulty: ['Beginner', 'Advanced', 'Extreme'],
  },
  camps: {
    id: 'camps',
    label: 'Camps',
    noun: 'camp',
    plural: 'camps',
    verb: 'camped',
    seats: 'tents',
    difficulty: ['Easy', 'Moderate', 'Remote'],
  },
  paddle: {
    id: 'paddle',
    label: 'Paddle',
    noun: 'paddle',
    plural: 'paddles',
    verb: 'paddled',
    seats: 'boats',
    difficulty: ['Flatwater', 'Coastal', 'Whitewater'],
  },
  cycles: {
    id: 'cycles',
    label: 'Cycles',
    noun: 'cycle',
    plural: 'cycles',
    verb: 'cycled',
    seats: 'spots',
    difficulty: ['Beginner', 'Intermediate', 'Advanced'],
  },
}

export const VERTICAL_LIST = Object.values(VERTICALS)

export const copy = (vertical) => VERTICALS[vertical] ?? VERTICALS.rides
