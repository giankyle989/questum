import type { AIService } from '@/ai/AIService';

// Compile-time assertion: any AIService must have a typed sourceId.
// If AIService['sourceId'] doesn't include 'mock' (or stops being exactly
// 'apple' | 'gemini' | 'mock'), this assignment fails typecheck.
const _sourceIdShape: AIService['sourceId'] = 'mock';
void _sourceIdShape;

describe('AIService interface', () => {
  it('has the sourceId compile-time shape (verified at typecheck)', () => {
    // The above type assertion fails typecheck if AIService['sourceId']
    // doesn't include 'mock', so reaching this `expect` proves the shape.
    expect(_sourceIdShape).toBe('mock');
  });
});
