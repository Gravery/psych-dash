import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocks globais para APIs que não existem no JSDOM
(globalThis as any).Notification = {
  permission: 'granted',
  requestPermission: vi.fn().mockResolvedValue('granted'),
} as any;

(globalThis as any).Audio = vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  volume: 1,
}));

(globalThis as any).speechSynthesis = {
  speak: vi.fn(),
} as any;

(globalThis as any).SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
  text,
  lang: 'pt-BR',
})) as any;
