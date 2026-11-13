// SafeBite's allergy bank: every allergy, intolerance and avoided ingredient the
// profile offers, with the names each one goes by on labels and in recipes.
//
// How matching works (lib/allergens.ts): each name matches at the start of a
// word, ignoring case, so "egg" matches "Eggs" and "corn" matches "cornstarch".
// That's why some obvious short names are left out or written longer:
//   "pea" would match "peach"/"peanut" → "peas", "pea protein"…
//   "malt" would match "maltodextrin"   → "malt extract", "malted"…
//   "masa" would match "masala"         → "masa harina"
//   "gin" would match "ginger", "til" would match "tilapia", "goose" "gooseberry"
// Known look-alikes that still match: "eggplant" (egg), "cocoa butter" (dairy),
// "water chestnut" (tree nuts), "sweet potato" (nightshades), "scalloped potatoes" (shellfish). Users can untick
// a name, or a later rules/ table can handle exceptions.
//
// So don't list what another name already catches ("milk" catches "milk powder"
// and "condensed milk"), and put other spellings in SPELLINGS below, not in a
// group: the profile shows one name, and matching still finds them all. A
// different food that shares a word stays listed so it can be unticked by itself
// ("buttermilk", "ice cream"). test/allergyBank.test.mjs checks this.
//
// Groups with `maybe: true` only sometimes contain the allergy: they're shown
// in amber and flag as "Check", never "Contains". Users can untick any name or group.
// `common: true` puts the allergy in the main checkbox list; the rest are under "More".
//
// The ids are stored in profiles/{uid}.allergens: never rename an existing id.
// Checked 2026-11-13 against Open Food Facts' English allergen names (test/offTags.test.mjs); other languages not checked.

export interface AllergyGroup {
  label: string
  names: readonly string[]
  maybe?: boolean
}

export interface AllergyEntry {
  id: string
  label: string
  common?: boolean
  groups: readonly AllergyGroup[]
}

// Ways of writing the same name. The first is the one the bank lists and the
// profile shows; labels and recipes can use any of them, so all must keep matching.
export const SPELLINGS: readonly (readonly string[])[] = [
  ['yogurt', 'yoghurt'],
  ['albumin', 'albumen'],
  ['mayonnaise', 'mayo'],
  ['matzo', 'matzah'],
  ['lasagna', 'lasagne'],
  ['pollock', 'pollack'],
  ['crawfish', 'crayfish'],
  ['tahini', 'tahina'],
  ['soy', 'soja', 'soia'],
  ['sulfite', 'sulphite'],
  ['bisulfite', 'bisulphite'],
  ['metabisulfite', 'metabisulphite'],
  ['sulfur dioxide', 'sulphur dioxide'],
  ['fava', 'faba'],
  ['adzuki', 'azuki'],
  ['dal', 'dhal'],
  ['chili', 'chilli'],
  ['jalapeno', 'jalapeño'],
  ['pimento', 'pimiento'],
  ['peri-peri', 'piri piri'],
  ['whiskey', 'whisky'],
  ['sugar-free', 'sugar free'],
  ['artificial color', 'artificial colour'],
  ['artificial flavor', 'artificial flavour'],
  ['color added', 'colour added'],
  ['red 40', 'red #40', 'red no. 40'],
  ['yellow 5', 'yellow #5', 'yellow no. 5'],
  ['yellow 6', 'yellow #6', 'yellow no. 6'],
  ['blue 1', 'blue #1'],
  ['nature-identical', 'nature identical'],
  ['diglycerides', 'mono- and diglycerides', 'mono and diglycerides'],
  ['thiamine mononitrate', 'thiamin mononitrate'],
]

