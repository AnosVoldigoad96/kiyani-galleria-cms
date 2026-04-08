export const dynamic = "force-dynamic";

import { createClient } from "graphql-ws";
import WebSocket from "ws";
import { requireStaffAccess, resolveGraphqlUrl } from "@/lib/staff-auth";

const SUBSCRIPTIONS: Record<string, string> = {
  orders: `
    subscription LiveOrders {
      orders(order_by: { created_at: desc }) {
        id
        order_no
        user_id
        customer_name
        customer_email
        customer_phone
        city
        address
        subtotal_pkr
        discount_pkr
        shipping_pkr
        total_pkr
        notes
        payment_status
        fulfillment_status
      }
    }
  `,
  order_items: `
    subscription LiveOrderItems {
      order_items {
        id
        order_id
        product_id
        product_name
        sku
        quantity
        unit_price_pkr
        total_price_pkr
      }
    }
  `,
  custom_requests: `
    subscription LiveCustomRequests {
      custom_requests(order_by: { created_at: desc }) {
        id
        request_no
        user_id
        customer_name
        customer_email
        customer_phone
        request_type
        brief
        budget_pkr
        due_date
        priority
        status
        assigned_to
      }
    }
  `,
};

export async function GET(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "HASURA_ADMIN_SECRET is not configured." }, { status: 500 });
  }

  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  // Derive WebSocket URL from GraphQL URL
  const graphqlUrl = resolveGraphqlUrl();
  const wsUrl = graphqlUrl.replace(/^https?:\/\//, (match) =>
    match === "https://" ? "wss://" : "ws://",
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const client = createClient({
        url: wsUrl,
        webSocketImpl: WebSocket,
        connectionParams: {
          headers: {
            "x-hasura-admin-secret": adminSecret,
          },
        },
        shouldRetry: () => true,
        retryAttempts: Infinity,
        retryWait: async (retries) => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1000 * 2 ** retries, 30000)),
          );
        },
      });

      const unsubscribes: Array<() => void> = [];

      for (const [table, query] of Object.entries(SUBSCRIPTIONS)) {
        const unsubscribe = client.subscribe(
          { query },
          {
            next(value) {
              const key = Object.keys(value.data ?? {})[0];
              const rows = key ? (value.data as Record<string, unknown[]>)[key] : [];

              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ table, data: rows })}\n\n`),
                );
              } catch {
                // Stream closed
              }
            },
            error() {
              // graphql-ws handles reconnection
            },
            complete() {
              // Subscription ended
            },
          },
        );

        unsubscribes.push(unsubscribe);
      }

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribes.forEach((unsub) => unsub());
        client.dispose();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
