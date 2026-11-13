// SafeBite's flare bank: foods often limited during a UC flare-up, matched
// against ingredients the same way as the allergy bank (see allergyBank.ts for
// how names match and why some are written longer: "bran" alone would match "brandy").
//
// Based on general low-residue / flare diet guidance (Crohn's & Colitis
// Foundation "Diet & IBD", NHS low-residue diet). UC triggers differ from person
// to person, so this is guidance, not medical advice: users can untick anything
// that doesn't bother them. `maybe` groups bother only some people and flag as
// "Check", never as not flare-friendly.
//
// Where an allergy already lists the same foods, its groups are reused so the
// two lists don't drift apart. Ids start with "flare-" so they never clash with
// allergy ids in profiles/{uid}.allergyDetails: never rename an existing id.
import { ALLERGY_BANK, type AllergyEntry, type AllergyGroup } from './allergyBank.ts'

const groupsOf = (id: string): readonly AllergyGroup[] => ALLERGY_BANK.find((a) => a.id === id)!.groups

export const FLARE_BANK: readonly AllergyEntry[] = [
  {
    id: 'flare-fiber', label: 'High-fibre grains',
    groups: [
      { label: 'Whole grains', names: ['whole wheat', 'wholewheat', 'wholemeal', 'whole grain', 'wholegrain', 'multigrain', 'brown rice', 'wild rice', 'bulgur', 'barley', 'farro', 'spelt', 'rye'] },
      { label: 'Bran & cereals', names: ['wheat bran', 'oat bran', 'bran flakes', 'bran cereal', 'granola', 'muesli'] },
      { label: 'Sometimes too much fibre', maybe: true, names: ['oats', 'oatmeal', 'quinoa', 'psyllium', 'inulin', 'chicory root'] },
    ],
  },
  {
    id: 'flare-veg', label: 'Raw & tough vegetables',
    groups: [
      { label: 'Cabbage family', names: ['broccoli', 'cauliflower', 'cabbage', 'brussels sprout', 'kale', 'collard', 'coleslaw', 'sauerkraut'] },
      { label: 'Salad & raw greens', names: ['lettuce', 'salad leaves', 'mixed greens', 'green salad', 'arugula', 'rocket leaves'] },
      { label: 'Tough & stringy', names: ['sweetcorn', 'corn on the cob', 'corn kernel', 'celery', 'asparagus', 'artichoke', 'okra'] },
      { label: 'Sometimes hard to digest', maybe: true, names: ['onion', 'garlic', 'mushroom', 'spinach', 'bell pepper'] },
    ],
  },
  {
    id: 'flare-fruit', label: 'Fruit with seeds or skins, dried fruit',
    groups: [
      { label: 'Seedy berries', names: ['raspberr', 'strawberr', 'blackberr', 'kiwi', 'fig', 'passion fruit'] },
      { label: 'Dried fruit', names: ['dried fruit', 'raisin', 'sultana', 'currant', 'prune', 'dried apricot', 'dried cranberr'] },
      { label: 'Sometimes hard to digest', maybe: true, names: ['pineapple', 'coconut', 'blueberr', 'cherries', 'grapes'] },
    ],
  },
  {
    id: 'flare-nuts-seeds', label: 'Nuts, seeds & popcorn',
    groups: [
      ...groupsOf('tree-nut').filter((g) => !g.maybe),
      { label: 'Peanuts', names: ['peanut'] },
      ...groupsOf('seeds').filter((g) => !g.maybe),
      { label: 'Sesame', names: ['sesame'] },
      { label: 'Popcorn', names: ['popcorn'] },
      { label: 'Sometimes contains nuts or seeds', maybe: true, names: ['seeds', 'nut butter', 'trail mix', 'pesto', 'tahini'] },
    ],
  },
  {
    id: 'flare-legumes', label: 'Beans & lentils',
    // Gassy and high in fibre; well-cooked and blended (hummus) is easier for some, so all "maybe".
    groups: groupsOf('legumes').map((g) => ({ ...g, maybe: true })),
  },
  {
    id: 'flare-spicy', label: 'Spicy food',
    groups: groupsOf('spicy'),
  },
  {
    id: 'flare-fatty', label: 'Fried, greasy & fatty food',
    groups: [
      { label: 'Fried', names: ['deep-fried', 'deep fried', 'fries', 'potato chips', 'tortilla chips', 'crisps', 'tempura', 'battered', 'onion rings', 'doughnut'] },
      { label: 'Very fatty', names: ['lard', 'suet', 'shortening', 'heavy cream', 'double cream', 'pastry', 'croissant'] },
      { label: 'Sometimes too fatty', maybe: true, names: ['butter', 'cream', 'cheese', 'mayonnaise', 'gravy', 'coconut milk', 'fried'] },
    ],
  },
  {
    id: 'flare-meat', label: 'Processed & red meat',
    groups: [
      { label: 'Processed meat', names: ['bacon', 'sausage', 'salami', 'pepperoni', 'hot dog', 'chorizo', 'jerky', 'ham', 'pastrami', 'corned beef'] },
      { label: 'Sometimes too fatty', maybe: true, names: ['beef', 'pork', 'lamb', 'mutton', 'brisket', 'ribs'] },
    ],
  },
  {
    id: 'flare-dairy', label: 'Dairy (lactose)',
    // Lactose often bothers people during a flare even when it doesn't otherwise.
    groups: groupsOf('lactose'),
  },
  {
    id: 'flare-alcohol', label: 'Alcohol',
    groups: groupsOf('alcohol'),
  },
  {
    id: 'flare-caffeine', label: 'Caffeine',
    groups: groupsOf('caffeine'),
  },
  {
    id: 'flare-fizzy', label: 'Fizzy drinks',
    groups: [
      { label: 'Fizzy drinks', names: ['carbonated', 'sparkling', 'soda water', 'club soda', 'soft drink', 'fizzy', 'cola', 'tonic water', 'ginger ale'] },
    ],
  },
  {
    id: 'flare-sugar', label: 'Sugar alcohols & very sugary food',
    groups: [
      ...groupsOf('sugar-alcohols'),
      { label: 'Sometimes too sugary', maybe: true, names: ['corn syrup', 'candy', 'sweets', 'syrup', 'frosting', 'icing'] },
    ],
  },
  {
    id: 'flare-additives', label: 'Emulsifiers & thickeners',
    // Early research links these to gut inflammation; evidence is still limited, so "maybe".
    groups: [
      { label: 'Emulsifiers & thickeners', maybe: true, names: ['carrageenan', 'polysorbate', 'carboxymethylcellulose', 'cellulose gum', 'e407', 'e433', 'e466'] },
    ],
  },
]
