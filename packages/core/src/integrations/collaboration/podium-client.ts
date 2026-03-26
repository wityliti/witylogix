interface PodiumContact {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

interface PodiumConversation {
  id: string;
  contact_id: string;
  status: string;
  subject?: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

interface PodiumMessage {
  id: string;
  conversation_id: string;
  contact_id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  kind: 'text' | 'image' | 'video';
  created_at: string;
}

interface PodiumReview {
  id: string;
  contact_id: string;
  rating: number;
  title?: string;
  body: string;
  source: string;
  created_at: string;
  updated_at: string;
}

interface PodiumPaymentRequest {
  id: string;
  contact_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export class PodiumClient {
  private oauth_token: string;
  private business_id: string;
  private base_url: string;
  private token_expires_at: number = 0;
  private oauth_client_id?: string;
  private oauth_client_secret?: string;

  constructor(
    oauth_token: string,
    business_id: string,
    oauth_client_id?: string,
    oauth_client_secret?: string,
    sandbox_mode: boolean = false
  ) {
    this.oauth_token = oauth_token;
    this.business_id = business_id;
    this.oauth_client_id = oauth_client_id;
    this.oauth_client_secret = oauth_client_secret;
    this.base_url = sandbox_mode
      ? 'https://sandbox.podiumapi.com/v4'
      : 'https://api.podium.com/v4';
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.oauth_client_id || !this.oauth_client_secret) {
      return;
    }

    if (Date.now() < this.token_expires_at) {
      return;
    }

    try {
      const auth = Buffer.from(`${this.oauth_client_id}:${this.oauth_client_secret}`).toString('base64');

      const response = await fetch(`${this.base_url}/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      this.oauth_token = data.access_token;
      this.token_expires_at = Date.now() + (data.expires_in - 300) * 1000;
    } catch (error) {
      throw new Error(`Failed to refresh Podium token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.oauth_token}`,
      'Content-Type': 'application/json',
      'X-Business-ID': this.business_id,
    };
  }

  async createContact(contact: Partial<PodiumContact>): Promise<PodiumContact> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/contacts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(contact),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumContact;
    } catch (error) {
      throw new Error(`Failed to create Podium contact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getContact(contact_id: string): Promise<PodiumContact | null> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/contacts/${contact_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumContact;
    } catch (error) {
      throw new Error(`Failed to get Podium contact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateContact(contact_id: string, updates: Partial<PodiumContact>): Promise<PodiumContact> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/contacts/${contact_id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumContact;
    } catch (error) {
      throw new Error(`Failed to update Podium contact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listConversations(filters?: { limit?: number; offset?: number }): Promise<PodiumConversation[]> {
    await this.refreshTokenIfNeeded();

    try {
      const query_params = new URLSearchParams();
      if (filters?.limit) query_params.append('limit', String(filters.limit));
      if (filters?.offset) query_params.append('offset', String(filters.offset));

      const response = await fetch(
        `${this.base_url}/conversations?${query_params.toString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { conversations: PodiumConversation[] };
      return data.conversations;
    } catch (error) {
      throw new Error(`Failed to list Podium conversations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getConversation(conversation_id: string): Promise<PodiumConversation | null> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/conversations/${conversation_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumConversation;
    } catch (error) {
      throw new Error(`Failed to get Podium conversation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendMessage(
    conversation_id: string,
    message: { body: string; kind?: 'text' | 'image' | 'video' }
  ): Promise<PodiumMessage> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/conversations/${conversation_id}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumMessage;
    } catch (error) {
      throw new Error(`Failed to send Podium message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listMessages(conversation_id: string): Promise<PodiumMessage[]> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/conversations/${conversation_id}/messages`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { messages: PodiumMessage[] };
      return data.messages;
    } catch (error) {
      throw new Error(`Failed to list Podium messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listReviews(filters?: { limit?: number; offset?: number }): Promise<PodiumReview[]> {
    await this.refreshTokenIfNeeded();

    try {
      const query_params = new URLSearchParams();
      if (filters?.limit) query_params.append('limit', String(filters.limit));
      if (filters?.offset) query_params.append('offset', String(filters.offset));

      const response = await fetch(
        `${this.base_url}/reviews?${query_params.toString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { reviews: PodiumReview[] };
      return data.reviews;
    } catch (error) {
      throw new Error(`Failed to list Podium reviews: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAverageRating(): Promise<{ average_rating: number; total_reviews: number }> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/reviews/stats`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as { average_rating: number; total_reviews: number };
    } catch (error) {
      throw new Error(`Failed to get Podium average rating: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendPaymentRequest(payment: Partial<PodiumPaymentRequest>): Promise<PodiumPaymentRequest> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/payment-requests`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payment),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumPaymentRequest;
    } catch (error) {
      throw new Error(`Failed to send Podium payment request: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPaymentRequest(payment_id: string): Promise<PodiumPaymentRequest | null> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/payment-requests/${payment_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as PodiumPaymentRequest;
    } catch (error) {
      throw new Error(`Failed to get Podium payment request: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendReviewInvitation(contact_id: string): Promise<boolean> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/contacts/${contact_id}/review-invitation`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to send Podium review invitation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWebchatStatus(): Promise<{ enabled: boolean; online: boolean }> {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/webchat/status`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      return (await response.json()) as { enabled: boolean; online: boolean };
    } catch (error) {
      throw new Error(`Failed to get Podium webchat status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFeedback(): Promise<
    {
      id: string;
      contact_id: string;
      rating: number;
      comment: string;
      created_at: string;
    }[]
  > {
    await this.refreshTokenIfNeeded();

    try {
      const response = await fetch(`${this.base_url}/feedback`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Podium API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        feedback: {
          id: string;
          contact_id: string;
          rating: number;
          comment: string;
          created_at: string;
        }[];
      };
      return data.feedback;
    } catch (error) {
      throw new Error(`Failed to get Podium feedback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
