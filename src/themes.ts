// Built-in word themes (unlocked in the notebook). Plain a-z words only.
const t = (s: string) => s.split(/\s+/).filter(Boolean);
export const THEMES: Record<string, { name: string; words: string[] }> = {
  nature: { name: 'Nature', words: t(`
    oak elm fir ivy bud sap fog dew bee ant
    moss fern leaf root seed pine reed lake pond rain wind snow hill dune cave bark thorn
    river creek ocean beach meadow forest canyon island glacier valley summit orchid tulip daisy lotus maple cedar birch willow
    thicket blossom pebble cliffside rainfall wildfire sunlight mushroom dragonfly hummingbird
    stream marsh grove cliff cloud storm frost petal acorn clover sprout`) },
  space: { name: 'Space', words: t(`
    sun orb gas ion
    moon mars star nova void dust halo mass flux
    orbit comet lunar solar probe pulsar quasar nebula galaxy cosmos meteor saturn jupiter uranus
    eclipse horizon asteroid satellite telescope spacecraft starlight stardust gravity vacuum
    rocket planet launch engine module dock crater photon plasma binary cluster zenith apogee`) },
  food: { name: 'Food', words: t(`
    pie jam tea egg ham rye oat fig yam nut
    rice soup cake bean corn kale lime plum pear stew tart taco naan beef
    bread pasta salad honey lemon mango olive onion pizza toast curry sushi berry peach melon cocoa
    biscuit noodle cheese butter pepper garlic ginger pretzel pancake omelette dumpling brownie
    cinnamon avocado broccoli spinach tomato cabbage walnut almond cashew pumpkin`) },
  fantasy: { name: 'Fantasy', words: t(`
    elf orc imp
    mage lich rune ogre drake fairy sword staff quest spell realm wyrm
    wizard goblin dragon knight castle potion throne dwarf troll cursed hero hydra sprite beast
    sorcerer griffin phoenix unicorn dungeon enchant warlock paladin gargoyle labyrinth
    amulet gauntlet banshee kraken minstrel necromancer talisman citadel crown relic oracle`) },
  code: { name: 'Code', words: t(`
    int var let for if
    loop bool byte char enum null void true false list node tree heap hash sort pipe fork bits
    array class debug stack queue event async await yield break const float token parse build merge
    string number object method buffer socket thread cache index lambda regex commit branch
    compile function variable iterator database callback inherit refactor protocol binary
    syntax kernel module import export return switch select insert update delete`) },
};
