import jetEnv, { num } from "jet-env";
import { isEnumVal } from "jet-validators";

import { NodeEnvs } from ".";

const ENV = jetEnv({
  NodeEnv: isEnumVal(NodeEnvs),
  Port: num,
  RedisURL: String,
  CacheTtlSeconds: num,
  DataRefreshCron: String,
  CoingeckoApiKey: String,
});

export default ENV;
