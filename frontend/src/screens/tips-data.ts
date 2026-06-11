export interface Tip {
  id: string
  title: string
  short: string
  icon: string
  iconCls: 'ti-1' | 'ti-2' | 'ti-3' | 'ti-4'
  mins: string
  category: 'breathing' | 'brave' | 'warmup' | 'show'
  steps: string[]
}

export const HERO_TIP: Tip = {
  id: 'balloon',
  title: 'Breathe like a balloon',
  short: 'Fill your tummy up sloooowly, then sing as it floats out.',
  icon: '🎈',
  iconCls: 'ti-1',
  mins: '1 min',
  category: 'breathing',
  steps: [
    'Put both hands on your tummy like it\'s a balloon. 🎈',
    'Breathe in slooowly through your nose — feel the balloon fill up.',
    'Now sing "ahhh" while the balloon slowly floats the air out.',
    'Do it three times. Big balloon = big beautiful notes!',
  ],
}

export const TIPS: Tip[] = [
  {
    id: 'siren',
    title: 'Siren like a firetruck',
    short: 'Slide your voice low to high — wheee-ooo!',
    icon: '🚒',
    iconCls: 'ti-1',
    mins: '1 min',
    category: 'warmup',
    steps: [
      'Take a balloon breath first. 🎈',
      'Start on your lowest comfy note and slide up like a siren: wheee!',
      'Slide back down: ooooo.',
      'Three sirens up, three sirens down. Your voice is now stretchy!',
    ],
  },
  {
    id: 'star-pose',
    title: 'Stand like a star',
    short: 'Feet apart, chin up, arms wide — feel mighty!',
    icon: '🌟',
    iconCls: 'ti-2',
    mins: '1 min',
    category: 'brave',
    steps: [
      'Stand with your feet apart, like a starfish.',
      'Stretch your arms out wide and look up a tiny bit.',
      'Take one big balloon breath and smile.',
      'Singers who stand tall SOUND brave — even when they feel wobbly.',
    ],
  },
  {
    id: 'bee',
    title: 'The bumblebee hum',
    short: 'Hummmm gently to wake your voice up.',
    icon: '🐝',
    iconCls: 'ti-3',
    mins: '2 min',
    category: 'warmup',
    steps: [
      'Close your lips softly and hum: mmmmm. 🐝',
      'Feel the buzz tickle your lips and nose.',
      'Hum your favourite song line, super gently.',
      'A buzzy hum means your voice is awake and happy!',
    ],
  },
  {
    id: 'sparkle-dust',
    title: 'Mistakes are sparkle dust',
    short: "Wobbly notes mean you're learning — keep going!",
    icon: '✨',
    iconCls: 'ti-4',
    mins: 'read',
    category: 'brave',
    steps: [
      'Every singer in the whole world sings wobbly notes. Every single one!',
      'A wobbly note is proof you tried something new.',
      'When a note wobbles, smile, breathe, and sing the next one.',
      'Twinkle says: brave singing beats perfect singing, every time. 💙',
    ],
  },
  {
    id: 'whisper-loud',
    title: 'Tiny mouse, big lion',
    short: 'Sing a line tiny, then BIG — feel the difference.',
    icon: '🦁',
    iconCls: 'ti-2',
    mins: '2 min',
    category: 'show',
    steps: [
      'Pick one line of your song.',
      'Sing it like a tiny mouse: squeaky and small. 🐭',
      'Now sing it like a friendly lion: big and warm! 🦁',
      'Real performers can do both — now you can too.',
    ],
  },
  {
    id: 'audience',
    title: 'Sing to your teddy first',
    short: 'Practice for a friendly audience of toys.',
    icon: '🧸',
    iconCls: 'ti-3',
    mins: '3 min',
    category: 'show',
    steps: [
      'Line up some toys — they are your audience. 🧸',
      'Walk in, stand like a star, and say your name.',
      'Sing one whole song. Toys never boo — they love everything!',
      'Next time, invite one human. Tiny steps make brave performers.',
    ],
  },
]

/** Tip of the day rotates through the list by date. */
export function tipOfTheDay(d: Date = new Date()): Tip {
  const all = [HERO_TIP, ...TIPS]
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  return all[dayOfYear % all.length]
}
