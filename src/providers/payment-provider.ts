/**
 * Payment Provider Interface
 * 
 * Abstract interface for payment operations. Implement this to use your own
 * payment processor (Stripe Issuing, Marqeta, etc.).
 * 
 * A mock implementation is provided for testing.
 */

import type { VirtualCard, VirtualCardRequest } from "../types";

export interface PaymentProvider {
  /**
   * Create a virtual card for a purchase
   */
  createVirtualCard(request: VirtualCardRequest): Promise<VirtualCard>;
  
  /**
   * Cancel/deactivate a virtual card
   */
  cancelVirtualCard(cardId: string): Promise<void>;
  
  /**
   * Get card details (for checking status)
   */
  getVirtualCard(cardId: string): Promise<VirtualCard | null>;
  
  /**
   * Check if the payment provider is properly configured
   */
  isConfigured(): Promise<boolean>;
}

/**
 * Mock payment provider for testing/development
 * Generates fake card numbers that won't work with real merchants
 */
export class MockPaymentProvider implements PaymentProvider {
  private cards: Map<string, VirtualCard> = new Map();
  
  async createVirtualCard(request: VirtualCardRequest): Promise<VirtualCard> {
    const cardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    
    const card: VirtualCard = {
      id: cardId,
      cardNumber: this.generateTestCardNumber(),
      expMonth: 12,
      expYear: now.getFullYear() + 1,
      cvc: String(Math.floor(Math.random() * 900) + 100),
      billingZip: "10001",
      hardLimit: request.amount,
      currency: request.currency,
      expiresAt,
    };
    
    this.cards.set(cardId, card);
    return card;
  }
  
  async cancelVirtualCard(cardId: string): Promise<void> {
    this.cards.delete(cardId);
  }
  
  async getVirtualCard(cardId: string): Promise<VirtualCard | null> {
    return this.cards.get(cardId) || null;
  }
  
  async isConfigured(): Promise<boolean> {
    return true; // Mock is always configured
  }
  
  private generateTestCardNumber(): string {
    // Generate a test card number (not valid for real transactions)
    // Uses Stripe's test card format
    return "4242424242424242";
  }
}

/**
 * Configuration for Stripe Issuing payment provider
 */
export interface StripeIssuingConfig {
  secretKey: string;
  cardholderId: string; // Your master cardholder ID
}

/**
 * Stripe Issuing payment provider
 * 
 * NOTE: This is a reference implementation. For production use with Stripe Issuing,
 * you'll need to:
 * 1. Have an approved Stripe Issuing account
 * 2. Create a cardholder
 * 3. Set up webhook handling for authorizations
 */
export class StripeIssuingProvider implements PaymentProvider {
  private config: StripeIssuingConfig;
  
  constructor(config: StripeIssuingConfig) {
    this.config = config;
  }
  
  async createVirtualCard(_request: VirtualCardRequest): Promise<VirtualCard> {
    // Reference implementation - uncomment with real Stripe SDK
    /*
    const card = await this.stripe.issuing.cards.create({
      cardholder: this.config.cardholderId,
      type: "virtual",
      currency: request.currency,
      status: "active",
      spending_controls: {
        spending_limits: [{
          amount: Math.round(request.amount * 100), // cents
          interval: "all_time",
        }],
        ...(request.allowedCategories && {
          allowed_categories: request.allowedCategories,
        }),
        ...(request.blockedCategories && {
          blocked_categories: request.blockedCategories,
        }),
      },
      metadata: {
        purchaseIntentId: request.purchaseIntentId,
        organizationId: request.organizationId,
        agentId: request.agentId,
      },
    });
    
    // Get full card details
    const details = await this.stripe.issuing.cards.retrieve(card.id, {
      expand: ['number', 'cvc'],
    });
    
    return {
      id: card.id,
      cardNumber: details.number,
      expMonth: details.exp_month,
      expYear: details.exp_year,
      cvc: details.cvc,
      hardLimit: request.amount,
      currency: request.currency,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
    */
    
    throw new Error(
      "Stripe Issuing provider not fully implemented. " +
      "Use MockPaymentProvider for testing or implement with your Stripe SDK."
    );
  }
  
  async cancelVirtualCard(_cardId: string): Promise<void> {
    // await this.stripe.issuing.cards.update(_cardId, { status: 'canceled' });
    throw new Error("Not implemented - implement with your Stripe SDK");
  }
  
  async getVirtualCard(_cardId: string): Promise<VirtualCard | null> {
    // const card = await this.stripe.issuing.cards.retrieve(_cardId);
    throw new Error("Not implemented - implement with your Stripe SDK");
  }
  
  async isConfigured(): Promise<boolean> {
    return !!(this.config.secretKey && this.config.cardholderId);
  }
}

