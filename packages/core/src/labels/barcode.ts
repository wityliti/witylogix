// Code 128 Barcode Encoder (Character Set B)
// Encodes ASCII characters 32-127

const CODE128B_CHARS = [
  " ", "!", '"', "#", "$", "%", "&", "'", "(", ")",
  "*", "+", ",", "-", ".", "/", "0", "1", "2", "3",
  "4", "5", "6", "7", "8", "9", ":", ";", "<", "=",
  ">", "?", "@", "A", "B", "C", "D", "E", "F", "G",
  "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
  "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[",
  "\\", "]", "^", "_", "`", "a", "b", "c", "d", "e",
  "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
  "p", "q", "r", "s", "t", "u", "v", "w", "x", "y",
  "z", "{", "|", "}", "~", String.fromCharCode(127),
];

// Code 128 bar patterns (6 bars each)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "100223",
  "100322", "100221", "223122", "223221", "213212", "213221", "223211",
  "221132", "221231", "213122", "213121", "223113", "130123", "130321",
  "023210", "011323", "011221", "031213", "031122", "011332", "031321",
  "031213", "020132", "021322", "021131", "011213", "011112", "011211",
  "011112", "100211", "101202", "101221", "110212", "110211", "110112",
  "101112", "100132", "100231", "102213", "102312", "200211", "200111",
  "200110", "201203", "201302", "200321", "200320", "201210", "201211",
  "200121", "202010", "201010", "201001", "202100", "202101", "101223",
  "101322", "100312", "200212", "200111", "201112", "200121", "212202",
  "300011", "011202", "011201", "011020", "011021", "010012", "010021",
  "001012", "010120", "012100", "210020", "210021", "012010", "201200",
  "112010", "110201", "110102", "102201", "102210", "111220", "111100",
  "100101", "100110", "111101", "111110", "111200", "100012", "100210",
];

// Start/stop codes
const START_B = "211214"; // Code B start
const STOP = "2331112"; // Stop code

export function encodeCode128B(data: string): number[] {
  // Initialize with start code B
  const result: number[] = stringToBarPattern(START_B);

  let checksum = 104; // Start code B value
  let position = 1;

  // Encode each character
  for (const char of data) {
    const charIndex = CODE128B_CHARS.indexOf(char);
    if (charIndex === -1) {
      throw new Error(`Character '${char}' is not available in Code 128 Set B`);
    }

    result.push(...stringToBarPattern(CODE128_PATTERNS[charIndex]));
    checksum += charIndex * position;
    position++;
  }

  // Calculate and add checksum
  const checksumCode = checksum % 103;
  result.push(...stringToBarPattern(CODE128_PATTERNS[checksumCode]));

  // Add stop pattern
  result.push(...stringToBarPattern(STOP));

  return result;
}

function stringToBarPattern(pattern: string): number[] {
  const result: number[] = [];
  for (const digit of pattern) {
    result.push(parseInt(digit, 10));
  }
  return result;
}

export function renderBarcodeToSVG(
  data: string,
  width: number,
  height: number
): string {
  const bars = encodeCode128B(data);

  // Calculate bar width
  const totalBars = bars.reduce((a, b) => a + b, 0);
  const barWidth = width / totalBars;

  let svgPath = "";
  let x = 0;

  // Create bars
  for (let i = 0; i < bars.length; i++) {
    const barHeight = i % 2 === 0 ? height : height * 0.15; // Every other bar is narrower (space)
    const barW = bars[i] * barWidth;

    if (i % 2 === 0) {
      // Draw black bar
      svgPath += `M${x},0 L${x},${barHeight} L${x + barW},${barHeight} L${x + barW},0 Z `;
    }
    x += barW;
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white"/>
      <path d="${svgPath}" fill="black"/>
    </svg>
  `.trim();
}

export function generateBarcodeBase64PNG(
  data: string,
  width: number = 200,
  height: number = 100
): string {
  // For simplicity, return SVG base64 (browsers can render SVG as PNG-like)
  const svg = renderBarcodeToSVG(data, width, height);
  return Buffer.from(svg).toString("base64");
}
