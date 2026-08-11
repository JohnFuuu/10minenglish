export interface PoliTransaction {
  token: string;
  navigateUrl: string;
}

export type PoliTransactionStatus = 'completed' | 'failed' | 'pending';

export interface PoliClient {
  initiateTransaction(params: {
    amountCents: number;
    currency: string;
    merchantReference: string;
    successUrl: string;
    failureUrl: string;
  }): Promise<PoliTransaction>;
  getTransactionStatus(token: string): Promise<PoliTransactionStatus>;
}

// Real implementation against POLi's historical Merchant API shape
// (Initiate/GetTransaction over HTTP Basic Auth with a merchant code +
// authentication code). POLi has changed hands/consolidated over the years,
// so verify the current base URL and response shape against live provider
// docs before relying on this in production — this code can't fabricate
// real POLi credentials or confirm the service's current status either way.
const DEFAULT_BASE_URL = 'https://poliapi.apac.pointspay.com/api/v2';

function getCredentials() {
  const merchantCode = process.env.POLI_MERCHANT_CODE;
  const authenticationCode = process.env.POLI_AUTHENTICATION_CODE;
  if (!merchantCode || !authenticationCode) {
    throw new Error('POLI_MERCHANT_CODE / POLI_AUTHENTICATION_CODE is not set');
  }
  return { merchantCode, authenticationCode };
}

function authHeader(merchantCode: string, authenticationCode: string): string {
  const encoded = Buffer.from(`${merchantCode}:${authenticationCode}`).toString('base64');
  return `Basic ${encoded}`;
}

export const realPoliClient: PoliClient = {
  async initiateTransaction(params) {
    const { merchantCode, authenticationCode } = getCredentials();
    const baseUrl = process.env.POLI_API_BASE_URL ?? DEFAULT_BASE_URL;

    const res = await fetch(`${baseUrl}/Transaction/Initiate`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(merchantCode, authenticationCode),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Amount: (params.amountCents / 100).toFixed(2),
        CurrencyCode: params.currency.toUpperCase(),
        MerchantReference: params.merchantReference,
        SuccessUrl: params.successUrl,
        FailureUrl: params.failureUrl,
        CancellationUrl: params.failureUrl,
      }),
    });

    if (!res.ok) throw new Error(`POLi initiate failed: ${res.status}`);
    const body = (await res.json()) as { NavigateURL: string; Token: string };
    return { token: body.Token, navigateUrl: body.NavigateURL };
  },

  async getTransactionStatus(token) {
    const { merchantCode, authenticationCode } = getCredentials();
    const baseUrl = process.env.POLI_API_BASE_URL ?? DEFAULT_BASE_URL;

    const res = await fetch(`${baseUrl}/Transaction/GetTransaction/${token}`, {
      headers: { Authorization: authHeader(merchantCode, authenticationCode) },
    });

    if (!res.ok) throw new Error(`POLi status check failed: ${res.status}`);
    const body = (await res.json()) as { TransactionStatus: string };
    if (body.TransactionStatus === 'Completed') return 'completed';
    if (body.TransactionStatus === 'Failed' || body.TransactionStatus === 'Cancelled') return 'failed';
    return 'pending';
  },
};
