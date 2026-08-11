/**
 * Sound Generation Script
 * Run this with Node.js to generate WAV sound effects for the app.
 * Usage: node generateSounds.js
 *
 * This creates simple synthesized sounds matching the web version's
 * Web Audio API oscillator-based sounds.
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function generateWav(samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const bitsPerSample = 16;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 30);
  buffer.writeUInt16LE(bitsPerSample, 32);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  return buffer;
}

function sine(freq, duration, volume = 0.3) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 8);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * volume * env;
  }
  return samples;
}

function sawtooth(freq, duration, volume = 0.3) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 4);
    const phase = (freq * t) % 1;
    samples[i] = (2 * phase - 1) * volume * env;
  }
  return samples;
}

function square(freq, duration, volume = 0.25) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 5);
    samples[i] = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * volume * env;
  }
  return samples;
}

function mix(arrays) {
  const maxLen = Math.max(...arrays.map(a => a.length));
  const result = new Float32Array(maxLen);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      result[i] += arr[i];
    }
  }
  return result;
}

function concat(arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Float32Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function silence(duration) {
  return new Float32Array(Math.floor(SAMPLE_RATE * duration));
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Tick - short blip
const tick = sine(900, 0.07, 0.18);
fs.writeFileSync(path.join(outDir, 'tick.wav'), generateWav(tick));

// Correct - ascending chord
const correct = mix([
  concat([sine(523, 0.35, 0.22)]),
  concat([silence(0.07), sine(659, 0.35, 0.22)]),
  concat([silence(0.14), sine(784, 0.35, 0.22)]),
  concat([silence(0.21), sine(1047, 0.35, 0.22)]),
]);
fs.writeFileSync(path.join(outDir, 'correct.wav'), generateWav(correct));

// Wrong - descending sawtooth
const wrong = mix([
  concat([sawtooth(392, 0.2, 0.18)]),
  concat([silence(0.09), sawtooth(330, 0.2, 0.18)]),
  concat([silence(0.18), sawtooth(277, 0.2, 0.18)]),
  concat([silence(0.27), sawtooth(220, 0.2, 0.18)]),
]);
fs.writeFileSync(path.join(outDir, 'wrong.wav'), generateWav(wrong));

// Buzzer
const buzzer = sawtooth(130, 0.5, 0.35);
fs.writeFileSync(path.join(outDir, 'buzzer.wav'), generateWav(buzzer));

// Reveal fanfare
const reveal = mix([
  concat([sine(523, 0.28, 0.18)]),
  concat([silence(0.1), sine(659, 0.28, 0.18)]),
  concat([silence(0.2), sine(784, 0.28, 0.18)]),
  concat([silence(0.3), sine(1047, 0.28, 0.18)]),
]);
fs.writeFileSync(path.join(outDir, 'reveal.wav'), generateWav(reveal));

// Attack hit - threatening descending
const attackHit = mix([
  concat([square(220, 0.2, 0.25)]),
  concat([silence(0.1), square(196, 0.2, 0.25)]),
  concat([silence(0.2), square(165, 0.2, 0.25)]),
]);
fs.writeFileSync(path.join(outDir, 'attack_hit.wav'), generateWav(attackHit));

// Last question - dramatic ascending with bass
const lastQ = mix([
  ...([261, 329, 392, 523, 659, 784, 1047].map((f, i) =>
    concat([silence(i * 0.1), sine(f, 0.4, 0.25)])
  )),
  sine(55, 0.8, 0.4),
]);
fs.writeFileSync(path.join(outDir, 'last_question.wav'), generateWav(lastQ));

// Bonus chime
const bonusChime = mix([
  concat([sine(783, 0.3, 0.2)]),
  concat([silence(0.12), sine(1047, 0.3, 0.2)]),
  concat([silence(0.24), sine(1318, 0.3, 0.2)]),
]);
fs.writeFileSync(path.join(outDir, 'bonus_chime.wav'), generateWav(bonusChime));

console.log('Sound files generated in', outDir);
