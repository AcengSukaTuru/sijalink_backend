import type { NextFunction, Request, Response } from 'express';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET':
      return '\x1b[36m'; // Cyan
    case 'POST':
      return '\x1b[32m'; // Green
    case 'PUT':
    case 'PATCH':
      return '\x1b[33m'; // Yellow
    case 'DELETE':
      return '\x1b[31m'; // Red
    default:
      return '\x1b[37m'; // White
  }
}

function getStatusColor(status: number): string {
  if (status >= 500) return '\x1b[41m\x1b[37m'; // Red background
  if (status >= 400) return '\x1b[33m'; // Yellow
  if (status >= 300) return '\x1b[36m'; // Cyan
  if (status >= 200) return '\x1b[32m'; // Green
  return '\x1b[37m';
}

export function httpLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const mColor = getMethodColor(method);
    const sColor = getStatusColor(statusCode);

    const timestamp = new Date().toLocaleTimeString('id-ID', {
      hour12: false,
    });

    process.stdout.write(
      `${DIM}[${timestamp}]${RESET} ` +
        `[HTTP] ` +
        `${mColor}${BOLD}${method.padEnd(6)}${RESET} ` +
        `${originalUrl} ` +
        `${sColor}${BOLD}${statusCode}${RESET} ` +
        `${DIM}+${duration}ms${RESET}\n`,
    );
  });

  next();
}
