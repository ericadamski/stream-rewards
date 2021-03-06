import { GetServerSideProps } from "next";
import styled from "styled-components";
import { motion } from "framer-motion";
import Router, { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ms from "ms";

import {
  User,
  getUserByTwitchLogin,
  UserSubReward,
  listRewardsForTwitchLogin,
} from "lib/supabase";
import { useRewards } from "hooks/useRewards";
import { getNextReward } from "utils/getNextReward";
import { sortBy } from "ramda";
import { useTrackingMetric } from "hooks/useTrackingMetric";
import { getTwitchEventFriendlyName } from "utils/getTwitchEventFriendlyName";
import { TwitchWebhookType } from "lib/twitch";
import { useLiveStreamId } from "hooks/useLiveStream";
import { useTackCurrentMetric } from "hooks/useTackCurrentMetric";

interface Props {
  user?: User;
  rewards?: UserSubReward[];
}

// TODO: we getting the realtime data and potentially refetching on interval
//  make sure we check the count as a prelime query so we don't exhaust the DB.
//  OR integrate ably websockets... not sure which one makes more sense. Maybe both?

export default function UserPage(props: Props) {
  const router = useRouter();
  const trackingMetric = useTrackingMetric(props.user?.id);
  const streamId = useLiveStreamId(props.user?.id);
  const [currentMetricCount, lastEvent] = useTackCurrentMetric(
    props.user?.id,
    streamId,
    trackingMetric
  );

  const actualMetricCount =
    props.user?.id === "190420931"
      ? 74 + currentMetricCount
      : currentMetricCount;
  const [nextReward, setNextReward] = useState<UserSubReward>();
  const [remainingRewards, setRemainingRewards] = useState<UserSubReward[]>(
    props.rewards ?? []
  );
  const { data: allRewards = [] } = useRewards(props.user?.login, {
    initialData: props.rewards,
    refreshInterval: ms("10s"),
  });

  const direction = router.query.d ?? "left";

  useEffect(() => {
    if (props.user == null) {
      Router.replace("/");
    }
  }, []);

  useEffect(() => {
    const [next, remianing] = getNextReward(actualMetricCount, allRewards);
    setNextReward(next);
    setRemainingRewards(remianing);
  }, [actualMetricCount, allRewards]);

  if (props.user == null) {
    return null;
  }

  const maxReward = sortBy((r) => r.sub_count, allRewards).pop();
  const singleStep = 1 / (maxReward?.sub_count ?? 1);
  const progress = actualMetricCount * singleStep * 100;

  const metricFriendlyName = getTwitchEventFriendlyName(
    trackingMetric as TwitchWebhookType
  );

  return (
    <ProgressContainer
      style={{
        left: direction === "l" ? 0 : undefined,
        right: direction === "r" ? 0 : undefined,
      }}
    >
      <ProgressBar>
        {nextReward && (
          <>
            <Detail
              style={{
                top: `${Math.max(
                  Math.min(
                    100 - (nextReward?.sub_count ?? 1) * singleStep * 100,
                    98
                  ),
                  8
                )}%`,
                y: "-100%",
                x: direction === "l" ? 0 : "-125%",
              }}
            >
              <p style={{ fontWeight: "normal", fontSize: "0.5rem" }}>
                Reward at {nextReward.sub_count}{" "}
                {metricFriendlyName?.toLowerCase()}:
              </p>
              <p>{nextReward.reward}</p>
              <p>
                last{" "}
                {metricFriendlyName
                  ?.toLowerCase()
                  .substr(0, metricFriendlyName.length - 1)}
                : {lastEvent?.event_user_name}
              </p>
            </Detail>
            <Line
              rewardAmount={nextReward?.sub_count ?? 1}
              style={{
                top: `${Math.max(
                  Math.min(
                    100 - (nextReward?.sub_count ?? 1) * singleStep * 100,
                    98
                  ),
                  2
                )}%`,
              }}
            />
          </>
        )}
        <Progress
          animate={{
            height: `${Math.max(4, progress)}%`,
            borderTopLeftRadius: progress === 100 ? "1rem" : undefined,
            borderTopRightRadius: progress === 100 ? "1rem" : undefined,
          }}
        >
          {progress > 0 && (
            <Detail
              style={{
                minWidth: 120,
                textAlign: "center",
                x: direction === "l" ? 0 : "-125%",
              }}
            >
              <p>
                {metricFriendlyName}: {actualMetricCount}
              </p>
            </Detail>
          )}
        </Progress>
      </ProgressBar>
    </ProgressContainer>
  );
}

export const getServerSideProps: GetServerSideProps =
  async function getServerSideProps(context) {
    const { twitchId } = context.params as { twitchId: string };

    const redirectHome = () => {
      context.res.statusCode = 302;
      context.res.setHeader("Location", "/");
    };

    if (twitchId == null) {
      redirectHome();

      return { props: {} };
    }

    const user = await getUserByTwitchLogin(twitchId);

    if (user == null) {
      redirectHome();

      return { props: {} };
    }

    const rewards = await listRewardsForTwitchLogin(twitchId);

    return {
      props: {
        user,
        rewards,
      },
    };
  };

const ProgressContainer = styled.div`
  position: fixed;
  box-sizing: border-box;
  height: 100vh;
  padding: 2rem;
`;

const ProgressBar = styled.div`
  position: relative;
  display: flex;
  flex-direction: column-reverse;
  height: 100%;
  width: 1rem;
  background-color: #a594eb;
  border-radius: 1rem;
  border: 1px solid #a594eb;
`;

const Line = styled(motion.div)<{ rewardAmount: number }>`
  position: absolute;
  left: 0;
  height: 2px;
  width: 100%;
  background-color: white;

  &::before {
    position: absolute;
    top: -0.75rem;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 10%;
    content: "${(props) => props.rewardAmount}";
  }
`;

const Detail = styled(motion.div)`
  position: absolute;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1rem;
  background-color: rgba(166, 148, 235, 0.8);
  border-radius: 0.75rem;
  left: 2rem;
  top: 0;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 0.025rem;
  min-width: 200px;

  & p {
    margin: 0;
    white-space: pre-wrap;
  }
`;

const Progress = styled(motion.div)`
  position: relative;
  bottom: 0;
  width: 100%;
  background-color: #75f0c1;
  border-bottom-left-radius: 1rem;
  border-bottom-right-radius: 1rem;
`;
