import { ATTRIBUTES, ATTRIBUTE_COLORS, COLORS, type Attribute } from '../constants';

describe('game constants', () => {
  it('exports six attributes in canonical order', () => {
    expect(ATTRIBUTES).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
  });

  it('has a color for every attribute', () => {
    for (const attr of ATTRIBUTES) {
      expect(ATTRIBUTE_COLORS[attr]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has the surface and accent tokens from the visual design spec', () => {
    expect(COLORS.bg).toBe('#0E1116');
    expect(COLORS.surface).toBe('#161B22');
    expect(COLORS.accent).toBe('#E8C547');
  });

  it('Attribute type is the union of the six codes', () => {
    const sample: Attribute = 'STR';
    expect(ATTRIBUTES).toContain(sample);
  });
});
