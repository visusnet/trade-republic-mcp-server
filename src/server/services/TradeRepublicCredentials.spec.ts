import { TradeRepublicCredentials } from './TradeRepublicCredentials';

describe('TradeRepublicCredentials', () => {
  it('should reject empty phone number', () => {
    expect(() => new TradeRepublicCredentials('', '1234')).toThrow(
      'Phone number is required',
    );
  });

  it('should reject empty PIN', () => {
    expect(() => new TradeRepublicCredentials('+491701234567', '')).toThrow(
      'PIN is required',
    );
  });

  describe('getMaskedPhoneNumber', () => {
    it('should mask phone number correctly for standard format', () => {
      const credentials = new TradeRepublicCredentials('+491701234567', '1234');

      expect(credentials.getMaskedPhoneNumber()).toBe('+49170***67');
    });

    it('should mask phone number correctly for shorter number', () => {
      const credentials = new TradeRepublicCredentials('+49170123', '1234');

      expect(credentials.getMaskedPhoneNumber()).toBe('+49170***23');
    });

    it('should handle minimum length phone number', () => {
      const credentials = new TradeRepublicCredentials('+12345', '1234');

      expect(credentials.getMaskedPhoneNumber()).toBe('+12***45');
    });
  });
});
