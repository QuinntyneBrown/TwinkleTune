import type { Song } from './types'

// All songs are public-domain melodies, hand-encoded at a C-major base key.
// MIDI 60 = C4 (middle C). Times are in beats; the player transposes per voice.

const n = (midi: number, start: number, dur: number, syll: string) => ({ midi, start, dur, syll })

export const songs: Song[] = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    emoji: '⭐',
    art: 1,
    bpm: 100,
    difficulty: 1,
    phrases: [
      {
        lyric: 'Twinkle, twinkle, little star',
        notes: [
          n(60, 0, 1, 'Twin'), n(60, 1, 1, 'kle'), n(67, 2, 1, 'twin'), n(67, 3, 1, 'kle'),
          n(69, 4, 1, 'lit'), n(69, 5, 1, 'tle'), n(67, 6, 2, 'star'),
        ],
      },
      {
        lyric: 'How I wonder what you are',
        notes: [
          n(65, 8, 1, 'How'), n(65, 9, 1, 'I'), n(64, 10, 1, 'won'), n(64, 11, 1, 'der'),
          n(62, 12, 1, 'what'), n(62, 13, 1, 'you'), n(60, 14, 2, 'are'),
        ],
      },
      {
        lyric: 'Up above the world so high',
        notes: [
          n(67, 16, 1, 'Up'), n(67, 17, 1, 'a'), n(65, 18, 1, 'bove'), n(65, 19, 1, 'the'),
          n(64, 20, 1, 'world'), n(64, 21, 1, 'so'), n(62, 22, 2, 'high'),
        ],
      },
      {
        lyric: 'Like a diamond in the sky',
        notes: [
          n(67, 24, 1, 'Like'), n(67, 25, 1, 'a'), n(65, 26, 1, 'dia'), n(65, 27, 1, 'mond'),
          n(64, 28, 1, 'in'), n(64, 29, 1, 'the'), n(62, 30, 2, 'sky'),
        ],
      },
      {
        lyric: 'Twinkle, twinkle, little star',
        notes: [
          n(60, 32, 1, 'Twin'), n(60, 33, 1, 'kle'), n(67, 34, 1, 'twin'), n(67, 35, 1, 'kle'),
          n(69, 36, 1, 'lit'), n(69, 37, 1, 'tle'), n(67, 38, 2, 'star'),
        ],
      },
      {
        lyric: 'How I wonder what you are',
        notes: [
          n(65, 40, 1, 'How'), n(65, 41, 1, 'I'), n(64, 42, 1, 'won'), n(64, 43, 1, 'der'),
          n(62, 44, 1, 'what'), n(62, 45, 1, 'you'), n(60, 46, 2, 'are'),
        ],
      },
    ],
  },

  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    emoji: '🐑',
    art: 2,
    bpm: 104,
    difficulty: 1,
    phrases: [
      {
        lyric: 'Mary had a little lamb',
        notes: [
          n(64, 0, 1, 'Ma'), n(62, 1, 1, 'ry'), n(60, 2, 1, 'had'), n(62, 3, 1, 'a'),
          n(64, 4, 1, 'lit'), n(64, 5, 1, 'tle'), n(64, 6, 2, 'lamb'),
        ],
      },
      {
        lyric: 'Little lamb, little lamb',
        notes: [
          n(62, 8, 1, 'lit'), n(62, 9, 1, 'tle'), n(62, 10, 2, 'lamb'),
          n(64, 12, 1, 'lit'), n(67, 13, 1, 'tle'), n(67, 14, 2, 'lamb'),
        ],
      },
      {
        lyric: 'Mary had a little lamb, its',
        notes: [
          n(64, 16, 1, 'Ma'), n(62, 17, 1, 'ry'), n(60, 18, 1, 'had'), n(62, 19, 1, 'a'),
          n(64, 20, 1, 'lit'), n(64, 21, 1, 'tle'), n(64, 22, 1, 'lamb'), n(64, 23, 1, 'its'),
        ],
      },
      {
        lyric: 'Fleece was white as snow',
        notes: [
          n(62, 24, 1, 'fleece'), n(62, 25, 1, 'was'), n(64, 26, 1, 'white'), n(62, 27, 1, 'as'),
          n(60, 28, 4, 'snow'),
        ],
      },
    ],
  },

  {
    id: 'hotcrossbuns',
    title: 'Hot Cross Buns',
    emoji: '🥐',
    art: 4,
    bpm: 96,
    difficulty: 1,
    phrases: [
      {
        lyric: 'Hot cross buns!',
        notes: [n(64, 0, 1, 'Hot'), n(62, 1, 1, 'cross'), n(60, 2, 2, 'buns')],
      },
      {
        lyric: 'Hot cross buns!',
        notes: [n(64, 4, 1, 'Hot'), n(62, 5, 1, 'cross'), n(60, 6, 2, 'buns')],
      },
      {
        lyric: 'One a penny, two a penny',
        notes: [
          n(60, 8, 0.5, 'One'), n(60, 8.5, 0.5, 'a'), n(60, 9, 0.5, 'pen'), n(60, 9.5, 0.5, 'ny'),
          n(62, 10, 0.5, 'two'), n(62, 10.5, 0.5, 'a'), n(62, 11, 0.5, 'pen'), n(62, 11.5, 0.5, 'ny'),
        ],
      },
      {
        lyric: 'Hot cross buns!',
        notes: [n(64, 12, 1, 'Hot'), n(62, 13, 1, 'cross'), n(60, 14, 2, 'buns')],
      },
    ],
  },

  {
    id: 'londonbridge',
    title: 'London Bridge',
    emoji: '🌉',
    art: 1,
    bpm: 104,
    difficulty: 2,
    phrases: [
      {
        lyric: 'London Bridge is falling down',
        notes: [
          n(67, 0, 1.5, 'Lon'), n(69, 1.5, 0.5, 'don'), n(67, 2, 1, 'Bridge'), n(65, 3, 1, 'is'),
          n(64, 4, 1, 'fall'), n(65, 5, 1, 'ing'), n(67, 6, 2, 'down'),
        ],
      },
      {
        lyric: 'Falling down',
        notes: [n(62, 8, 1, 'fall'), n(64, 9, 1, 'ing'), n(65, 10, 2, 'down')],
      },
      {
        lyric: 'Falling down',
        notes: [n(64, 12, 1, 'fall'), n(65, 13, 1, 'ing'), n(67, 14, 2, 'down')],
      },
      {
        lyric: 'London Bridge is falling down',
        notes: [
          n(67, 16, 1.5, 'Lon'), n(69, 17.5, 0.5, 'don'), n(67, 18, 1, 'Bridge'), n(65, 19, 1, 'is'),
          n(64, 20, 1, 'fall'), n(65, 21, 1, 'ing'), n(67, 22, 2, 'down'),
        ],
      },
      {
        lyric: 'My fair lady!',
        notes: [n(62, 24, 1, 'My'), n(67, 25, 1, 'fair'), n(64, 26, 1, 'la'), n(60, 27, 2, 'dy')],
      },
    ],
  },

  {
    id: 'oldmacdonald',
    title: 'Old MacDonald',
    emoji: '🚜',
    art: 2,
    bpm: 108,
    difficulty: 2,
    phrases: [
      {
        lyric: 'Old MacDonald had a farm',
        notes: [
          n(60, 0, 1, 'Old'), n(60, 1, 1, 'Mac'), n(60, 2, 1, 'Don'), n(55, 3, 1, 'ald'),
          n(57, 4, 1, 'had'), n(57, 5, 1, 'a'), n(55, 6, 2, 'farm'),
        ],
      },
      {
        lyric: 'E-I-E-I-O!',
        notes: [
          n(64, 8, 1, 'E'), n(64, 9, 1, 'I'), n(62, 10, 1, 'E'), n(62, 11, 1, 'I'), n(60, 12, 2, 'O'),
        ],
      },
      {
        lyric: 'And on that farm he had a duck',
        notes: [
          n(55, 14, 0.5, 'And'), n(60, 14.5, 0.5, 'on'), n(60, 15, 0.5, 'that'), n(60, 15.5, 0.5, 'farm'),
          n(55, 16, 0.5, 'he'), n(57, 16.5, 0.5, 'had'), n(57, 17, 0.5, 'a'), n(55, 17.5, 1.5, 'duck'),
        ],
      },
      {
        lyric: 'E-I-E-I-O!',
        notes: [
          n(64, 19, 1, 'E'), n(64, 20, 1, 'I'), n(62, 21, 1, 'E'), n(62, 22, 1, 'I'), n(60, 23, 2, 'O'),
        ],
      },
    ],
  },

  {
    id: 'rowyourboat',
    title: 'Row, Row, Row Your Boat',
    emoji: '🛶',
    art: 3,
    bpm: 84,
    difficulty: 3,
    phrases: [
      {
        lyric: 'Row, row, row your boat',
        notes: [
          n(60, 0, 1, 'Row'), n(60, 1, 1, 'row'), n(60, 2, 0.75, 'row'), n(62, 2.75, 0.25, 'your'),
          n(64, 3, 1, 'boat'),
        ],
      },
      {
        lyric: 'Gently down the stream',
        notes: [
          n(64, 4, 0.75, 'Gent'), n(62, 4.75, 0.25, 'ly'), n(64, 5, 0.75, 'down'), n(65, 5.75, 0.25, 'the'),
          n(67, 6, 2, 'stream'),
        ],
      },
      {
        lyric: 'Merrily, merrily, merrily, merrily',
        notes: [
          n(72, 8, 0.34, 'Mer'), n(72, 8.34, 0.33, 'ri'), n(72, 8.67, 0.33, 'ly'),
          n(67, 9, 0.34, 'mer'), n(67, 9.34, 0.33, 'ri'), n(67, 9.67, 0.33, 'ly'),
          n(64, 10, 0.34, 'mer'), n(64, 10.34, 0.33, 'ri'), n(64, 10.67, 0.33, 'ly'),
          n(60, 11, 0.34, 'mer'), n(60, 11.34, 0.33, 'ri'), n(60, 11.67, 0.33, 'ly'),
        ],
      },
      {
        lyric: 'Life is but a dream',
        notes: [
          n(67, 12, 0.75, 'Life'), n(65, 12.75, 0.25, 'is'), n(64, 13, 0.75, 'but'), n(62, 13.75, 0.25, 'a'),
          n(60, 14, 2, 'dream'),
        ],
      },
    ],
  },

  {
    id: 'jesuslovesme',
    title: 'Jesus Loves Me',
    emoji: '✝️',
    art: 3,
    bpm: 100,
    difficulty: 2,
    phrases: [
      {
        lyric: 'Jesus loves me, this I know',
        notes: [
          n(67, 0, 1, 'Je'), n(64, 1, 1, 'sus'), n(64, 2, 1, 'loves'), n(62, 3, 1, 'me'),
          n(64, 4, 1, 'this'), n(67, 5, 1, 'I'), n(67, 6, 2, 'know'),
        ],
      },
      {
        lyric: 'For the Bible tells me so',
        notes: [
          n(69, 8, 1, 'For'), n(69, 9, 1, 'the'), n(72, 10, 1, 'Bi'), n(69, 11, 1, 'ble'),
          n(69, 12, 1, 'tells'), n(67, 13, 1, 'me'), n(67, 14, 2, 'so'),
        ],
      },
      {
        lyric: 'Little ones to Him belong',
        notes: [
          n(67, 16, 1, 'Lit'), n(64, 17, 1, 'tle'), n(64, 18, 1, 'ones'), n(62, 19, 1, 'to'),
          n(64, 20, 1, 'Him'), n(67, 21, 1, 'be'), n(67, 22, 2, 'long'),
        ],
      },
      {
        lyric: 'They are weak, but He is strong',
        notes: [
          n(69, 24, 1, 'They'), n(69, 25, 1, 'are'), n(67, 26, 1, 'weak'), n(65, 27, 1, 'but'),
          n(64, 28, 1, 'He'), n(62, 29, 1, 'is'), n(60, 30, 2, 'strong'),
        ],
      },
      {
        lyric: 'Yes, Jesus loves me',
        notes: [
          n(72, 32, 2, 'Yes'), n(69, 34, 1, 'Je'), n(69, 35, 1, 'sus'), n(67, 36, 2, 'loves'), n(67, 38, 2, 'me'),
        ],
      },
      {
        lyric: 'Yes, Jesus loves me',
        notes: [
          n(72, 40, 2, 'Yes'), n(69, 42, 1, 'Je'), n(69, 43, 1, 'sus'), n(67, 44, 2, 'loves'), n(67, 46, 2, 'me'),
        ],
      },
      {
        lyric: 'Yes, Jesus loves me',
        notes: [
          n(72, 48, 2, 'Yes'), n(69, 50, 1, 'Je'), n(69, 51, 1, 'sus'), n(67, 52, 2, 'loves'), n(67, 54, 2, 'me'),
        ],
      },
      {
        lyric: 'The Bible tells me so',
        notes: [
          n(69, 56, 1, 'The'), n(67, 57, 1, 'Bi'), n(65, 58, 1, 'ble'), n(64, 59, 1, 'tells'),
          n(62, 60, 1, 'me'), n(60, 61, 3, 'so'),
        ],
      },
    ],
  },
]

export const getSong = (id: string): Song | undefined => songs.find((s) => s.id === id)
