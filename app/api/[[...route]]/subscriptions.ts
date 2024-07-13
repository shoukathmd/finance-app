import { db } from "@/db/drizzle";
import { subscriptions } from "@/db/schema";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { createCheckout, getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import crypto from "crypto";
import { setupLemon } from "@/lib/ls";

setupLemon();

const app = new Hono()
  .get("/current", clerkMiddleware(), async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.userId));

    return c.json({ data: subscription || null });
  })
  .post("/checkout", clerkMiddleware(), async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.userId));

    if (existing?.subscriptionId) {
      try {
        const subscription = await getSubscription(existing.subscriptionId);
        console.log("Fetched subscription:", subscription);

        const portalUrl =
          subscription?.data?.data?.attributes?.urls?.customer_portal;

        if (!portalUrl) {
          console.error("Portal URL is undefined");
          return c.json({ error: "Internal error" }, 500);
        }

        return c.json({ data: portalUrl });
      } catch (error) {
        console.error("Error fetching subscription:", error);
        return c.json({ error: "Internal error" }, 500);
      }
    }

    try {
      const checkout = await createCheckout(
        process.env.LEMONSQUEEZY_STORE_ID!,
        process.env.LEMONSQUEEZY_PRODUCT_ID!,
        {
          checkoutData: {
            custom: {
              user_id: auth.userId,
            },
          },
          productOptions: {
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL!}/`,
          },
        }
      );
      console.log("Created checkout:", checkout);

      const checkoutUrl = checkout?.data?.data?.attributes?.url;

      if (!checkoutUrl) {
        console.error("Checkout URL is undefined");
        return c.json({ error: "Internal error" }, 500);
      }

      return c.json({ data: checkoutUrl });
    } catch (error) {
      console.error("Error creating checkout:", error);
      return c.json({ error: "Internal error" }, 500);
    }
  })
  .post("/webhook", async (c) => {
    const text = await c.req.text();

    const hmac = crypto.createHmac(
      "sha256",
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET!
    );
    const digest = Buffer.from(hmac.update(text).digest("hex"), "utf8");
    const signature = Buffer.from(
      c.req.header("x-signature") as string,
      "utf8"
    );

    if (!crypto.timingSafeEqual(digest, signature)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const payload = JSON.parse(text);
      console.log("Webhook payload:", payload);

      const event = payload.meta.event_name;
      const subscriptionId = payload.data.id;
      const userId = payload.meta.custom_data.user_id;
      const status = payload.data.attributes.status;

      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.subscriptionId, subscriptionId));

      if (
        event === "subscription_created" ||
        event === "subscription_updated"
      ) {
        if (existing) {
          await db
            .update(subscriptions)
            .set({ status })
            .where(eq(subscriptions.subscriptionId, subscriptionId));
        } else {
          await db.insert(subscriptions).values({
            id: createId(),
            subscriptionId,
            userId,
            status,
          });
        }
      }

      return c.json({}, 200);
    } catch (error) {
      console.error("Error processing webhook:", error);
      return c.json({ error: "Internal error" }, 500);
    }
  });

export default app;
