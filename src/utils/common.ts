import crypto from 'crypto';

export function getKolkataTimeFormatted(dateTimeFormat: string = 'YYYY-MM-DD HH:mm:ss'): string {
  // Return formatted time in Asia/Kolkata timezone
  const date = new Date();
  const kolkataTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const parts = kolkataTime.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  // e.g. YYYY-MM-DD HH:mm:ss representation
  // Format is customized based on input. We support a few patterns
  const formatted = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  return formatted;
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateRandomString(length: number): string {
  const letterSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numberSet = '0123456789';
  const specialSet = '@#$%^&*!';
  const allSet = letterSet + numberSet + specialSet;

  const passwordChars = new Array(length);
  
  // Ensure at least one special character
  const specialIdx = Math.floor(Math.random() * length);
  const specialCharIdx = Math.floor(Math.random() * specialSet.length);
  passwordChars[specialIdx] = specialSet[specialCharIdx];

  // Fill remaining characters randomly
  for (let i = 0; i < length; i++) {
    if (passwordChars[i] === undefined) {
      const charIdx = Math.floor(Math.random() * allSet.length);
      passwordChars[i] = allSet[charIdx];
    }
  }

  return passwordChars.join('');
}

export function generateRandom12DigitString(): string {
  // Generates XXXX-XXXX-XXXX
  const generateBlock = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };
  return `${generateBlock()}-${generateBlock()}-${generateBlock()}`;
}

export function sanitizeString(name: string): string {
  name = name.trim();
  // Replace anything not a-z, A-Z, 0-9 with -
  name = name.replace(/[^a-zA-Z0-9]+/g, '-');
  // Remove leading/trailing -
  name = name.replace(/^-+|-+$/g, '');
  return name;
}
