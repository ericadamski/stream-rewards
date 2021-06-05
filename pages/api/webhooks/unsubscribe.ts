import { NextApiRequest, NextApiResponse } from "next";
import { until } from "@open-draft/until";

import { getUserFromCookies } from "utils/getUserFromCookies";
import { TwitchWebhookType } from "lib/twitch";
import { removeTwitchEventSubscription } from "utils/removeTwitchEventSubscription";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const [authorizationError, user] = await until(() =>
    getUserFromCookies(req.cookies)
  );

  if (authorizationError != null || user == null || user.token == null) {
    return res.status(401).end();
  }

  const { sub_type } = req.body as { sub_type?: TwitchWebhookType };

  if (sub_type == null) {
    return res.status(400).end();
  }

  const success = await removeTwitchEventSubscription(user, sub_type);

  if (!success) {
    return res.status(500).end();
  }

  res.end();
};
