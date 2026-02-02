/**
 * Trade Republic API credentials holder.
 *
 * Stores phone number and PIN for authentication.
 * Provides masked phone number for display in error messages.
 */
export class TradeRepublicCredentials {
  public readonly phoneNumber: string;
  public readonly pin: string;

  constructor(phoneNumber: string, pin: string) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }
    if (!pin) {
      throw new Error('PIN is required');
    }
    this.phoneNumber = phoneNumber;
    this.pin = pin;
  }

  /**
   * Returns a masked version of the phone number for display.
   * Format: country code + first 3 digits + *** + last 2 digits
   * Example: +491701234567 → +49170***67
   */
  public getMaskedPhoneNumber(): string {
    const phone = this.phoneNumber;
    // Find where the country code ends (after the + and country digits)
    // We want to show: + country code + first 3 local digits + *** + last 2 digits
    // For simplicity, we take first 6 chars (covers +49170 or similar) + *** + last 2
    const prefixLength = 6;
    const suffixLength = 2;

    if (phone.length <= prefixLength + suffixLength) {
      // Very short number - just show first 3 + *** + last 2
      const prefix = phone.slice(0, 3);
      const suffix = phone.slice(-2);
      return `${prefix}***${suffix}`;
    }

    const prefix = phone.slice(0, prefixLength);
    const suffix = phone.slice(-suffixLength);
    return `${prefix}***${suffix}`;
  }
}
