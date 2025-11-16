import jetEnv, { num } from "jet-env";
import { isEnumVal } from "jet-validators";

import { NodeEnvs } from ".";

const ENV = jetEnv({
  NodeEnv: isEnumVal(NodeEnvs),
  Port: num,
  RedisHost: String,
  RedisPort: num,
  CacheTtlSeconds: num,
  DataRefreshCron: String,
  CoingeckoApiKey: String,
});

export default ENV;