export const ALLERGY_BANK: readonly AllergyEntry[] = [
  // ---- The 9 major allergens (US FDA), common to most lists worldwide ----
  {
    id: 'dairy', label: 'Dairy (milk)', common: true,
    groups: [
      { label: 'Milk & cream', names: ['milk', 'dairy', 'cream', 'buttermilk', 'half-and-half', 'kefir'] },
      { label: 'Butter', names: ['butter', 'ghee'] },
      { label: 'Cheese', names: ['cheese', 'curd', 'paneer', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'brie', 'gouda', 'gruyere', 'halloumi', 'mascarpone', 'quark', 'pecorino', 'stilton', 'gorgonzola', 'roquefort', 'camembert', 'emmental', 'provolone', 'manchego', 'monterey jack', 'colby', 'edam', 'fontina', 'taleggio', 'grana padano', 'parmigiano'] },
      { label: 'Yogurt', names: ['yogurt', 'skyr', 'labneh', 'lassi'] },
      { label: 'Milk proteins & sugars', names: ['whey', 'casein', 'lactalbumin', 'lactoglobulin', 'lactose'] },
      { label: 'Dishes & desserts', names: ['custard', 'ice cream', 'gelato', 'bechamel', 'alfredo'] },
      { label: 'Sometimes contains dairy', maybe: true, names: ['natural flavor', 'chocolate', 'margarine', 'nougat', 'caramel', 'lactic acid', 'ranch'] },
    ],
  },
  {
    id: 'egg', label: 'Eggs', common: true,
    groups: [
      { label: 'Eggs', names: ['egg', 'eggnog'] },
      { label: 'Egg proteins', names: ['albumin', 'ovalbumin', 'ovomucoid', 'ovomucin', 'ovovitellin', 'livetin', 'lysozyme', 'vitellin'] },
      { label: 'Sauces & dishes', names: ['mayonnaise', 'aioli', 'hollandaise', 'bearnaise', 'meringue', 'custard', 'quiche', 'frittata', 'souffle'] },
      { label: 'Sometimes contains egg', maybe: true, names: ['noodle', 'pasta', 'batter', 'glaze', 'marshmallow', 'nougat', 'surimi'] },
    ],
  },
  {
    id: 'gluten', label: 'Gluten / wheat', common: true,
    groups: [
      { label: 'Wheat & relatives', names: ['wheat', 'spelt', 'kamut', 'khorasan', 'einkorn', 'emmer', 'farro', 'durum', 'semolina', 'farina', 'triticale', 'freekeh', 'graham'] },
      { label: 'Barley & rye', names: ['barley', 'rye', 'malt extract', 'malt vinegar', 'malt syrup', 'malt flavoring', 'malted'] },
      { label: 'Gluten & wheat products', names: ['gluten', 'seitan', 'bulgur', 'couscous', 'orzo', 'udon', 'panko', 'matzo'] },
      { label: 'Sometimes contains gluten', maybe: true, names: ['flour', 'bread', 'crouton', 'cracker', 'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'tagliatelle', 'macaroni', 'lasagna', 'rigatoni', 'farfalle', 'noodle', 'ramen', 'gnocchi', 'batter', 'soy sauce', 'beer', 'oat', "brewer's yeast", 'dextrin'] },
    ],
  },
  {
    id: 'peanut', label: 'Peanuts', common: true,
    groups: [
      { label: 'Peanuts', names: ['peanut', 'groundnut', 'arachis', 'monkey nut', 'goober', 'mandelona'] },
      { label: 'Sometimes contains peanuts', maybe: true, names: ['satay', 'mixed nut', 'nut oil', 'nut butter', 'praline'] },
    ],
  },
  {
    id: 'tree-nut', label: 'Tree nuts', common: true,
    groups: [
      { label: 'Almonds', names: ['almond'] },
      { label: 'Brazil nuts', names: ['brazil nut'] },
      { label: 'Cashews', names: ['cashew'] },
      { label: 'Chestnuts', names: ['chestnut'] },
      { label: 'Hazelnuts', names: ['hazelnut', 'filbert', 'nutella', 'gianduja'] },
      { label: 'Macadamias', names: ['macadamia'] },
      { label: 'Pecans', names: ['pecan'] },
      { label: 'Pine nuts', names: ['pine nut', 'pignoli'] },
      { label: 'Pistachios', names: ['pistachio'] },
      { label: 'Walnuts', names: ['walnut'] },
      { label: 'Other tree nuts', names: ['hickory nut', 'beechnut'] },
      { label: 'Nut products', names: ['nuts', 'treenut', 'praline', 'marzipan', 'frangipane'] },
      { label: 'Sometimes contains tree nuts', maybe: true, names: ['nougat', 'pesto', 'nut oil', 'nut butter', 'amaretto', 'amaretti'] },
    ],
  },
  {
    id: 'soy', label: 'Soy', common: true,
    groups: [
      { label: 'Soybeans', names: ['soy', 'edamame', 'kinako'] },
      { label: 'Soy foods', names: ['tofu', 'miso', 'tempeh', 'tamari', 'natto', 'shoyu', 'yuba', 'okara', 'textured vegetable protein', 'tvp'] },
      { label: 'Sometimes contains soy', maybe: true, names: ['lecithin', 'vegetable protein', 'vegetable oil', 'vegetable broth', 'teriyaki', 'hoisin'] },
    ],
  },
  {
    id: 'fish', label: 'Fish', common: true,
    groups: [
      { label: 'Fish', names: ['fish', 'anchov', 'salmon', 'tuna', 'cod', 'haddock', 'hake', 'pollock', 'tilapia', 'trout', 'sardine', 'mackerel', 'herring', 'halibut', 'snapper', 'bass', 'catfish', 'whitefish', 'monkfish', 'swordfish', 'flounder', 'grouper', 'perch', 'pike', 'mahi', 'bonito', 'eel', 'turbot', 'sole'] },
      { label: 'Fish products', names: ['roe', 'caviar', 'surimi', 'katsuobushi', 'nam pla', 'bottarga', 'isinglass'] },
      { label: 'Sometimes contains fish', maybe: true, names: ['worcestershire', 'caesar', 'dashi', 'omega-3'] },
    ],
  },
  {
    id: 'shellfish', label: 'Shellfish', common: true,
    groups: [
      { label: 'Crustaceans', names: ['shellfish', 'crustacean', 'shrimp', 'prawn', 'crab', 'lobster', 'crawfish', 'langoustine', 'scampi', 'krill'] },
      { label: 'Molluscs', names: ['mollus', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'cuttlefish', 'snail', 'escargot', 'abalone', 'whelk', 'cockle', 'conch', 'sea urchin'] },
      { label: 'Sometimes contains shellfish', maybe: true, names: ['seafood', 'paella', 'bouillabaisse', 'glucosamine'] },
    ],
  },
  {
    id: 'sesame', label: 'Sesame', common: true,
    groups: [
      { label: 'Sesame', names: ['sesame', 'tahini', 'benne', 'gomasio', 'gingelly', 'sesamol'] },
      { label: 'Sometimes contains sesame', maybe: true, names: ['halva', 'hummus', "za'atar", 'dukkah', 'furikake'] },
    ],
  },

  // ---- Also major allergens in the EU / UK / Canada ----
  {
    id: 'celery', label: 'Celery',
    groups: [
      { label: 'Celery', names: ['celery', 'celeriac'] },
      { label: 'Sometimes contains celery', maybe: true, names: ['stock', 'bouillon', 'broth', 'seasoning', 'uncured'] },
    ],
  },
  {
    id: 'mustard', label: 'Mustard',
    groups: [
      { label: 'Mustard', names: ['mustard', 'dijon'] },
      { label: 'Sometimes contains mustard', maybe: true, names: ['spice', 'seasoning', 'curry', 'vinaigrette', 'dressing', 'pickle', 'relish', 'mayonnaise'] },
    ],
  },
  {
    id: 'lupin', label: 'Lupin',
    groups: [
      { label: 'Lupin', names: ['lupin'] },
      { label: 'Sometimes contains lupin', maybe: true, names: ['legume flour', 'gluten-free flour'] },
    ],
  },
  {
    id: 'sulfites', label: 'Sulfites',
    groups: [
      { label: 'Sulfites', names: ['sulfite', 'bisulfite', 'metabisulfite', 'sulfur dioxide'] },
      { label: 'E-numbers', names: ['e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228'] },
      { label: 'Sometimes contains sulfites', maybe: true, names: ['dried fruit', 'raisin', 'dried apricot', 'wine', 'vinegar', 'molasses', 'pickled', 'grape juice'] },
    ],
  },

  // ---- Other foods ----
  {
    id: 'corn', label: 'Corn',
    groups: [
      // dextrose and maltodextrin are usually corn-derived in the US
      { label: 'Corn', names: ['corn', 'popcorn', 'sweetcorn', 'maize', 'polenta', 'grits', 'hominy', 'masa harina', 'masa flour', 'zein'] },
      { label: 'Corn sugars', names: ['dextrose', 'maltodextrin'] },
      { label: 'Sometimes contains corn', maybe: true, names: ['glucose syrup', 'modified starch', 'vegetable oil', 'xanthan', 'citric acid', 'caramel color', 'baking powder', 'sorbitol', 'tortilla'] },
    ],
  },
  {
    id: 'coconut', label: 'Coconut',
    groups: [
      { label: 'Coconut', names: ['coconut', 'copra'] },
      { label: 'Sometimes contains coconut', maybe: true, names: ['mct oil', 'vegetable fat'] },
    ],
  },
  {
    id: 'legumes', label: 'Legumes (beans, lentils, peas)',
    groups: [
      { label: 'Beans', names: ['beans', 'black bean', 'kidney bean', 'pinto bean', 'navy bean', 'white bean', 'lima bean', 'mung bean', 'cannellini', 'fava', 'adzuki'] },
      { label: 'Lentils & chickpeas', names: ['lentil', 'chickpea', 'garbanzo', 'hummus', 'falafel', 'gram flour', 'besan', 'dal'] },
      { label: 'Peas', names: ['peas', 'pea protein', 'pea flour', 'pea starch', 'pea fiber', 'split pea', 'green pea', 'black-eyed'] },
      { label: 'Sometimes contains legumes', maybe: true, names: ['guar', 'locust bean', 'carob', 'tamarind', 'fenugreek', 'vegetable protein'] },
    ],
  },
  {
    id: 'lactose', label: 'Lactose (intolerance)',
    groups: [
      { label: 'High in lactose', names: ['lactose', 'milk', 'cream', 'ice cream', 'whey', 'buttermilk', 'ricotta', 'cottage cheese', 'cream cheese', 'custard'] },
      { label: 'Usually low in lactose', maybe: true, names: ['yogurt', 'kefir', 'butter', 'cheese', 'chocolate', 'caramel', 'nougat'] },
    ],
  },
  {
    id: 'nightshades', label: 'Nightshades',
    groups: [
      { label: 'Tomatoes', names: ['tomato', 'tomatillo', 'ketchup', 'marinara', 'salsa'] },
      { label: 'Potatoes', names: ['potato'] },
      { label: 'Eggplant', names: ['eggplant', 'aubergine'] },
      { label: 'Peppers & chili', names: ['bell pepper', 'red pepper', 'green pepper', 'capsicum', 'chili', 'cayenne', 'paprika', 'jalapeno', 'habanero', 'chipotle', 'pimento', 'sriracha', 'hot sauce', 'harissa', 'gochujang'] },
      { label: 'Other nightshades', names: ['goji', 'ashwagandha'] },
      { label: 'Sometimes contains nightshades', maybe: true, names: ['spice', 'seasoning', 'curry', 'barbecue', 'modified starch'] },
    ],
  },
  {
    id: 'alliums', label: 'Garlic & onion',
    groups: [
      { label: 'Garlic', names: ['garlic', 'aioli'] },
      { label: 'Onions', names: ['onion', 'shallot', 'scallion', 'leek', 'chive'] },
      { label: 'Sometimes contains garlic or onion', maybe: true, names: ['natural flavor', 'spice', 'seasoning', 'stock', 'bouillon', 'broth'] },
    ],
  },
  {
    id: 'spicy', label: 'Spicy food (chili)',
    groups: [
      { label: 'Chili peppers', names: ['chili', 'cayenne', 'jalapeno', 'habanero', 'chipotle', 'scotch bonnet', 'ghost pepper', 'capsaicin', 'red pepper flakes', 'crushed red pepper'] },
      { label: 'Hot sauces & pastes', names: ['hot sauce', 'sriracha', 'tabasco', 'harissa', 'gochujang', 'sambal', 'peri-peri', 'buffalo sauce'] },
      { label: 'Sometimes spicy', maybe: true, names: ['curry', 'paprika', 'wasabi', 'horseradish', 'spice'] },
    ],
  },
  {
    id: 'citrus', label: 'Citrus fruit',
    groups: [
      { label: 'Citrus', names: ['citrus', 'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'mandarin', 'clementine', 'citron', 'yuzu', 'kumquat', 'bergamot', 'pomelo', 'marmalade'] },
      { label: 'Sometimes from citrus', maybe: true, names: ['citric acid', 'pectin', 'natural flavor'] },
    ],
  },
  {
    id: 'mushrooms', label: 'Mushrooms',
    groups: [
      { label: 'Mushrooms', names: ['mushroom', 'shiitake', 'portobello', 'porcini', 'chanterelle', 'enoki', 'maitake', 'cremini', 'morel', 'matsutake', 'mycoprotein'] },
      { label: 'Sometimes contains mushrooms', maybe: true, names: ['truffle', 'umami seasoning'] },
    ],
  },
  {
    id: 'seeds', label: 'Seeds',
    groups: [
      { label: 'Seeds', names: ['sunflower', 'poppy', 'pumpkin seed', 'pepita', 'flax', 'linseed', 'chia', 'hemp', 'nigella'] },
      { label: 'Sometimes contains seeds', maybe: true, names: ['seed oil', 'seeds', 'multigrain', 'psyllium'] },
    ],
  },
  {
    id: 'buckwheat', label: 'Buckwheat',
    groups: [
      { label: 'Buckwheat', names: ['buckwheat', 'soba', 'kasha'] },
      { label: 'Sometimes contains buckwheat', maybe: true, names: ['galette', 'crepe', 'blini'] },
    ],
  },

  // ---- Meat, animal products and drinks (dietary, religious or alpha-gal) ----
  {
    id: 'red-meat', label: 'Red meat (beef, pork, lamb)',
    groups: [
      { label: 'Beef', names: ['beef', 'veal', 'brisket', 'sirloin', 'hamburger', 'pastrami'] },
      { label: 'Pork', names: ['pork', 'ham', 'bacon', 'prosciutto', 'pancetta', 'guanciale', 'chorizo', 'mortadella', 'lard'] },
      { label: 'Lamb & goat', names: ['lamb', 'mutton', 'goat meat'] },
      { label: 'Game', names: ['venison', 'bison', 'elk', 'rabbit', 'boar'] },
      { label: 'Animal fats', names: ['tallow', 'suet', 'dripping'] },
      { label: 'Sometimes contains red meat', maybe: true, names: ['sausage', 'hot dog', 'pepperoni', 'salami', 'jerky', 'meatball', 'gelatin', 'collagen', 'bone broth'] },
    ],
  },
  {
    id: 'poultry', label: 'Poultry',
    groups: [
      { label: 'Poultry', names: ['poultry', 'chicken', 'turkey', 'duck', 'goose fat', 'quail', 'pheasant'] },
      { label: 'Sometimes contains poultry', maybe: true, names: ['stock', 'bouillon', 'broth', 'sausage'] },
    ],
  },
  {
    id: 'gelatin', label: 'Gelatin',
    groups: [
      { label: 'Gelatin', names: ['gelatin', 'collagen', 'aspic', 'isinglass', 'e441'] },
      { label: 'Sometimes contains gelatin', maybe: true, names: ['marshmallow', 'gummy', 'gummies', 'jelly', 'panna cotta', 'capsule'] },
    ],
  },
  {
    id: 'caffeine', label: 'Caffeine',
    groups: [
      { label: 'Coffee & caffeine', names: ['caffeine', 'coffee', 'espresso'] },
      { label: 'Tea', names: ['black tea', 'green tea', 'oolong', 'matcha', 'yerba mate'] },
      { label: 'Other sources', names: ['guarana', 'cola', 'kola nut', 'energy drink'] },
      { label: 'Sometimes contains caffeine', maybe: true, names: ['tea', 'chai', 'chocolate', 'cocoa', 'cacao'] },
    ],
  },
  {
    id: 'alcohol', label: 'Alcohol',
    groups: [
      { label: 'Wine & beer', names: ['wine', 'beer', 'champagne', 'sherry', 'vermouth', 'marsala', 'mirin', 'sake', 'mead'] },
      { label: 'Spirits & liqueurs', names: ['rum', 'vodka', 'brandy', 'cognac', 'bourbon', 'whiskey', 'tequila', 'kirsch', 'liqueur', 'amaretto', 'cointreau'] },
      { label: 'Alcohol', names: ['ethyl alcohol', 'ethanol'] },
      { label: 'Sometimes contains alcohol', maybe: true, names: ['vanilla extract', 'cider', 'kombucha', 'alcohol'] },
    ],
  },

  // ---- Additives and manufactured ingredients ----
  {
    id: 'msg', label: 'MSG & glutamates',
    groups: [
      { label: 'Glutamates', names: ['msg', 'monosodium glutamate', 'glutamate', 'glutamic acid', 'e621'] },
      { label: 'Flavour enhancers', names: ['disodium inosinate', 'disodium guanylate', 'e627', 'e631'] },
      { label: 'Sometimes contains glutamates', maybe: true, names: ['yeast extract', 'autolyzed yeast', 'hydrolyzed', 'soy sauce', 'bouillon', 'natural flavor', 'seasoning'] },
    ],
  },
  {
    id: 'sugar-alcohols', label: 'Sugar alcohols (polyols)',
    groups: [
      { label: 'Sugar alcohols', names: ['sugar alcohol', 'sorbitol', 'xylitol', 'maltitol', 'erythritol', 'mannitol', 'isomalt', 'lactitol', 'hydrogenated starch hydrolysate'] },
      { label: 'E-numbers', names: ['e420', 'e421', 'e953', 'e965', 'e966', 'e967', 'e968'] },
      { label: 'Sometimes contains sugar alcohols', maybe: true, names: ['sugar-free', 'no sugar added', 'polyol'] },
    ],
  },
  {
    // A broad category rather than one food: ingredients made synthetically or heavily processed in a lab.
    id: 'artificial', label: 'Artificial & synthetic ingredients',
    groups: [
      {
        label: 'Artificial colours',
        names: [
          'artificial color', 'fd&c', 'red 3', 'red 40', 'yellow 5',
          'yellow 6', 'blue 1', 'blue 2', 'green 3', 'citrus red', 'orange b', 'allura red',
          'tartrazine', 'sunset yellow', 'brilliant blue', 'indigo carmine', 'erythrosine', 'fast green', 'titanium dioxide',
          'e102', 'e104', 'e110', 'e122', 'e124', 'e127', 'e129', 'e132', 'e133', 'e143', 'e171',
        ],
      },
      { label: 'Artificial flavours', names: ['artificial flavor', 'artificially flavored', 'synthetic flavor', 'nature-identical', 'imitation', 'ethyl vanillin'] },
      {
        label: 'Artificial sweeteners',
        names: ['artificial sweetener', 'aspartame', 'sucralose', 'saccharin', 'acesulfame', 'ace-k', 'neotame', 'advantame', 'cyclamate', 'e950', 'e951', 'e952', 'e954', 'e955', 'e961', 'e962'],
      },
      {
        label: 'Synthetic preservatives',
        names: [
          'bha', 'bht', 'tbhq', 'propyl gallate', 'sodium benzoate', 'potassium benzoate', 'benzoic acid', 'sodium nitrite', 'sodium nitrate',
          'potassium nitrate', 'calcium propionate', 'edta', 'e211', 'e249', 'e250', 'e251', 'e252', 'e310', 'e319', 'e320', 'e321',
        ],
      },
      {
        label: 'Synthetic emulsifiers & thickeners',
        names: [
          'polysorbate', 'carboxymethylcellulose', 'cellulose gum', 'methylcellulose', 'hydroxypropyl',
          'monoglycerides', 'diglycerides', 'datem', 'sodium stearoyl lactylate', 'propylene glycol', 'e433', 'e466', 'e471', 'e472',
        ],
      },
      { label: 'Hydrogenated & modified fats', names: ['hydrogenated', 'interesterified', 'trans fat'] },
      { label: 'Processed starches & syrups', names: ['modified starch', 'modified food starch', 'modified corn starch', 'high fructose corn syrup'] },
      {
        label: 'Synthetic vitamins',
        names: [
          'folic acid', 'cyanocobalamin', 'thiamine mononitrate', 'pyridoxine hydrochloride', 'riboflavin-5', 'niacinamide',
          'dl-alpha tocopherol', 'dl-alpha-tocopheryl', 'retinyl palmitate', 'retinyl acetate', 'menadione', 'cholecalciferol',
        ],
      },
      {
        label: 'Sometimes artificial or synthetic',
        maybe: true,
        names: ['vanillin', 'color added', 'caramel color', 'flavoring', 'potassium sorbate', 'sorbic acid', 'msg', 'monosodium glutamate', 'carrageenan', 'maltodextrin', 'shortening', 'margarine', 'enriched'],
      },
    ],
  },
]
