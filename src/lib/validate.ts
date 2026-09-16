const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === Number(cpf[10]);
}

export function assertInputLimits(input: Record<string, unknown>, limits: Record<string, number>) {
  for (const [field, max] of Object.entries(limits)) {
    const val = input[field];
    if (typeof val === "string" && val.length > max) {
      throw new Error(`Campo "${field}" excede o limite de ${max} caracteres.`);
    }
  }
}
