import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const expectedMedia = {
  key: 'JOB_BOARD_SCREEN',
  url: {
    en: 'https://vz-88b9f9c3-e13.b-cdn.net/bb83d9ec-ec90-4c55-80d9-e7f0b30f0815/play_720p.mp4',
    es: 'https://vz-88b9f9c3-e13.b-cdn.net/264c0f84-07fd-4cb0-bacd-3938465f27ff/play_720p.mp4',
  },
  subtitle: {
    en: 'https://tradewize-biz.github.io/tradewize-cdn/subtitle/InstructionalVideos/JobBoard/en.vtt',
    es: 'https://tradewize-biz.github.io/tradewize-cdn/subtitle/InstructionalVideos/JobBoard/es.vtt',
  },
};

const manifest = JSON.parse(readFileSync('subtitle/media.json', 'utf8'));
if (
  JSON.stringify(manifest.JOB_BOARD_SCREEN) !== JSON.stringify(expectedMedia)
) {
  throw new Error('JOB_BOARD_SCREEN does not match the approved TD-1180 assets');
}

for (const url of Object.values(manifest.JOB_BOARD_SCREEN.url)) {
  if (!url.endsWith('/play_720p.mp4') || url.includes('.m3u8')) {
    throw new Error(`Job Board video must be progressive MP4: ${url}`);
  }
}

const baseManifest = JSON.parse(
  execFileSync('git', ['show', 'origin/main:subtitle/media.json'], {
    encoding: 'utf8',
  }),
);
for (const key of Object.keys(baseManifest)) {
  if (
    key !== 'JOB_BOARD_SCREEN' &&
    JSON.stringify(baseManifest[key]) !== JSON.stringify(manifest[key])
  ) {
    throw new Error(`Unexpected non-Job-Board manifest change: ${key}`);
  }
}

const timestampToSeconds = value => {
  const [hours, minutes, seconds] = value.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};

const validateVtt = ({file, cueCount, maxDuration}) => {
  const content = readFileSync(file, 'utf8');
  if (!content.startsWith('WEBVTT\n')) {
    throw new Error(`${file}: missing WEBVTT header`);
  }

  const cues = [...content.matchAll(
    /^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})$/gm,
  )].map(match => ({
    start: timestampToSeconds(match[1]),
    end: timestampToSeconds(match[2]),
  }));

  if (cues.length !== cueCount) {
    throw new Error(`${file}: expected ${cueCount} cues, received ${cues.length}`);
  }

  cues.forEach((cue, index) => {
    if (cue.end <= cue.start) {
      throw new Error(`${file}: cue ${index + 1} has an invalid duration`);
    }
    if (index > 0 && cue.start < cues[index - 1].end) {
      throw new Error(`${file}: cue ${index + 1} overlaps the previous cue`);
    }
  });

  if (cues.at(-1).end > maxDuration) {
    throw new Error(`${file}: final cue exceeds the video duration`);
  }

  console.log(
    `${file}: ${cues.length} cues, no overlap, end=${cues.at(-1).end.toFixed(3)}s`,
  );
};

validateVtt({
  file: 'subtitle/InstructionalVideos/JobBoard/en.vtt',
  cueCount: 12,
  maxDuration: 58.56,
});
validateVtt({
  file: 'subtitle/InstructionalVideos/JobBoard/es.vtt',
  cueCount: 13,
  maxDuration: 56.61,
});

console.log('TD-1180 Job Board manifest and subtitles are valid');
