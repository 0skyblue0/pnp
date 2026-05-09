const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /\b(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})\b/g;
const rrnPattern = /\b\d{6}[-\s]?[1-4]\d{6}\b/g;

export type MaskPiiResult = {
  maskedText: string;
  counts: {
    email: number;
    phone: number;
    residentRegistrationNumber: number;
  };
};

function replaceAndCount(input: string, pattern: RegExp, replacement: string) {
  let count = 0;
  const output = input.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  return { output, count };
}

export function maskPii(input: string): MaskPiiResult {
  const email = replaceAndCount(input, emailPattern, "[EMAIL]");
  const phone = replaceAndCount(email.output, phonePattern, "[PHONE]");
  const rrn = replaceAndCount(phone.output, rrnPattern, "[RRN]");

  return {
    maskedText: rrn.output,
    counts: {
      email: email.count,
      phone: phone.count,
      residentRegistrationNumber: rrn.count
    }
  };
}
