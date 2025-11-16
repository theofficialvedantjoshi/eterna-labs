/* eslint-disable n/no-process-env */
import dotenv from "dotenv";
import moduleAlias from "module-alias";

dotenv.config();

// Configure moduleAlias
if (__filename.endsWith("js")) {
  moduleAlias.addAlias("@src", __dirname + "/dist");
}
